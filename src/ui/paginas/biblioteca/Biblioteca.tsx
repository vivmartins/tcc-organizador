import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookPlus, Search, Library, Copy, X, AlertCircle, ArrowUpDown } from 'lucide-react';
import { db, type Fonte, type StatusLeitura } from '../../../data/db.ts';
import { AjudaSecao } from '../../ajuda/AjudaSecao.tsx';
import { useProjetoObrigatorio } from '../../projetoAtivo.tsx';
import { Botao, BotaoLink, CabecalhoPagina, Cartao, EstadoVazio, Entrada, Selecao, Selo, cx } from '../../componentes/base.tsx';
import { useAvisos } from '../../componentes/dialogos.tsx';
import { corresponde, termosDaConsulta } from '../../../domain/busca.ts';
import { formatoDoProjeto, listaDeReferencias, referenciaDaFonte } from '../../../domain/formato.ts';
import { ROTULO_TIPO } from '../../../domain/tipos.ts';
import { copiar, plural } from '../../util.ts';
import { ROTULO_STATUS_LEITURA, TOM_STATUS_LEITURA, ORDEM_STATUS, autoresCurtos } from './rotulos.ts';

type Ordenacao = 'cadastro_desc' | 'cadastro_asc' | 'titulo' | 'autor' | 'ano_desc' | 'ano_asc';
const ROTULO_ORDENACAO: Record<Ordenacao, string> = {
  cadastro_desc: 'Mais recentes',
  cadastro_asc: 'Mais antigas',
  titulo: 'Título (A–Z)',
  autor: 'Autor (A–Z)',
  ano_desc: 'Ano (mais novo)',
  ano_asc: 'Ano (mais antigo)',
};

const comparar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

function ordenar(lista: Fonte[], o: Ordenacao): Fonte[] {
  const l = [...lista];
  switch (o) {
    case 'cadastro_desc': return l.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    case 'cadastro_asc': return l.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
    case 'titulo': return l.sort((a, b) => comparar(a.titulo, b.titulo));
    case 'autor': return l.sort((a, b) => comparar(a.autores[0]?.sobrenome ?? '~', b.autores[0]?.sobrenome ?? '~') || comparar(a.titulo, b.titulo));
    case 'ano_desc': return l.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0));
    case 'ano_asc': return l.sort((a, b) => (a.ano ?? 9999) - (b.ano ?? 9999));
  }
}

