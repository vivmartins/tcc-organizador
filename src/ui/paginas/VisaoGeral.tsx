import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileUp, MessagesSquare, Quote, Library, NotebookPen, ListTodo, CalendarClock, ArrowRight, Plus, Link2, Fingerprint,
  FileText, FileSearch, ListChecks, Lightbulb, FolderOpen, ChevronRight, TrendingUp, Pencil, Check, CalendarDays,
} from 'lucide-react';
import { db, type Fonte, type Fichamento, type Etapa, type Tarefa } from '../../data/db.ts';
import { alterarStatusTarefa } from '../../data/planejamento.ts';
import { AjudaSecao } from '../ajuda/AjudaSecao.tsx';
import { useProjetoObrigatorio } from '../projetoAtivo.tsx';
import { Cartao, BotaoLink, Selo, cx } from '../componentes/base.tsx';
import { dataCurta, diasAte, hojeIso, plural } from '../util.ts';
import { etapaAtual as calcularEtapaAtual, progresso, progressoPorEtapa, situacaoTarefa, ordenarTarefas } from '../../domain/planejamento.ts';
import { ROTULO_STATUS_LEITURA, TOM_STATUS_LEITURA, autoresCurtos } from './biblioteca/rotulos.ts';

const CHAVE_NOME = 'nomePessoa';
const UMA_SEMANA = 7 * 24 * 60 * 60 * 1000;

const DICAS = [
  'Mantenha suas anotações sempre ligadas à fonte original. Isso facilita a revisão e evita perder a página de uma citação.',
  'Ao copiar um trecho para o fichamento, anote a página na hora. Procurar depois toma muito mais tempo.',
  'Confira os dados de cada referência com a publicação original: título, ano e periódico são os erros mais comuns.',
  'Faça backup toda semana. Seus dados ficam só neste navegador.',
  'Citação direta com mais de 3 linhas vai em parágrafo próprio, com recuo de 4 cm, letra menor e sem aspas.',
  'Antes de entregar, envie o arquivo na Auditoria do TCC para conferir citações e referências.',
  'Registre o que o orientador pediu logo depois da reunião e transforme em tarefa com prazo.',
];

/** "Silva et al. (2023)" */
function autorAno(f: Fonte) {
  const a = autoresCurtos(f.autores);
  const curto = a.includes(',') || a.includes(' e ') ? `${a.split(/,| e /)[0]} et al.` : a;
  return [curto, f.ano ? `(${f.ano})` : ''].filter(Boolean).join(' ') || '—';
}

function Titulo({ titulo, para, rotuloLink = 'Ver todos', sub }: { titulo: string; para?: string; rotuloLink?: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div>
        <h2 className="text-base font-bold tracking-tight">{titulo}</h2>
        {sub && <p className="mt-0.5 text-sm text-cinza-500">{sub}</p>}
      </div>
      {para && <Link to={para} className="mt-0.5 flex shrink-0 items-center gap-1 text-sm font-medium text-acao-700 hover:underline">{rotuloLink} <ArrowRight size={14} /></Link>}
    </div>
  );
}

const TONS_ICONE = {
  azul: 'bg-acao-50 text-acao-600',
  laranja: 'bg-alerta-50 text-alerta-700',
  verde: 'bg-sucesso-50 text-sucesso-700',
} as const;

function Indicador({ rotulo, valor, detalhe, icone, tom, para }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; icone: ReactNode; tom: keyof typeof TONS_ICONE; para?: string }) {
  const conteudo = (
    <div className="flex gap-3.5">
      <span className={cx('flex size-11 shrink-0 items-center justify-center rounded-md', TONS_ICONE[tom])}>{icone}</span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-cinza-600">{rotulo}</div>
        <div className="mt-1 text-2xl font-extrabold tracking-tight">{valor}</div>
        {detalhe && <div className="mt-1 text-xs text-cinza-500">{detalhe}</div>}
      </div>
    </div>
  );
  const classe = 'block rounded-lg border border-borda bg-superficie p-4';
  return para ? <Link to={para} className={cx(classe, 'hover:border-borda-forte')}>{conteudo}</Link> : <div className={classe}>{conteudo}</div>;
}

