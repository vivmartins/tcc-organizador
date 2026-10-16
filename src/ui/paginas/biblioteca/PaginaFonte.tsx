import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Trash2, Copy, CheckCircle2, AlertCircle, CircleDashed, ExternalLink, Check } from 'lucide-react';
import { db, type Fonte, type ResumoEstudo, type StatusLeitura } from '../../../data/db.ts';
import { atualizarResumo, atualizarStatusLeitura, excluirFonte, marcarCampos } from '../../../data/fontes.ts';
import { gerarReferencia, limparDoi, type Pendencia } from '../../../domain/abnt/referencia.ts';
import { gerarCitacao, type EstiloCitacao } from '../../../domain/abnt/citacao.ts';
import { ROTULO_TIPO, ROTULO_CAMPO, type CampoBibliografico } from '../../../domain/tipos.ts';
import { useProjetoObrigatorio } from '../../projetoAtivo.tsx';
import { AreaTexto, Botao, BotaoLink, Cartao, Campo, Entrada, Selecao, Selo, cx } from '../../componentes/base.tsx';
import { Confirmacao, useAvisos } from '../../componentes/dialogos.tsx';
import { copiar, dataCurta, plural } from '../../util.ts';
import { ORDEM_STATUS, ROTULO_STATUS_LEITURA } from './rotulos.ts';
import { formatarDataAcesso } from '../../../domain/abnt/referencia.ts';
import { ListaDeFichas } from '../fichamentos/Fichamentos.tsx';
import { TextoDaFonte } from './TextoDaFonte.tsx';

type Aba = 'dados' | 'resumo' | 'fichamentos' | 'referencia';
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'referencia', rotulo: 'Referência ABNT' },
  { id: 'dados', rotulo: 'Dados bibliográficos' },
  { id: 'resumo', rotulo: 'Resumo do estudo' },
  { id: 'fichamentos', rotulo: 'Fichamentos' },
];

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-[13px] text-cinza-500">{rotulo}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

function SeloStatusCampo({ fonte, campo }: { fonte: Fonte; campo: CampoBibliografico }) {
  const s = fonte.statusCampos?.[campo];
  if (s === 'verificado') return <span title="Conferido por você" className="ml-1.5 inline-flex align-middle text-sucesso-700"><CheckCircle2 size={14} /></span>;
  if (s === 'importado') return <span title="Veio da busca automática — confira" className="ml-1.5 inline-flex align-middle text-alerta-700"><CircleDashed size={14} /></span>;
  return <span title="Ainda não conferido" className="ml-1.5 inline-flex align-middle text-cinza-500"><CircleDashed size={14} /></span>;
}

