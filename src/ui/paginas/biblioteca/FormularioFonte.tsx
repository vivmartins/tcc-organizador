import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Trash2, X, Info } from 'lucide-react';
import { db, type Fonte, type StatusLeitura } from '../../../data/db.ts';
import { criarFonte, atualizarFonte, verificarDuplicatas, ErroDeValidacao, type DadosFonte } from '../../../data/fontes.ts';
import { obterOuCriarTag } from '../../../data/tags.ts';
import { ROTULO_TIPO, type Autor, type CampoBibliografico, type TipoPublicacao } from '../../../domain/tipos.ts';
import { useProjetoObrigatorio } from '../../projetoAtivo.tsx';
import { AreaTexto, Botao, BotaoLink, CabecalhoPagina, Campo, Cartao, Entrada, Selecao, Selo, cx } from '../../componentes/base.tsx';
import { Confirmacao, useAvisos } from '../../componentes/dialogos.tsx';
import { hojeIso } from '../../util.ts';
import { ORDEM_STATUS, ROTULO_STATUS_LEITURA, autoresCurtos } from './rotulos.ts';

// Quais campos aparecem para cada tipo de publicação, e com qual rótulo.
type CampoForm = Exclude<CampoBibliografico, 'titulo' | 'subtitulo' | 'autores' | 'ano' | 'doi' | 'url' | 'dataAcesso'>;
const CAMPOS_POR_TIPO: Record<TipoPublicacao, CampoForm[]> = {
  artigo_periodico: ['veiculo', 'localPublicacao', 'volume', 'numero', 'paginas', 'numeroArtigo'],
  livro: ['edicao', 'localPublicacao', 'editora'],
  capitulo_livro: ['organizadores', 'veiculo', 'edicao', 'localPublicacao', 'editora', 'paginas'],
  tese: ['tipoTrabalho', 'veiculo', 'localPublicacao'],
  dissertacao: ['tipoTrabalho', 'veiculo', 'localPublicacao'],
  tcc_monografia: ['tipoTrabalho', 'veiculo', 'localPublicacao'],
  trabalho_evento: ['veiculo', 'numeroEvento', 'anoEvento', 'localEvento', 'tituloAnais', 'localPublicacao', 'editora', 'paginas'],
  documento_institucional: ['edicao', 'localPublicacao', 'editora'],
  legislacao: ['localPublicacao', 'editora'],
  pagina_web: ['veiculo', 'localPublicacao'],
  outro: ['veiculo', 'edicao', 'localPublicacao', 'editora', 'paginas'],
};

const ROTULO_VEICULO: Partial<Record<TipoPublicacao, string>> = {
  artigo_periodico: 'Periódico (revista)',
  capitulo_livro: 'Título do livro',
  tese: 'Instituição',
  dissertacao: 'Instituição',
  tcc_monografia: 'Instituição',
  trabalho_evento: 'Nome do evento',
  pagina_web: 'Site ou instituição responsável',
  outro: 'Publicado em',
};

const PLACEHOLDER: Partial<Record<CampoForm, string>> = {
  localPublicacao: 'Cidade. Ex.: São Paulo',
  paginas: 'Ex.: 45-67',
  numeroArtigo: 'Ex.: e20230012',
  edicao: 'Ex.: 3',
  tipoTrabalho: 'Ex.: Dissertação (Mestrado em Enfermagem)',
  numeroEvento: 'Ex.: 20',
  tituloAnais: 'Anais',
};

const ROTULO_FORM: Record<CampoForm, string> = {
  organizadores: 'Organizadores do livro',
  veiculo: 'Publicado em',
  edicao: 'Edição',
  localPublicacao: 'Local de publicação',
  editora: 'Editora',
  volume: 'Volume',
  numero: 'Número (fascículo)',
  paginas: 'Páginas',
  numeroArtigo: 'Número do artigo',
  tipoTrabalho: 'Tipo do trabalho (grau e curso)',
  numeroEvento: 'Número do evento',
  anoEvento: 'Ano do evento',
  localEvento: 'Cidade do evento',
  tituloAnais: 'Título dos anais',
};