function Saudacao() {
  const nome = useLiveQuery(async () => ((await db.config.get(CHAVE_NOME))?.valor as string | undefined) ?? '', []);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  if (nome === undefined) return <div className="h-16" />;
  async function salvar() {
    const v = valor.trim();
    if (v) await db.config.put({ chave: CHAVE_NOME, valor: v });
    else await db.config.delete(CHAVE_NOME);
    setEditando(false);
  }
  return (
    <div className="min-w-0">
      {editando ? (
        <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="flex flex-wrap items-center gap-2">
          <label htmlFor="nome-pessoa" className="sr-only">Como você quer ser chamado(a)?</label>
          <input id="nome-pessoa" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Seu nome" className="w-56 rounded-md border border-borda-forte bg-superficie px-3 py-2 text-lg font-semibold" />
          <button type="submit" className="flex items-center gap-1 rounded-md bg-acao-600 px-3 py-2 text-sm font-semibold text-white"><Check size={15} /> Salvar</button>
        </form>
      ) : (
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-tight text-marinho-900 sm:text-[28px]">
          {nome ? `Olá, ${nome}!` : 'Olá!'}
          <button onClick={() => { setValor(nome); setEditando(true); }} className="rounded p-1 text-cinza-500 hover:bg-cinza-100 hover:text-marinho-900" aria-label={nome ? 'Mudar como você é chamado(a)' : 'Dizer como você quer ser chamado(a)'} title={nome ? 'Mudar o nome' : 'Como você quer ser chamado(a)?'}>
            <Pencil size={15} />
          </button>
        </h1>
      )}
      <p className="mt-1 text-[15px] text-cinza-600">Aqui está o resumo do seu progresso no TCC.</p>
    </div>
  );
}

function SituacaoEtapa({ etapa, atual, tarefas, hoje }: { etapa: Etapa; atual: boolean; tarefas: Tarefa[]; hoje: string }) {
  const p = progressoPorEtapa([etapa], tarefas)[0];
  if (p.total > 0 && p.concluidas === p.total) return <Selo tom="sucesso" className="shrink-0 whitespace-nowrap">Concluída</Selo>;
  if (atual) return <Selo tom="acao" className="shrink-0 whitespace-nowrap">Em andamento</Selo>;
  if (etapa.dataFim && etapa.dataFim < hoje) return <Selo tom="perigo" className="shrink-0 whitespace-nowrap">Atrasada</Selo>;
  return <Selo className="shrink-0 whitespace-nowrap">Pendente</Selo>;
}

function TarefaMarcavel({ t, etapa, hoje }: { t: Tarefa; etapa?: string; hoje: string }) {
  const [marcada, setMarcada] = useState(t.status === 'concluida');
  const atrasada = situacaoTarefa(t, hoje) === 'atrasada';
  return (
    <li className="flex gap-3 py-3">
      <input
        type="checkbox"
        checked={marcada}
        onChange={async (e) => { setMarcada(e.target.checked); await alterarStatusTarefa(t.id, e.target.checked ? 'concluida' : 'a_fazer'); }}
        aria-label={`Concluir: ${t.titulo}`}
        className="mt-0.5 size-[18px] shrink-0 accent-acao-600"
      />
      <div className="min-w-0">
        <p className={cx('text-sm', marcada && 'text-cinza-500 line-through')}>{t.titulo}</p>
        <p className={cx('mt-0.5 text-xs', atrasada && !marcada ? 'text-perigo-700' : 'text-cinza-500')}>
          {[t.prazo ? `${atrasada && !marcada ? 'Atrasada · ' : ''}prazo ${dataCurta(t.prazo)}` : null, etapa].filter(Boolean).join(' · ')}
        </p>
      </div>
    </li>
  );
}

function trechoDaFicha(f: Fichamento) {
  if (f.trechoOriginal) return `“${f.trechoOriginal}”`;
  return f.parafrase || f.interpretacao || '';
}