export function Biblioteca() {
  const projeto = useProjetoObrigatorio();
  const avisar = useAvisos();
  const [params, setParams] = useSearchParams();
  const modoReferencias = params.get('referencias') === '1';

  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<StatusLeitura | ''>('');
  const [tagId, setTagId] = useState('');
  const [ano, setAno] = useState('');
  const [ordem, setOrdem] = useState<Ordenacao>('cadastro_desc');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const dados = useLiveQuery(async () => {
    const [fontes, tags, fichamentos] = await Promise.all([
      db.fontes.where('projetoId').equals(projeto.id).toArray(),
      db.tags.where('projetoId').equals(projeto.id).toArray(),
      db.fichamentos.where('projetoId').equals(projeto.id).toArray(),
    ]);
    const textosFichas = new Map<string, string[]>();
    for (const f of fichamentos) {
      const l = textosFichas.get(f.fonteId) ?? [];
      l.push(f.trechoOriginal ?? '', f.parafrase ?? '', f.interpretacao ?? '', f.tema ?? '', f.capituloSecao ?? '');
      textosFichas.set(f.fonteId, l);
    }
    return { fontes, tags, textosFichas };
  }, [projeto.id]);

  const nomesTags = useMemo(() => new Map((dados?.tags ?? []).map((t) => [t.id, t.nome])), [dados?.tags]);
  const anos = useMemo(() => [...new Set((dados?.fontes ?? []).map((f) => f.ano).filter((a): a is number => !!a))].sort((a, b) => b - a), [dados?.fontes]);

  const filtradas = useMemo(() => {
    if (!dados) return [];
    const termos = termosDaConsulta(busca);
    const lista = dados.fontes.filter((f) => {
      if (status && f.statusLeitura !== status) return false;
      if (tagId && !f.tagIds.includes(tagId)) return false;
      if (ano && String(f.ano ?? '') !== ano) return false;
      return corresponde(termos, [
        f.titulo, f.subtitulo, f.veiculo, f.observacoes, f.doi,
        ...f.autores.flatMap((a) => [a.sobrenome, a.prenomes]),
        ...f.palavrasChave,
        ...f.tagIds.map((id) => nomesTags.get(id)),
        ...Object.values(f.resumo ?? {}),
        ...(dados.textosFichas.get(f.id) ?? []),
      ]);
    });
    return ordenar(lista, ordem);
  }, [dados, busca, status, tagId, ano, ordem, nomesTags]);

  if (!dados) return null;
  const filtrosAtivos = !!(busca || status || tagId || ano);
  const idsFiltrados = filtradas.map((f) => f.id);
  const todasMarcadas = idsFiltrados.length > 0 && idsFiltrados.every((id) => selecionadas.has(id));

  function alternar(id: string) {
    const s = new Set(selecionadas);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelecionadas(s);
  }

  async function copiarReferencias(fontes: Fonte[]) {
    const fmt = formatoDoProjeto(projeto);
    const lista = listaDeReferencias(fontes, fmt);
    try {
      await copiar(lista.texto, lista.html);
      const incompletas = fontes.filter((f) => !referenciaDaFonte(f, fmt).completa).length;
      const ordem = fmt.norma === 'vancouver' ? 'na ordem dos números' : 'em ordem alfabética';
      const semNumero = lista.semNumero ? ` ${plural(lista.semNumero, 'fonte ainda sem número', 'fontes ainda sem número')} (marcadas com [nº?]).` : '';
      avisar('sucesso', `${plural(fontes.length, 'referência copiada', 'referências copiadas')} ${ordem}.${incompletas ? ` Atenção: ${incompletas} com dados faltando.` : ''}${semNumero}`);
    } catch {
      avisar('erro', 'Não foi possível copiar. Verifique a permissão de área de transferência do navegador.');
    }
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Biblioteca"
        descricao={dados.fontes.length ? `${plural(dados.fontes.length, 'fonte cadastrada', 'fontes cadastradas')} neste projeto` : 'Suas fontes acadêmicas em um só lugar'}
        acoes={
          <>
            {dados.fontes.length > 0 && (
              <Botao onClick={() => copiarReferencias(dados.fontes)}><Copy size={15} /> Copiar todas as referências</Botao>
            )}
            <BotaoLink para="/biblioteca/nova" variante="primario"><BookPlus size={16} /> Cadastrar fonte</BotaoLink>
          </>
        }
      />
      <AjudaSecao secao="biblioteca" />

      {dados.fontes.length === 0 ? (
        <Cartao>
          <EstadoVazio icone={<Library size={20} />} titulo="Nenhuma fonte cadastrada" acao={<BotaoLink para="/biblioteca/nova" variante="primario"><BookPlus size={16} /> Cadastrar a primeira fonte</BotaoLink>}>
            Cadastre artigos, livros, teses e outros documentos. Depois você poderá registrar fichamentos e gerar as referências ABNT.
          </EstadoVazio>
        </Cartao>
      ) : (
        <>
          {modoReferencias && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-acao-100 bg-acao-50 px-4 py-3 text-sm text-acao-700">
              <span>Marque as fontes que deseja e clique em <strong>Copiar referências</strong>. Elas serão copiadas {projeto.normaReferencias === 'vancouver' ? 'na ordem dos números (Vancouver)' : 'em ordem alfabética'}, prontas para colar no seu documento.</span>
              <button onClick={() => setParams({})} aria-label="Fechar dica" className="shrink-0 rounded p-0.5 hover:bg-acao-100"><X size={16} /></button>
            </div>
          )}

          <div className="mb-3 flex flex-col gap-2">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cinza-500" />
              <Entrada type="search" aria-label="Pesquisar" placeholder="Pesquisar por título, autor, palavra-chave ou anotação…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Selecao aria-label="Status de leitura" value={status} onChange={(e) => setStatus(e.target.value as StatusLeitura | '')}>
                <option value="">Todos os status</option>
                {ORDEM_STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS_LEITURA[s]}</option>)}
              </Selecao>
              <Selecao aria-label="Tema ou tag" value={tagId} onChange={(e) => setTagId(e.target.value)} disabled={!dados.tags.length}>
                <option value="">{dados.tags.length ? 'Todos os temas' : 'Sem temas'}</option>
                {[...dados.tags].sort((a, b) => comparar(a.nome, b.nome)).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </Selecao>
              <Selecao aria-label="Ano" value={ano} onChange={(e) => setAno(e.target.value)}>
                <option value="">Todos os anos</option>
                {anos.map((a) => <option key={a} value={a}>{a}</option>)}
              </Selecao>
              <div className="relative">
                <ArrowUpDown size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-cinza-500" />
                <Selecao aria-label="Ordenar por" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordenacao)} className="pl-8">
                  {(Object.keys(ROTULO_ORDENACAO) as Ordenacao[]).map((o) => <option key={o} value={o}>{ROTULO_ORDENACAO[o]}</option>)}
                </Selecao>
              </div>
            </div>
          </div>

          {selecionadas.size > 0 && (
            <div className="sticky top-14 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-acao-100 bg-acao-50 px-3 py-2 text-sm lg:top-2">
              <span className="font-medium text-acao-700">{plural(selecionadas.size, 'selecionada', 'selecionadas')}</span>
              <Botao tamanho="p" variante="primario" onClick={() => copiarReferencias(dados.fontes.filter((f) => selecionadas.has(f.id)))}><Copy size={14} /> Copiar referências</Botao>
              <Botao tamanho="p" variante="fantasma" onClick={() => setSelecionadas(new Set())}>Limpar seleção</Botao>
            </div>
          )}

          <Cartao className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-borda bg-fundo/60 px-4 py-2 text-xs text-cinza-500">
              <input
                type="checkbox"
                aria-label="Selecionar todas as fontes exibidas"
                className="size-4 accent-acao-600"
                checked={todasMarcadas}
                onChange={() => {
                  const s = new Set(selecionadas);
                  if (todasMarcadas) idsFiltrados.forEach((id) => s.delete(id));
                  else idsFiltrados.forEach((id) => s.add(id));
                  setSelecionadas(s);
                }}
              />
              <span>{filtrosAtivos ? `${plural(filtradas.length, 'resultado', 'resultados')} de ${dados.fontes.length}` : 'Selecionar todas'}</span>
              {filtrosAtivos && (
                <button className="ml-auto text-acao-700 hover:underline" onClick={() => { setBusca(''); setStatus(''); setTagId(''); setAno(''); }}>Limpar filtros</button>
              )}
            </div>
            {filtradas.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-cinza-500">Nenhuma fonte encontrada com esses filtros.</p>
            ) : (
              <ul className="divide-y divide-borda">
                {filtradas.map((f) => {
                  const completa = referenciaDaFonte(f, formatoDoProjeto(projeto)).completa;
                  return (
                    <li key={f.id} className={cx('flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-fundo', selecionadas.has(f.id) && 'bg-acao-50/50')}>
                      <input type="checkbox" aria-label={`Selecionar ${f.titulo}`} className="mt-1 size-4 shrink-0 accent-acao-600" checked={selecionadas.has(f.id)} onChange={() => alternar(f.id)} />
                      <Link to={`/biblioteca/${f.id}`} className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium leading-snug text-marinho-900">
                          {projeto.normaReferencias === 'vancouver' && (
                            <span className="mr-1.5 inline-flex min-w-6 justify-center rounded bg-acao-50 px-1 text-xs font-semibold text-acao-700" title="Número na lista de referências (Vancouver)">{f.numeroVancouver ?? 'nº?'}</span>
                          )}
                          {f.titulo}{f.subtitulo && <span className="font-normal text-marinho-700">: {f.subtitulo}</span>}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-cinza-600">
                          {[autoresCurtos(f.autores) || 'Sem autoria', f.ano ?? 'sem ano', f.veiculo].filter(Boolean).join(' · ')}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Selo tom={TOM_STATUS_LEITURA[f.statusLeitura]}>{ROTULO_STATUS_LEITURA[f.statusLeitura]}</Selo>
                          <span className="text-xs text-cinza-500">{ROTULO_TIPO[f.tipo]}</span>
                          {f.tagIds.map((id) => nomesTags.has(id) && <Selo key={id}>{nomesTags.get(id)}</Selo>)}
                          {!completa && <Selo tom="alerta"><AlertCircle size={12} /> Dados faltando</Selo>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Cartao>
        </>
      )}
    </>
  );
}