interface Estado {
  tipo: TipoPublicacao;
  titulo: string;
  subtitulo: string;
  autores: Autor[];
  organizadores: Autor[];
  papelOrganizadores: 'org.' | 'coord.' | 'ed.';
  ano: string;
  textos: Partial<Record<CampoForm, string>>;
  doi: string;
  url: string;
  dataAcesso: string;
  palavrasChave: string;
  tags: string[];
  statusLeitura: StatusLeitura;
  observacoes: string;
}

function estadoInicial(f?: Fonte, nomesTags?: Map<string, string>): Estado {
  const textos: Estado['textos'] = {};
  if (f) {
    for (const c of Object.keys(ROTULO_FORM) as CampoForm[]) {
      const v = f[c];
      if (typeof v === 'string' || typeof v === 'number') textos[c] = String(v);
    }
  }
  return {
    tipo: f?.tipo ?? 'artigo_periodico',
    titulo: f?.titulo ?? '',
    subtitulo: f?.subtitulo ?? '',
    autores: f?.autores?.length ? f.autores : [{ tipo: 'pessoa', sobrenome: '', prenomes: '' }],
    organizadores: f?.organizadores?.length ? f.organizadores : [{ tipo: 'pessoa', sobrenome: '', prenomes: '' }],
    papelOrganizadores: f?.papelOrganizadores ?? 'org.',
    ano: f?.ano ? String(f.ano) : '',
    textos,
    doi: f?.doi ?? '',
    url: f?.url ?? '',
    dataAcesso: f?.dataAcesso ?? '',
    palavrasChave: f?.palavrasChave?.join('; ') ?? '',
    tags: (f?.tagIds ?? []).map((id) => nomesTags?.get(id)).filter((n): n is string => !!n),
    statusLeitura: f?.statusLeitura ?? 'nao_iniciado',
    observacoes: f?.observacoes ?? '',
  };
}

function EditorAutores({ titulo, autores, aoMudar, erros, prefixoErro, dica }: { titulo: string; autores: Autor[]; aoMudar: (a: Autor[]) => void; erros: Record<string, string>; prefixoErro: string; dica?: ReactNode }) {
  const mudar = (i: number, p: Partial<Autor>) => aoMudar(autores.map((a, j) => (j === i ? { ...a, ...p } : a)));
  const mover = (i: number, d: -1 | 1) => {
    const l = [...autores];
    [l[i], l[i + d]] = [l[i + d], l[i]];
    aoMudar(l);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-[13px] font-medium text-marinho-700">{titulo}</legend>
      {dica && <p className="-mt-1 mb-1 text-xs text-cinza-500">{dica}</p>}
      {autores.map((a, i) => {
        const erro = erros[`${prefixoErro}.${i}`];
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <span className="w-5 shrink-0 text-right text-xs text-cinza-500">{i + 1}.</span>
              <Selecao aria-label={`Tipo do autor ${i + 1}`} value={a.tipo} onChange={(e) => mudar(i, { tipo: e.target.value as Autor['tipo'] })} className="w-32 flex-none">
                <option value="pessoa">Pessoa</option>
                <option value="entidade">Entidade</option>
              </Selecao>
              <div className="order-last flex basis-full gap-2 pl-7 sm:order-none sm:basis-auto sm:flex-1 sm:pl-0">
              {a.tipo === 'pessoa' ? (
                <>
                  <Entrada aria-label={`Sobrenome do autor ${i + 1}`} placeholder="Sobrenome" value={a.sobrenome} onChange={(e) => mudar(i, { sobrenome: e.target.value })} aria-invalid={!!erro} className="min-w-0 flex-1" />
                  <Entrada aria-label={`Prenomes do autor ${i + 1}`} placeholder="Prenomes" value={a.prenomes ?? ''} onChange={(e) => mudar(i, { prenomes: e.target.value })} className="min-w-0 flex-1" />
                </>
              ) : (
                <Entrada aria-label={`Nome da entidade ${i + 1}`} placeholder="Ex.: Brasil. Ministério da Saúde" value={a.sobrenome} onChange={(e) => mudar(i, { sobrenome: e.target.value, prenomes: undefined })} aria-invalid={!!erro} className="min-w-0 flex-1" />
              )}
              </div>
              <div className="ml-auto flex shrink-0 sm:ml-0">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-1.5 text-cinza-500 hover:bg-cinza-100 disabled:opacity-30" aria-label="Mover para cima"><ArrowUp size={15} /></button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === autores.length - 1} className="rounded p-1.5 text-cinza-500 hover:bg-cinza-100 disabled:opacity-30" aria-label="Mover para baixo"><ArrowDown size={15} /></button>
                <button type="button" onClick={() => aoMudar(autores.length > 1 ? autores.filter((_, j) => j !== i) : [{ tipo: 'pessoa', sobrenome: '', prenomes: '' }])} className="rounded p-1.5 text-cinza-500 hover:bg-perigo-50 hover:text-perigo-700" aria-label="Remover"><Trash2 size={15} /></button>
              </div>
            </div>
            {erro && <p role="alert" className="pl-7 text-xs text-perigo-700">{erro}</p>}
          </div>
        );
      })}
      <div className="pl-7">
        <Botao tamanho="p" variante="fantasma" onClick={() => aoMudar([...autores, { tipo: 'pessoa', sobrenome: '', prenomes: '' }])} className="-ml-2.5"><Plus size={14} /> Adicionar</Botao>
      </div>
    </fieldset>
  );
}