function AbaDados({ fonte, nomesTags }: { fonte: Fonte; nomesTags: Map<string, string> }) {
  const v = (campo: CampoBibliografico, conteudo: ReactNode) => (
    <Linha rotulo={ROTULO_CAMPO[campo].charAt(0).toUpperCase() + ROTULO_CAMPO[campo].slice(1)}>
      {conteudo}
      <SeloStatusCampo fonte={fonte} campo={campo} />
    </Linha>
  );
  const pessoas = (lista?: Fonte['autores']) => lista?.map((a) => (a.tipo === 'entidade' ? a.sobrenome : `${a.sobrenome}${a.prenomes ? `, ${a.prenomes}` : ''}`)).join('; ');
  const textos: CampoBibliografico[] = ['veiculo', 'tipoTrabalho', 'edicao', 'localPublicacao', 'editora', 'volume', 'numero', 'paginas', 'numeroArtigo', 'numeroEvento', 'anoEvento', 'localEvento', 'tituloAnais'];
  return (
    <Cartao className="px-5 py-2">
      <dl className="divide-y divide-borda">
        <Linha rotulo="Tipo">{ROTULO_TIPO[fonte.tipo]}</Linha>
        {v('titulo', <>{fonte.titulo}{fonte.subtitulo ? `: ${fonte.subtitulo}` : ''}</>)}
        {fonte.autores.length > 0 && v('autores', pessoas(fonte.autores))}
        {!!fonte.organizadores?.length && v('organizadores', `${pessoas(fonte.organizadores)} (${fonte.papelOrganizadores ?? 'org.'})`)}
        {fonte.ano && v('ano', fonte.ano)}
        {textos.filter((c) => fonte[c] !== undefined && fonte[c] !== '').map((c) => <div key={c}>{v(c, String(fonte[c]))}</div>)}
        {fonte.doi && v('doi', <a href={`https://doi.org/${limparDoi(fonte.doi)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-acao-700 hover:underline">{limparDoi(fonte.doi)} <ExternalLink size={12} /></a>)}
        {fonte.url && v('url', <a href={fonte.url} target="_blank" rel="noreferrer" className="break-all text-acao-700 hover:underline">{fonte.url}</a>)}
        {fonte.dataAcesso && v('dataAcesso', formatarDataAcesso(fonte.dataAcesso) ?? fonte.dataAcesso)}
        {fonte.palavrasChave.length > 0 && <Linha rotulo="Palavras-chave">{fonte.palavrasChave.join('; ')}</Linha>}
        {fonte.tagIds.length > 0 && <Linha rotulo="Temas e tags"><span className="flex flex-wrap gap-1">{fonte.tagIds.map((id) => nomesTags.has(id) && <Selo key={id}>{nomesTags.get(id)}</Selo>)}</span></Linha>}
        {fonte.observacoes && <Linha rotulo="Observações"><span className="whitespace-pre-wrap">{fonte.observacoes}</span></Linha>}
        <Linha rotulo="Cadastrada em">{dataCurta(fonte.criadoEm)}{fonte.atualizadoEm !== fonte.criadoEm && <span className="text-cinza-500"> · editada em {dataCurta(fonte.atualizadoEm)}</span>}</Linha>
      </dl>
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-borda py-3 text-xs text-cinza-500">
        <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} className="text-sucesso-700" /> conferido</span>
        <span className="inline-flex items-center gap-1"><CircleDashed size={13} /> ainda não conferido</span>
        <span>Para conferir, use a aba Referência ABNT.</span>
      </p>
    </Cartao>
  );
}

const CAMPOS_RESUMO: { k: keyof ResumoEstudo; rotulo: string; dica: string }[] = [
  { k: 'objetivo', rotulo: 'Objetivo do estudo', dica: 'O que os autores quiseram investigar ou discutir.' },
  { k: 'conceitos', rotulo: 'Principais conceitos', dica: 'Termos e definições centrais.' },
  { k: 'metodo', rotulo: 'Método ou tipo de publicação', dica: 'Ex.: revisão integrativa, estudo qualitativo, ensaio teórico.' },
  { k: 'resultados', rotulo: 'Principais resultados ou argumentos', dica: '' },
  { k: 'conclusoes', rotulo: 'Conclusões relevantes para a sua pesquisa', dica: 'Por que esta fonte importa para o seu TCC.' },
];

function AbaResumo({ fonte }: { fonte: Fonte }) {
  const avisar = useAvisos();
  const [r, setR] = useState<ResumoEstudo>(fonte.resumo ?? {});
  const [salvando, setSalvando] = useState(false);
  const alterado = JSON.stringify(r) !== JSON.stringify(fonte.resumo ?? {});
  return (
    <Cartao className="p-5 sm:p-6">
      <p className="mb-4 text-sm text-cinza-600">Todos os campos são opcionais. Escreva com as suas palavras.</p>
      <div className="flex flex-col gap-4">
        {CAMPOS_RESUMO.map(({ k, rotulo, dica }) => (
          <Campo key={k} rotulo={rotulo} id={`resumo-${k}`} dica={dica || undefined}>
            <AreaTexto id={`resumo-${k}`} value={r[k] ?? ''} onChange={(e) => setR({ ...r, [k]: e.target.value })} rows={3} />
          </Campo>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Botao
          variante="primario"
          disabled={!alterado || salvando}
          onClick={async () => {
            setSalvando(true);
            try {
              await atualizarResumo(fonte.id, r);
              avisar('sucesso', 'Resumo salvo.');
            } catch (e) {
              avisar('erro', `Não foi possível salvar: ${(e as Error).message}`);
            } finally {
              setSalvando(false);
            }
          }}
        >
          Salvar resumo
        </Botao>
        {alterado && <span className="text-xs text-alerta-700">Alterações não salvas</span>}
      </div>
    </Cartao>
  );
}

function ListaPendencias({ titulo, itens, tom, acao }: { titulo: string; itens: Pendencia[]; tom: 'perigo' | 'alerta' | 'neutro'; acao?: (p: Pendencia) => ReactNode }) {
  if (!itens.length) return null;
  const cor = { perigo: 'text-perigo-700', alerta: 'text-alerta-700', neutro: 'text-cinza-600' }[tom];
  return (
    <div>
      <h3 className={cx('mb-1.5 text-xs font-semibold uppercase tracking-wide', cor)}>{titulo}</h3>
      <ul className="flex flex-col gap-1">
        {itens.map((p, i) => (
          <li key={`${p.campo}-${i}`} className="flex items-center justify-between gap-3 text-sm">
            <span>{p.mensagem}</span>
            {acao?.(p)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AbaReferencia({ fonte, etAl, maiusculas }: { fonte: Fonte; etAl?: boolean; maiusculas?: boolean }) {
  const avisar = useAvisos();
  const ref = useMemo(() => gerarReferencia(fonte, { etAlAPartirDe4: etAl }), [fonte, etAl]);
  const [estilo, setEstilo] = useState<EstiloCitacao>('parentetica');
  const [pagina, setPagina] = useState('');
  const citacao = gerarCitacao(fonte, { estilo, pagina, maiusculas });

  const obrig = ref.pendencias.filter((p) => p.nivel === 'obrigatorio');
  const recom = ref.pendencias.filter((p) => p.nivel === 'recomendado');
  const conferir = ref.pendencias.filter((p) => p.nivel === 'conferir');
  const conferiveis = [...new Set(conferir.map((p) => p.campo))].filter((c) => fonte[c] !== undefined);

  async function copiarComAviso(texto: string, html: string | undefined, o_que: string) {
    try {
      await copiar(texto, html);
      avisar('sucesso', `${o_que} copiada.`);
    } catch {
      avisar('erro', 'Não foi possível copiar. Verifique a permissão de área de transferência do navegador.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Cartao className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Referência</h2>
          {ref.completa ? (
            conferir.length ? <Selo tom="alerta"><AlertCircle size={12} /> Falta conferir dados</Selo> : <Selo tom="sucesso"><CheckCircle2 size={12} /> Dados conferidos</Selo>
          ) : (
            <Selo tom="perigo"><AlertCircle size={12} /> Dados obrigatórios faltando</Selo>
          )}
        </div>
        <p className="rounded-md bg-fundo px-4 py-3 font-serif text-[15px] leading-relaxed text-marinho-900" dangerouslySetInnerHTML={{ __html: ref.html }} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Botao variante="primario" onClick={() => copiarComAviso(ref.texto, ref.html, 'Referência')}><Copy size={15} /> Copiar referência</Botao>
          <BotaoLink para={`/biblioteca/${fonte.id}/editar`}><Pencil size={14} /> Corrigir dados</BotaoLink>
        </div>
        <p className="mt-3 text-xs text-cinza-500">
          Formatada pela NBR 6023:2025. Uma referência formatada não é automaticamente correta: confira os dados com a publicação original.
        </p>
      </Cartao>

      {(obrig.length > 0 || recom.length > 0 || conferir.length > 0) && (
        <Cartao className="flex flex-col gap-4 p-5 sm:p-6">
          <ListaPendencias titulo="Obrigatório" itens={obrig} tom="perigo" />
          <ListaPendencias titulo="Recomendado" itens={recom} tom="alerta" />
          <ListaPendencias
            titulo="Conferir com a publicação"
            itens={conferir}
            tom="neutro"
            acao={(p) =>
              fonte[p.campo] !== undefined && (
                <Botao tamanho="p" variante="fantasma" onClick={() => marcarCampos(fonte.id, [p.campo], 'verificado')} className="shrink-0">
                  <Check size={14} /> Conferido
                </Botao>
              )
            }
          />
          {conferiveis.length > 1 && (
            <div>
              <Botao tamanho="p" onClick={async () => { await marcarCampos(fonte.id, conferiveis, 'verificado'); avisar('sucesso', 'Todos os dados marcados como conferidos.'); }}>
                <CheckCircle2 size={14} /> Conferi todos os dados
              </Botao>
            </div>
          )}
        </Cartao>
      )}

      <Cartao className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Citação no texto</h2>
        <p className="mt-0.5 text-xs text-cinza-500">Sistema autor-data, NBR 10520:2023.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_160px]">
          <Campo rotulo="Formato" id="estilo">
            <Selecao id="estilo" value={estilo} onChange={(e) => setEstilo(e.target.value as EstiloCitacao)}>
              <option value="parentetica">Entre parênteses</option>
              <option value="narrativa">No corpo da frase</option>
            </Selecao>
          </Campo>
          <Campo rotulo="Página" id="pagina" dica="Obrigatória em citação direta.">
            <Entrada id="pagina" value={pagina} onChange={(e) => setPagina(e.target.value)} placeholder="Ex.: 15" />
          </Campo>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-md bg-fundo px-3 py-2 font-serif text-[15px] text-marinho-900">{citacao}</code>
          <Botao tamanho="p" onClick={() => copiarComAviso(citacao, undefined, 'Citação')}><Copy size={14} /> Copiar</Botao>
        </div>
      </Cartao>
    </div>
  );
}

export function PaginaFonte() {
  const projeto = useProjetoObrigatorio();
  const { id } = useParams();
  const navegar = useNavigate();
  const avisar = useAvisos();
  const [aba, setAba] = useState<Aba>('referencia');
  const [excluindo, setExcluindo] = useState(false);

  const dados = useLiveQuery(async () => {
    const fonte = id ? await db.fontes.get(id) : undefined;
    const tags = await db.tags.where('projetoId').equals(projeto.id).toArray();
    const fichas = id ? await db.fichamentos.where('fonteId').equals(id).count() : 0;
    return { fonte: fonte ?? null, tags, fichas };
  }, [id, projeto.id]);
  const nomesTags = useMemo(() => new Map((dados?.tags ?? []).map((t) => [t.id, t.nome])), [dados?.tags]);

  if (!dados) return null;
  const { fonte, fichas } = dados;
  if (!fonte || fonte.projetoId !== projeto.id) {
    return (
      <p className="text-sm text-cinza-600">
        Fonte não encontrada neste projeto. <Link to="/biblioteca" className="text-acao-700 hover:underline">Voltar à biblioteca</Link>
      </p>
    );
  }

  return (
    <>
      <div className="mb-3">
        <BotaoLink para="/biblioteca" variante="fantasma" className="-ml-2"><ArrowLeft size={16} /> Biblioteca</BotaoLink>
      </div>
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-cinza-500">{ROTULO_TIPO[fonte.tipo]}{fonte.ano ? ` · ${fonte.ano}` : ''}</p>
          <h1 className="mt-1 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
            {fonte.titulo}{fonte.subtitulo && <span className="font-normal text-marinho-700">: {fonte.subtitulo}</span>}
          </h1>
          {fonte.autores.length > 0 && <p className="mt-1 text-sm text-cinza-600">{fonte.autores.map((a) => (a.tipo === 'entidade' ? a.sobrenome : [a.prenomes, a.sobrenome].filter(Boolean).join(' '))).join(', ')}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Selecao aria-label="Status de leitura" value={fonte.statusLeitura} onChange={async (e) => { await atualizarStatusLeitura(fonte.id, e.target.value as StatusLeitura); avisar('sucesso', 'Status atualizado.'); }} className="w-36">
            {ORDEM_STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS_LEITURA[s]}</option>)}
          </Selecao>
          <BotaoLink para={`/biblioteca/${fonte.id}/editar`}><Pencil size={14} /> Editar</BotaoLink>
          <Botao variante="perigo" onClick={() => setExcluindo(true)} aria-label="Excluir fonte"><Trash2 size={14} /></Botao>
        </div>
      </header>

      <div role="tablist" aria-label="Seções da fonte" className="mb-4 flex gap-1 overflow-x-auto border-b border-borda">
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors', aba === a.id ? 'border-acao-600 font-medium text-acao-700' : 'border-transparent text-cinza-600 hover:text-marinho-900')}
          >
            {a.rotulo}
            {a.id === 'fichamentos' && fichas > 0 && <span className="ml-1.5 rounded bg-cinza-100 px-1.5 text-xs">{fichas}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {aba === 'referencia' && <AbaReferencia fonte={fonte} etAl={projeto.etAlNasReferencias} maiusculas={projeto.citacaoMaiusculas} />}
        {aba === 'dados' && (
          <div className="flex flex-col gap-4">
            <AbaDados fonte={fonte} nomesTags={nomesTags} />
            <TextoDaFonte fonte={fonte} />
          </div>
        )}
        {aba === 'resumo' && <AbaResumo key={fonte.id} fonte={fonte} />}
        {aba === 'fichamentos' && <ListaDeFichas fonteId={fonte.id} />}
      </div>

      <Confirmacao
        aberto={excluindo}
        titulo="Excluir fonte?"
        textoConfirmar="Excluir"
        perigoso
        aoCancelar={() => setExcluindo(false)}
        aoConfirmar={async () => {
          setExcluindo(false);
          await excluirFonte(fonte.id);
          avisar('sucesso', 'Fonte excluída.');
          navegar('/biblioteca');
        }}
      >
        <p>
          <strong>{fonte.titulo}</strong> será apagada{fichas > 0 ? `, junto com ${plural(fichas, 'fichamento', 'fichamentos')} ligados a ela` : ''}.
        </p>
      </Confirmacao>
    </>
  );
}