export function VisaoGeral() {
  const projeto = useProjetoObrigatorio();
  const dados = useLiveQuery(async () => {
    const id = projeto.id;
    const [fontes, fichamentos, tarefas, etapas, tags] = await Promise.all([
      db.fontes.where('projetoId').equals(id).toArray(),
      db.fichamentos.where('projetoId').equals(id).toArray(),
      db.tarefas.where('projetoId').equals(id).toArray(),
      db.etapas.where('projetoId').equals(id).sortBy('ordem'),
      db.tags.where('projetoId').equals(id).toArray(),
    ]);
    return { fontes, fichamentos, tarefas, etapas, tags };
  }, [projeto.id]);

  if (!dados) return null;
  const { fontes, fichamentos, tarefas, etapas, tags } = dados;
  const hoje = hojeIso();
  const semanaPassada = new Date(Date.now() - UMA_SEMANA).toISOString();
  const nomesTags = new Map(tags.map((t) => [t.id, t.nome]));
  const fontePorId = new Map(fontes.map((f) => [f.id, f]));
  const nomeEtapa = new Map(etapas.map((e) => [e.id, e.nome]));
  const fontesRecentes = [...fontes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 5);
  const fichasRecentes = [...fichamentos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 4);
  const emAndamento = tarefas.filter((t) => t.status === 'em_andamento').length;
  const concluidasHoje = tarefas.filter((t) => t.status === 'concluida' && t.concluidaEm?.slice(0, 10) === hoje);
  const proximas = [...concluidasHoje, ...ordenarTarefas(tarefas.filter((t) => t.status !== 'concluida'))].slice(0, 5);
  const etapaAtual = calcularEtapaAtual(etapas, tarefas, hoje);
  const progressoGeral = progresso(tarefas);
  const lidas = fontes.filter((f) => f.statusLeitura === 'lido' || f.statusLeitura === 'revisado').length;
  const fontesSemana = fontes.filter((f) => f.criadoEm >= semanaPassada).length;
  const fichasSemana = fichamentos.filter((f) => f.criadoEm >= semanaPassada).length;
  const dica = DICAS[Math.floor(Date.now() / 86_400_000) % DICAS.length];

  let prazoValor: ReactNode = 'Não definido';
  let prazoDetalhe: ReactNode = 'Defina em Dados do projeto';
  if (projeto.prazoFinal) {
    const d = diasAte(projeto.prazoFinal);
    prazoValor = dataCurta(projeto.prazoFinal);
    prazoDetalhe = <span className="flex items-center gap-1"><CalendarDays size={13} /> {d > 0 ? `em ${plural(d, 'dia', 'dias')}` : d === 0 ? 'é hoje' : `passou há ${plural(-d, 'dia', 'dias')}`}</span>;
  }
  const novidade = (n: number, alternativa?: string) =>
    n > 0 ? <span className="flex items-center gap-1 font-medium text-sucesso-700"><TrendingUp size={13} /> +{n} esta semana</span> : alternativa;

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <Saudacao />
        <Link to="/projeto" className="flex items-center gap-3 rounded-lg border border-borda bg-superficie p-3.5 pr-4 hover:border-borda-forte xl:max-w-md">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-acao-50 text-acao-600"><FolderOpen size={19} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-cinza-500">{projeto.tema ? projeto.nome : 'Projeto de pesquisa'}</span>
            <span className="line-clamp-2 text-sm font-semibold">{projeto.tema || projeto.nome}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-md border border-borda px-2.5 py-1.5 text-xs font-medium text-acao-700">Ver detalhes <ArrowRight size={13} /></span>
        </Link>
      </div>
      <AjudaSecao secao="visao" />

      <div className="@container"><div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Coluna principal */}
        <div className="@container flex min-w-0 flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
            <Indicador rotulo="Fontes cadastradas" valor={fontes.length} tom="azul" icone={<FileText size={20} />} para="/biblioteca" detalhe={fontes.length ? <>{novidade(fontesSemana)}<span className="mt-0.5 block">{plural(lidas, 'lida ou revisada', 'lidas ou revisadas')}</span></> : undefined} />
            <Indicador rotulo="Fichamentos" valor={fichamentos.length} tom="laranja" icone={<NotebookPen size={20} />} para="/fichamentos" detalhe={novidade(fichasSemana)} />
            <Indicador rotulo="Tarefas em andamento" valor={emAndamento} tom="azul" icone={<ListTodo size={20} />} para="/planejamento" detalhe={tarefas.length ? `de ${tarefas.length} no total${progressoGeral.percentual !== null ? ` · ${progressoGeral.percentual}% concluído` : ''}` : undefined} />
            <Indicador rotulo="Prazo final" valor={prazoValor} tom="azul" icone={<CalendarClock size={20} />} detalhe={prazoDetalhe} para={projeto.prazoFinal ? undefined : '/projeto'} />
          </div>

          {fontes.length === 0 ? (
            <Cartao className="p-6">
              <h2 className="text-base font-bold">Primeiros passos</h2>
              <ol className="mt-3 flex flex-col gap-3 text-sm text-marinho-700">
                {[
                  ['Cadastre as fontes que você já tem', 'Artigos, livros, teses… pelo DOI, pelo link, pelo PDF ou à mão.', '/biblioteca/nova'],
                  ['Confira os dados e gere as referências ABNT', 'O app mostra o que está faltando ou precisa ser conferido.', null],
                  ['Monte o planejamento', 'Etapas, tarefas e prazos até a entrega, com um planejamento sugerido para começar.', '/planejamento'],
                  ['Faça um backup', 'Seus dados ficam só neste navegador. Guarde uma cópia no seu Drive.', '/dados'],
                ].map(([t, d, link], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-acao-50 text-xs font-semibold text-acao-700">{i + 1}</span>
                    <span>
                      {link ? <Link to={link} className="font-semibold text-acao-700 hover:underline">{t}</Link> : <span className="font-semibold">{t}</span>}
                      <span className="block text-cinza-600">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Cartao>
          ) : (
            <Cartao>
              <Titulo titulo="Sua biblioteca de pesquisas" sub="Últimos artigos adicionados" para="/biblioteca" />
              <div className="mt-3 overflow-x-auto px-5 pb-3">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-borda text-left text-xs text-cinza-500">
                      <th className="py-2 pr-3 font-medium">Título</th>
                      <th className="py-2 pr-3 font-medium">Autor / Ano</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borda">
                    {fontesRecentes.map((f) => (
                      <tr key={f.id} className="align-middle">
                        <td className="py-3 pr-3">
                          <Link to={`/biblioteca/${f.id}`} className="flex items-center gap-3 hover:text-acao-700">
                            <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-md', f.statusLeitura === 'lido' || f.statusLeitura === 'revisado' ? TONS_ICONE.verde : TONS_ICONE.azul)}><FileText size={17} /></span>
                            <span className="line-clamp-2 font-medium">{f.titulo || 'Sem título'}</span>
                          </Link>
                        </td>
                        <td className="whitespace-nowrap py-3 pr-3 text-cinza-600">{autorAno(f)}</td>
                        <td className="py-3 pr-3"><Selo tom={TOM_STATUS_LEITURA[f.statusLeitura]} className="whitespace-nowrap">{ROTULO_STATUS_LEITURA[f.statusLeitura]}</Selo></td>
                        <td className="py-3">
                          <span className="flex flex-wrap gap-1.5">
                            {f.tagIds.filter((id) => nomesTags.has(id)).slice(0, 2).map((id) => (
                              <span key={id} className="whitespace-nowrap rounded-full border border-borda bg-fundo px-2 py-0.5 text-xs text-cinza-600">{nomesTags.get(id)}</span>
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Cartao>
          )}

          <div className="grid gap-5 @2xl:grid-cols-2">
            <Cartao>
              <Titulo titulo="Fichamentos recentes" para="/fichamentos" />
              {fichasRecentes.length === 0 ? (
                <p className="px-5 pb-5 pt-3 text-sm text-cinza-500">Nenhum fichamento ainda. <Link to="/fichamentos" className="font-medium text-acao-700 hover:underline">Adicionar o primeiro</Link></p>
              ) : (
                <ul className="mt-2 divide-y divide-borda px-5 pb-2">
                  {fichasRecentes.map((f) => {
                    const fonte = fontePorId.get(f.fonteId);
                    return (
                      <li key={f.id}>
                        <Link to={`/biblioteca/${f.fonteId}`} className="flex items-center gap-3 py-3 hover:text-acao-700">
                          <span className={cx('flex size-9 shrink-0 items-center justify-center rounded-md', f.trechoOriginal ? TONS_ICONE.verde : TONS_ICONE.azul)}>{f.trechoOriginal ? <Quote size={16} /> : <NotebookPen size={16} />}</span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm">{trechoDaFicha(f)}</span>
                            <span className="mt-0.5 block truncate text-xs text-cinza-500">{[f.pagina ? `p. ${f.pagina}` : null, fonte ? autorAno(fonte) : null].filter(Boolean).join(' · ')}</span>
                          </span>
                          {f.tema && <span className="hidden max-w-[40%] shrink-0 truncate rounded-full border border-borda bg-fundo px-2 py-0.5 text-xs text-cinza-600 @3xl:inline">{f.tema}</span>}
                          <ChevronRight size={16} className="shrink-0 text-cinza-500" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Cartao>

            <Cartao>
              <Titulo titulo="Seu cronograma" para="/planejamento" />
              {etapas.length === 0 ? (
                <p className="px-5 pb-5 pt-3 text-sm text-cinza-500">Nenhuma etapa definida. <Link to="/planejamento" className="font-medium text-acao-700 hover:underline">Montar o planejamento</Link></p>
              ) : (
                <ol className="mt-3 px-5 pb-4">
                  {etapas.map((e, i) => {
                    const atual = etapaAtual?.id === e.id;
                    const p = progressoPorEtapa([e], tarefas)[0];
                    const feita = p.total > 0 && p.concluidas === p.total;
                    return (
                      <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {i < etapas.length - 1 && <span aria-hidden="true" className="absolute left-[9px] top-5 h-full w-0.5 bg-borda" />}
                        <span aria-hidden="true" className={cx('relative mt-0.5 size-5 shrink-0 rounded-full border-[3px] bg-superficie', feita ? 'border-sucesso-700' : atual ? 'border-acao-600' : 'border-borda-forte')} />
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{e.nome}</p>
                            <p className="text-xs text-cinza-500">{e.dataInicio || e.dataFim ? `${dataCurta(e.dataInicio) || '?'} – ${dataCurta(e.dataFim) || '?'}` : 'sem datas'}</p>
                          </div>
                          <SituacaoEtapa etapa={e} atual={atual} tarefas={tarefas} hoje={hoje} />
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Cartao>
          </div>
        </div>

        {/* Coluna lateral */}
        <aside aria-label="Atalhos" className="grid content-start gap-5 @3xl:grid-cols-2 @5xl:grid-cols-1">
          <Cartao>
            <Titulo titulo="Próximas tarefas" para="/planejamento" rotuloLink="Ver todas" />
            {proximas.length === 0 ? (
              <p className="px-5 pb-5 pt-3 text-sm text-cinza-500">Nenhuma tarefa pendente. <Link to="/planejamento" className="font-medium text-acao-700 hover:underline">Criar tarefa</Link></p>
            ) : (
              <ul className="divide-y divide-borda px-5 pb-1 pt-1">
                {proximas.map((t) => <TarefaMarcavel key={`${t.id}-${t.status}`} t={t} etapa={t.etapaId ? nomeEtapa.get(t.etapaId) : undefined} hoje={hoje} />)}
              </ul>
            )}
          </Cartao>

          <Cartao className="flex flex-col gap-2.5 p-4">
            <BotaoLink para="/biblioteca/nova?importar=doi" variante="primario" className="justify-center"><Plus size={16} /> Adicionar fonte</BotaoLink>
            <div className="grid grid-cols-2 gap-2.5">
              <BotaoLink para="/biblioteca/nova?importar=pdf" className="justify-center"><FileUp size={15} /> Importar do PDF</BotaoLink>
              <BotaoLink para="/biblioteca/nova?importar=doi" className="justify-center"><Fingerprint size={15} /> Importar por DOI</BotaoLink>
              <BotaoLink para="/biblioteca/nova?importar=link" className="justify-center"><Link2 size={15} /> Importar por link</BotaoLink>
              <BotaoLink para="/fichamentos" className="justify-center"><NotebookPen size={15} /> Nova anotação</BotaoLink>
            </div>
          </Cartao>

          <Cartao className="p-5">
            <h2 className="text-base font-bold tracking-tight">Acesso rápido</h2>
            <ul className="mt-3 flex flex-col gap-1">
              {[
                { para: '/biblioteca?referencias=1', icone: Library, texto: 'Gerar referências (ABNT)' },
                { para: '/auditoria', icone: FileSearch, texto: 'Verificar citações e referências' },
                { para: '/orientacoes?nova=1', icone: MessagesSquare, texto: 'Registrar orientação' },
                { para: '/conferencia', icone: ListChecks, texto: 'Checklist de entrega' },
              ].map(({ para, icone: Icone, texto }) => (
                <li key={para}>
                  <Link to={para} className="flex items-center gap-3 rounded-md px-1.5 py-2 text-sm hover:bg-fundo hover:text-acao-700">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-acao-50 text-acao-600"><Icone size={16} /></span>
                    {texto}
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>

          <section className="rounded-lg border border-acao-100 bg-acao-50 p-5">
            <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-acao-700"><Lightbulb size={18} /> Dica do dia</h2>
            <p className="mt-2 text-sm leading-relaxed text-marinho-700">{dica}</p>
          </section>
        </aside>
      </div></div>
    </>
  );
}