function EditorTags({ tags, aoMudar, sugestoes }: { tags: string[]; aoMudar: (t: string[]) => void; sugestoes: string[] }) {
  const [texto, setTexto] = useState('');
  const adicionar = () => {
    const t = texto.replace(/\s+/g, ' ').trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) aoMudar([...tags, t]);
    setTexto('');
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Entrada
          id="tags"
          list="sugestoes-tags"
          placeholder="Digite e tecle Enter (ex.: Humanização)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              adicionar();
            }
          }}
        />
        <Botao onClick={adicionar} disabled={!texto.trim()}>Adicionar</Botao>
        <datalist id="sugestoes-tags">{sugestoes.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded bg-cinza-100 py-0.5 pl-2 pr-1 text-xs font-medium text-marinho-700">
              {t}
              <button type="button" onClick={() => aoMudar(tags.filter((x) => x !== t))} className="rounded p-0.5 hover:bg-borda-forte/50" aria-label={`Remover ${t}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, children, descricao }: { titulo: string; children: ReactNode; descricao?: string }) {
  return (
    <Cartao className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {descricao && <p className="mt-0.5 text-xs text-cinza-500">{descricao}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </Cartao>
  );
}

export function FormularioFonte() {
  const projeto = useProjetoObrigatorio();
  const { id } = useParams();
  const navegar = useNavigate();
  const avisar = useAvisos();

  const carregado = useLiveQuery(async () => {
    const tags = await db.tags.where('projetoId').equals(projeto.id).toArray();
    const fonte = id ? await db.fontes.get(id) : undefined;
    return { tags, fonte };
  }, [projeto.id, id]);

  const [e, setE] = useState<Estado | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [duplicatas, setDuplicatas] = useState<{ fonte: Fonte; motivo: string }[] | null>(null);
  const nomesTags = useMemo(() => new Map((carregado?.tags ?? []).map((t) => [t.id, t.nome])), [carregado?.tags]);

  useEffect(() => {
    if (carregado && !e) setE(estadoInicial(carregado.fonte, nomesTags));
  }, [carregado, e, nomesTags]);

  if (!carregado || !e) return null;
  if (id && !carregado.fonte) {
    return <p className="text-sm text-cinza-600">Fonte não encontrada. <Link to="/biblioteca" className="text-acao-700 hover:underline">Voltar à biblioteca</Link></p>;
  }
  const editando = !!carregado.fonte;
  const visiveis = CAMPOS_POR_TIPO[e.tipo];
  const set = (p: Partial<Estado>) => setE({ ...e, ...p });
  const setTexto = (c: CampoForm, v: string) => setE({ ...e, textos: { ...e.textos, [c]: v } });

  function montarDados(est: Estado, tagIds: string[]): DadosFonte {
    const n = (s?: string) => (s?.trim() ? Number(s) : undefined);
    const d: DadosFonte = {
      tipo: est.tipo,
      titulo: est.titulo,
      subtitulo: est.subtitulo,
      autores: est.autores,
      ano: n(est.ano),
      doi: est.doi,
      url: est.url,
      dataAcesso: est.dataAcesso,
      palavrasChave: est.palavrasChave.split(/[;\n]/),
      tagIds,
      statusLeitura: est.statusLeitura,
      observacoes: est.observacoes,
      origemMetadados: carregado?.fonte?.origemMetadados ?? 'manual',
      resumo: carregado?.fonte?.resumo,
    };
    // Só os campos que fazem sentido para o tipo escolhido são salvos.
    for (const c of visiveis) {
      if (c === 'organizadores') {
        d.organizadores = est.organizadores;
        d.papelOrganizadores = est.papelOrganizadores;
      } else if (c === 'anoEvento') d.anoEvento = n(est.textos.anoEvento);
      else (d as unknown as Record<string, unknown>)[c] = est.textos[c];
    }
    return d;
  }

  async function salvar(confirmouDuplicata = false) {
    if (!e) return;
    setSalvando(true);
    setErros({});
    try {
      const previa = montarDados(e, []);
      if (!confirmouDuplicata) {
        const achados = await verificarDuplicatas(projeto.id, previa, carregado?.fonte?.id);
        if (achados.length) {
          const motivo = { doi: 'mesmo DOI', url: 'mesmo endereço (URL)', metadados: 'mesmo título, ano e autor' } as const;
          setDuplicatas(achados.map((a) => ({ fonte: a.fonte, motivo: motivo[a.duplicata.motivo] })));
          return;
        }
      }
      const tagIds = [];
      for (const nome of e.tags) tagIds.push((await obterOuCriarTag(projeto.id, nome)).id);
      const dados = montarDados(e, tagIds);
      if (carregado?.fonte) {
        await atualizarFonte(carregado.fonte.id, dados);
        avisar('sucesso', 'Alterações salvas.');
        navegar(`/biblioteca/${carregado.fonte.id}`);
      } else {
        const nova = await criarFonte(projeto.id, dados);
        avisar('sucesso', 'Fonte cadastrada.');
        navegar(`/biblioteca/${nova.id}`);
      }
    } catch (err) {
      if (err instanceof ErroDeValidacao) {
        setErros(err.erros);
        avisar('erro', err.message);
        requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      } else {
        avisar('erro', `Não foi possível salvar: ${(err as Error).message}`);
      }
    } finally {
      setSalvando(false);
    }
  }

  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    void salvar();
  };

  const campoTexto = (c: CampoForm) => (
    <Campo key={c} rotulo={c === 'veiculo' ? ROTULO_VEICULO[e.tipo] ?? ROTULO_FORM.veiculo : ROTULO_FORM[c]} id={c} erro={erros[c]}>
      <Entrada id={c} inputMode={c === 'anoEvento' ? 'numeric' : undefined} value={e.textos[c] ?? ''} onChange={(ev) => setTexto(c, ev.target.value)} placeholder={PLACEHOLDER[c]} aria-invalid={!!erros[c]} />
    </Campo>
  );

  const voltarPara = editando ? `/biblioteca/${carregado.fonte!.id}` : '/biblioteca';

  return (
    <form onSubmit={enviar} noValidate className="max-w-3xl">
      <CabecalhoPagina
        titulo={editando ? 'Editar fonte' : 'Cadastrar fonte'}
        descricao={editando ? undefined : 'Preencha o que você souber. Os dados faltantes serão apontados na referência.'}
        voltar={<BotaoLink para={voltarPara} variante="fantasma" className="-ml-2"><ArrowLeft size={16} /> Voltar</BotaoLink>}
      />

      <div className="flex flex-col gap-4">
        <Secao titulo="Identificação">
          <Campo rotulo="Tipo de publicação" id="tipo">
            <Selecao id="tipo" value={e.tipo} onChange={(ev) => set({ tipo: ev.target.value as TipoPublicacao })} className="sm:w-72">
              {(Object.keys(ROTULO_TIPO) as TipoPublicacao[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Título" id="titulo" obrigatorio erro={erros.titulo} dica="Sem o subtítulo. Ex.: Pedagogia da autonomia">
            <Entrada id="titulo" value={e.titulo} onChange={(ev) => set({ titulo: ev.target.value })} aria-invalid={!!erros.titulo} autoFocus={!editando} />
          </Campo>
          <Campo rotulo="Subtítulo" id="subtitulo" dica="O que vem depois dos dois-pontos no título, se houver.">
            <Entrada id="subtitulo" value={e.subtitulo} onChange={(ev) => set({ subtitulo: ev.target.value })} />
          </Campo>
          <EditorAutores
            titulo="Autoria"
            autores={e.autores}
            aoMudar={(autores) => set({ autores })}
            erros={erros}
            prefixoErro="autores"
            dica={<>Na ordem em que aparecem na publicação. Ex.: “Maria A. Silva” → sobrenome <em>Silva</em>, prenomes <em>Maria A.</em> Sobrenomes como “Filho” e “Júnior” ficam junto: <em>Silva Filho</em>.</>}
          />
          <Campo rotulo="Ano de publicação" id="ano" erro={erros.ano} className="sm:w-40">
            <Entrada id="ano" inputMode="numeric" value={e.ano} onChange={(ev) => set({ ano: ev.target.value.replace(/\D/g, '').slice(0, 4) })} aria-invalid={!!erros.ano} placeholder="Ex.: 2021" />
          </Campo>
        </Secao>

        <Secao titulo="Publicação" descricao={`Campos usados na referência de ${ROTULO_TIPO[e.tipo].toLowerCase()}.`}>
          {visiveis.includes('organizadores') && (
            <div className="flex flex-col gap-2">
              <EditorAutores titulo="Organizadores do livro" autores={e.organizadores} aoMudar={(organizadores) => set({ organizadores })} erros={erros} prefixoErro="organizadores" />
              <Campo rotulo="Função" id="papel" className="pl-7 sm:w-56">
                <Selecao id="papel" value={e.papelOrganizadores} onChange={(ev) => set({ papelOrganizadores: ev.target.value as Estado['papelOrganizadores'] })}>
                  <option value="org.">Organizador (org.)</option>
                  <option value="coord.">Coordenador (coord.)</option>
                  <option value="ed.">Editor (ed.)</option>
                </Selecao>
              </Campo>
            </div>
          )}
          {visiveis.includes('veiculo') && campoTexto('veiculo')}
          {visiveis.includes('tipoTrabalho') && campoTexto('tipoTrabalho')}
          <div className="grid gap-4 sm:grid-cols-3">
            {visiveis.filter((c) => !['organizadores', 'veiculo', 'tipoTrabalho'].includes(c)).map(campoTexto)}
          </div>
        </Secao>

        <Secao titulo="Acesso online" descricao="Para documentos consultados na internet, a ABNT exige o endereço e a data de acesso.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="DOI" id="doi" erro={erros.doi} dica="Ex.: 10.1590/s0034-89102010000100001">
              <Entrada id="doi" value={e.doi} onChange={(ev) => set({ doi: ev.target.value })} aria-invalid={!!erros.doi} />
            </Campo>
            <Campo rotulo="Data de acesso" id="dataAcesso" erro={erros.dataAcesso}>
              <div className="flex gap-2">
                <Entrada id="dataAcesso" type="date" max={hojeIso()} value={e.dataAcesso} onChange={(ev) => set({ dataAcesso: ev.target.value })} aria-invalid={!!erros.dataAcesso} />
                <Botao onClick={() => set({ dataAcesso: hojeIso() })}>Hoje</Botao>
              </div>
            </Campo>
          </div>
          <Campo rotulo="URL (endereço)" id="url" erro={erros.url}>
            <Entrada id="url" type="url" inputMode="url" placeholder="https://" value={e.url} onChange={(ev) => set({ url: ev.target.value })} aria-invalid={!!erros.url} />
          </Campo>
        </Secao>

        <Secao titulo="Organização">
          <Campo rotulo="Temas e tags" id="tags" dica="Use para agrupar fontes por assunto. Ex.: Comunicação, Segurança do paciente.">
            <EditorTags tags={e.tags} aoMudar={(tags) => set({ tags })} sugestoes={[...nomesTags.values()]} />
          </Campo>
          <Campo rotulo="Palavras-chave da publicação" id="palavras" dica="Separe com ponto e vírgula.">
            <Entrada id="palavras" value={e.palavrasChave} onChange={(ev) => set({ palavrasChave: ev.target.value })} placeholder="Ex.: radioterapia; humanização; enfermagem" />
          </Campo>
          <Campo rotulo="Status de leitura" id="status" className="sm:w-56">
            <Selecao id="status" value={e.statusLeitura} onChange={(ev) => set({ statusLeitura: ev.target.value as StatusLeitura })}>
              {ORDEM_STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS_LEITURA[s]}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Observações gerais" id="obs">
            <AreaTexto id="obs" value={e.observacoes} onChange={(ev) => set({ observacoes: ev.target.value })} rows={3} />
          </Campo>
        </Secao>
      </div>

      <div className={cx('sticky bottom-0 -mx-4 mt-6 flex items-center gap-2 border-t border-borda bg-fundo/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-b-lg sm:border-x-0')}>
        <Botao type="submit" variante="primario" disabled={salvando}>{editando ? 'Salvar alterações' : 'Cadastrar fonte'}</Botao>
        <BotaoLink para={voltarPara} variante="fantasma">Cancelar</BotaoLink>
        {Object.keys(erros).length > 0 && <span className="ml-auto flex items-center gap-1.5 text-xs text-perigo-700"><Info size={14} /> Revise os campos destacados</span>}
      </div>

      <Confirmacao
        aberto={!!duplicatas}
        titulo="Possível fonte repetida"
        textoConfirmar="Salvar mesmo assim"
        aoCancelar={() => setDuplicatas(null)}
        aoConfirmar={() => {
          setDuplicatas(null);
          void salvar(true);
        }}
      >
        <p className="mb-3">Encontramos {duplicatas?.length === 1 ? 'uma fonte parecida' : 'fontes parecidas'} neste projeto:</p>
        <ul className="flex flex-col gap-2">
          {duplicatas?.map(({ fonte, motivo }) => (
            <li key={fonte.id} className="rounded-md border border-borda px-3 py-2">
              <Link to={`/biblioteca/${fonte.id}`} target="_blank" className="font-medium text-acao-700 hover:underline">{fonte.titulo}</Link>
              <span className="block text-xs text-cinza-500">{[autoresCurtos(fonte.autores), fonte.ano].filter(Boolean).join(' · ')}</span>
              <Selo tom="alerta" className="mt-1">{motivo}</Selo>
            </li>
          ))}
        </ul>
      </Confirmacao>
    </form>
  );
}
