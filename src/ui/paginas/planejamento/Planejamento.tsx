import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarCheck, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ListTodo, GanttChart, Layers, Sparkles, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { db, type Etapa, type Tarefa } from '../../../data/db.ts';
import { alterarStatusTarefa, excluirEtapa, excluirTarefa, moverEtapa, aplicarPlanejamentoSugerido } from '../../../data/planejamento.ts';
import { atualizarProjeto } from '../../../data/projetos.ts';
import {
  ROTULO_PRIORIDADE, ROTULO_STATUS_TAREFA, situacaoTarefa, progresso, progressoPorEtapa, ordenarTarefas,
  sugerirPlanejamento, periodoDoCronograma, posicaoNoPeriodo, diasEntre, type Situacao, type StatusTarefa, type Prioridade,
} from '../../../domain/planejamento.ts';
import { useProjetoObrigatorio } from '../../projetoAtivo.tsx';
import { Botao, CabecalhoPagina, Campo, Cartao, Entrada, EstadoVazio, Selecao, Selo, cx } from '../../componentes/base.tsx';
import { Confirmacao, Modal, useAvisos } from '../../componentes/dialogos.tsx';
import { AjudaSecao } from '../../ajuda/AjudaSecao.tsx';
import { dataCurta, hojeIso, plural } from '../../util.ts';
import { FormularioEtapa, FormularioTarefa } from './Formularios.tsx';

const ROTULO_SITUACAO: Record<Situacao, string> = { concluida: 'Concluída', atrasada: 'Atrasada', vence_em_breve: 'Vence em breve', no_prazo: 'No prazo', sem_prazo: 'Sem prazo' };
const COR_PRAZO: Record<Situacao, string> = { concluida: 'text-sucesso-700', atrasada: 'text-perigo-700 font-medium', vence_em_breve: 'text-alerta-700', no_prazo: 'text-cinza-600', sem_prazo: 'text-cinza-500' };
const COR_PONTO: Record<Situacao, string> = { concluida: 'bg-sucesso-700', atrasada: 'bg-perigo-700', vence_em_breve: 'bg-alerta-700', no_prazo: 'bg-acao-600', sem_prazo: 'bg-cinza-500' };
const TOM_PRIORIDADE: Record<Prioridade, 'perigo' | 'neutro' | 'neutro'> = { alta: 'perigo', media: 'neutro', baixa: 'neutro' };

function Barra({ percentual, className }: { percentual: number | null; className?: string }) {
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-cinza-100', className)} role="progressbar" aria-valuenow={percentual ?? 0} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-sucesso-700 transition-all" style={{ width: `${percentual ?? 0}%` }} />
    </div>
  );
}

function Indicador({ icone, rotulo, valor, detalhe, tom }: { icone: ReactNode; rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: string }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie p-4">
      <div className="flex items-center gap-2 text-[13px] text-cinza-600"><span className="text-cinza-500">{icone}</span>{rotulo}</div>
      <div className={cx('mt-2 text-2xl font-semibold tracking-tight', tom)}>{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-cinza-500">{detalhe}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------
// Lista de tarefas
// ---------------------------------------------------------------------
type FiltroPrazo = '' | 'atrasadas' | 'semana' | 'sem_prazo';

function ListaTarefas({ tarefas, etapas, hoje, aoEditar, aoNova }: { tarefas: Tarefa[]; etapas: Etapa[]; hoje: string; aoEditar: (t: Tarefa) => void; aoNova: () => void }) {
  const avisar = useAvisos();
  const [status, setStatus] = useState<StatusTarefa | '' | 'pendentes'>('');
  const [prazo, setPrazo] = useState<FiltroPrazo>('');
  const [prioridade, setPrioridade] = useState<Prioridade | ''>('');
  const [etapaId, setEtapaId] = useState('');
  const [excluindo, setExcluindo] = useState<Tarefa | null>(null);
  const nomeEtapa = new Map(etapas.map((e) => [e.id, e.nome]));

  const filtradas = ordenarTarefas(tarefas).filter((t) => {
    const sit = situacaoTarefa(t, hoje);
    if (status === 'pendentes' ? t.status === 'concluida' : status && t.status !== status) return false;
    if (prazo === 'atrasadas' && sit !== 'atrasada') return false;
    if (prazo === 'semana' && sit !== 'vence_em_breve') return false;
    if (prazo === 'sem_prazo' && t.prazo) return false;
    if (prioridade && t.prioridade !== prioridade) return false;
    if (etapaId === '_nenhuma' ? !!t.etapaId : etapaId && t.etapaId !== etapaId) return false;
    return true;
  });
  const filtrosAtivos = !!(status || prazo || prioridade || etapaId);

  if (tarefas.length === 0) {
    return <Cartao><EstadoVazio icone={<ListTodo size={20} />} titulo="Nenhuma tarefa ainda" acao={<Botao variante="primario" onClick={aoNova}><Plus size={16} /> Nova tarefa</Botao>}>Crie tarefas com prazo e prioridade. O progresso do TCC é calculado pelas tarefas concluídas.</EstadoVazio></Cartao>;
  }

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Selecao aria-label="Filtrar por status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">Todos os status</option>
          <option value="pendentes">Pendentes</option>
          {(['a_fazer', 'em_andamento', 'concluida'] as StatusTarefa[]).map((s) => <option key={s} value={s}>{ROTULO_STATUS_TAREFA[s]}</option>)}
        </Selecao>
        <Selecao aria-label="Filtrar por prazo" value={prazo} onChange={(e) => setPrazo(e.target.value as FiltroPrazo)}>
          <option value="">Todos os prazos</option>
          <option value="atrasadas">Atrasadas</option>
          <option value="semana">Próximos 7 dias</option>
          <option value="sem_prazo">Sem prazo</option>
        </Selecao>
        <Selecao aria-label="Filtrar por prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade | '')}>
          <option value="">Todas as prioridades</option>
          {(['alta', 'media', 'baixa'] as Prioridade[]).map((p) => <option key={p} value={p}>{ROTULO_PRIORIDADE[p]}</option>)}
        </Selecao>
        <Selecao aria-label="Filtrar por etapa" value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
          <option value="">Todas as etapas</option>
          {etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          <option value="_nenhuma">Sem etapa</option>
        </Selecao>
      </div>
      <p className="mb-3 flex gap-3 text-xs text-cinza-500">
        {filtrosAtivos ? `${plural(filtradas.length, 'tarefa encontrada', 'tarefas encontradas')} de ${tarefas.length}` : plural(tarefas.length, 'tarefa', 'tarefas')}
        {filtrosAtivos && <button className="text-acao-700 hover:underline" onClick={() => { setStatus(''); setPrazo(''); setPrioridade(''); setEtapaId(''); }}>Limpar filtros</button>}
      </p>
      <Cartao className="overflow-hidden">
        {filtradas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-cinza-500">Nenhuma tarefa com esses filtros.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {filtradas.map((t) => {
              const sit = situacaoTarefa(t, hoje);
              const feita = t.status === 'concluida';
              return (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-sucesso-700"
                    checked={feita}
                    aria-label={feita ? `Reabrir ${t.titulo}` : `Concluir ${t.titulo}`}
                    onChange={async () => { await alterarStatusTarefa(t.id, feita ? 'a_fazer' : 'concluida'); avisar('sucesso', feita ? 'Tarefa reaberta.' : 'Tarefa concluída. 🎉'); }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-sm font-medium', feita && 'text-cinza-500 line-through')}>{t.titulo}</p>
                    {t.descricao && <p className="mt-0.5 line-clamp-2 text-xs text-cinza-600">{t.descricao}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      {t.prazo && <span className={COR_PRAZO[sit]}>{sit === 'atrasada' ? `Atrasada · ${dataCurta(t.prazo)}` : feita ? `Concluída${t.concluidaEm ? ` em ${dataCurta(t.concluidaEm)}` : ''}` : `Prazo ${dataCurta(t.prazo)}`}</span>}
                      {!t.prazo && feita && <span className={COR_PRAZO.concluida}>Concluída{t.concluidaEm ? ` em ${dataCurta(t.concluidaEm)}` : ''}</span>}
                      {t.etapaId && nomeEtapa.has(t.etapaId) && <span className="text-cinza-500">· {nomeEtapa.get(t.etapaId)}</span>}
                      {t.prioridade === 'alta' && !feita && <Selo tom={TOM_PRIORIDADE.alta}>Prioridade alta</Selo>}
                    </p>
                  </div>
                  <Selecao aria-label={`Status de ${t.titulo}`} value={t.status} onChange={(e) => alterarStatusTarefa(t.id, e.target.value as StatusTarefa)} className="hidden h-8 w-36 text-xs sm:block">
                    {(['a_fazer', 'em_andamento', 'concluida'] as StatusTarefa[]).map((s) => <option key={s} value={s}>{ROTULO_STATUS_TAREFA[s]}</option>)}
                  </Selecao>
                  <div className="flex shrink-0">
                    <button onClick={() => aoEditar(t)} aria-label={`Editar ${t.titulo}`} className="rounded p-1.5 text-cinza-500 hover:bg-cinza-100 hover:text-marinho-900"><Pencil size={15} /></button>
                    <button onClick={() => setExcluindo(t)} aria-label={`Excluir ${t.titulo}`} className="rounded p-1.5 text-cinza-500 hover:bg-perigo-50 hover:text-perigo-700"><Trash2 size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
      <Confirmacao aberto={!!excluindo} titulo="Excluir tarefa?" textoConfirmar="Excluir" perigoso aoCancelar={() => setExcluindo(null)} aoConfirmar={async () => { const t = excluindo!; setExcluindo(null); await excluirTarefa(t.id); avisar('sucesso', 'Tarefa excluída.'); }}>
        <p><strong>{excluindo?.titulo}</strong> será apagada.</p>
      </Confirmacao>
    </>
  );
}

// ---------------------------------------------------------------------
// Cronograma
// ---------------------------------------------------------------------
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function Cronograma({ etapas, tarefas, hoje, inicioProjeto, fimProjeto }: { etapas: Etapa[]; tarefas: Tarefa[]; hoje: string; inicioProjeto?: string; fimProjeto?: string }) {
  const periodo = periodoDoCronograma([...etapas.flatMap((e) => [e.dataInicio, e.dataFim]), ...tarefas.map((t) => t.prazo)], inicioProjeto, fimProjeto);
  if (!periodo) {
    return <Cartao><EstadoVazio icone={<GanttChart size={20} />} titulo="Sem datas para mostrar">Defina datas nas etapas, prazos nas tarefas ou a data de início e o prazo final do projeto para ver o cronograma.</EstadoVazio></Cartao>;
  }
  const pos = (d: string) => posicaoNoPeriodo(d, periodo);
  const meses: { rotulo: string; x: number }[] = [];
  const [ai, mi] = periodo.inicio.split('-').map(Number);
  for (let a = ai, m = mi; ; m++) {
    if (m > 12) { m = 1; a++; }
    const iso = `${a}-${String(m).padStart(2, '0')}-01`;
    if (iso > periodo.fim) break;
    if (iso >= periodo.inicio) meses.push({ rotulo: m === 1 || meses.length === 0 ? `${MESES[m - 1]} ${String(a).slice(2)}` : MESES[m - 1], x: pos(iso) });
  }
  const linhas = [
    ...[...etapas].sort((a, b) => a.ordem - b.ordem).map((e) => ({ id: e.id, nome: e.nome, inicio: e.dataInicio, fim: e.dataFim, tarefas: tarefas.filter((t) => t.etapaId === e.id) })),
    ...(tarefas.some((t) => !t.etapaId && t.prazo) ? [{ id: '_sem', nome: 'Sem etapa', inicio: undefined, fim: undefined, tarefas: tarefas.filter((t) => !t.etapaId) }] : []),
  ];
  const mostrarHoje = hoje >= periodo.inicio && hoje <= periodo.fim;

  return (
    <Cartao className="overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[200px_1fr] border-b border-borda bg-fundo/60 text-[11px] uppercase tracking-wide text-cinza-500">
            <div className="px-4 py-2">Etapa</div>
            <div className="relative h-8">
              {meses.map((m) => <span key={m.x} className="absolute top-2 -translate-x-1/2 whitespace-nowrap" style={{ left: `${m.x}%` }}>{m.rotulo}</span>)}
            </div>
          </div>
          {linhas.map((l) => {
            const pr = progresso(l.tarefas);
            const temBarra = l.inicio && l.fim;
            return (
              <div key={l.id} className="grid grid-cols-[200px_1fr] border-b border-borda last:border-0">
                <div className="px-4 py-3">
                  <p className="truncate text-sm font-medium" title={l.nome}>{l.nome}</p>
                  <p className="text-xs text-cinza-500">{pr.percentual === null ? 'sem tarefas' : `${pr.percentual}% · ${pr.concluidas}/${pr.total}`}</p>
                </div>
                <div className="relative my-2 mr-4">
                  {meses.map((m) => <span key={m.x} className="absolute inset-y-0 w-px bg-borda/70" style={{ left: `${m.x}%` }} />)}
                  {mostrarHoje && <span className="absolute inset-y-0 z-10 w-0.5 bg-acao-600/70" style={{ left: `${pos(hoje)}%` }} title={`Hoje (${dataCurta(hoje)})`} />}
                  {fimProjeto && <span className="absolute inset-y-0 w-0.5 bg-perigo-700/50" style={{ left: `${pos(fimProjeto)}%` }} title={`Entrega final (${dataCurta(fimProjeto)})`} />}
                  {temBarra ? (
                    <div
                      className="absolute top-1.5 h-5 overflow-hidden rounded bg-acao-100"
                      style={{ left: `${pos(l.inicio!)}%`, width: `max(${pos(l.fim!) - pos(l.inicio!)}%, 6px)` }}
                      title={`${l.nome}: ${dataCurta(l.inicio)} a ${dataCurta(l.fim)}`}
                    >
                      <div className="h-full bg-acao-600/70" style={{ width: `${pr.percentual ?? 0}%` }} />
                    </div>
                  ) : l.id !== '_sem' && <span className="absolute top-2 text-xs text-cinza-500">sem datas</span>}
                  <div className="relative h-8">
                    {l.tarefas.filter((t) => t.prazo).map((t) => (
                      <span key={t.id} className={cx('absolute bottom-0 size-2 -translate-x-1/2 rounded-full ring-2 ring-superficie', COR_PONTO[situacaoTarefa(t, hoje)])} style={{ left: `${pos(t.prazo!)}%` }} title={`${t.titulo} — ${dataCurta(t.prazo)} (${ROTULO_SITUACAO[situacaoTarefa(t, hoje)]})`} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-borda px-4 py-2.5 text-xs text-cinza-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-acao-100" /> período da etapa (parte escura = concluído)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-acao-600" /> hoje</span>
        {fimProjeto && <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-perigo-700/60" /> entrega final</span>}
        {(['atrasada', 'vence_em_breve', 'no_prazo', 'concluida'] as Situacao[]).map((s) => <span key={s} className="flex items-center gap-1.5"><span className={cx('size-2 rounded-full', COR_PONTO[s])} /> {ROTULO_SITUACAO[s].toLowerCase()}</span>)}
      </div>
    </Cartao>
  );
}

// ---------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------
function ListaEtapas({ etapas, tarefas, aoEditar, aoNova }: { etapas: Etapa[]; tarefas: Tarefa[]; aoEditar: (e: Etapa) => void; aoNova: () => void }) {
  const avisar = useAvisos();
  const [excluindo, setExcluindo] = useState<Etapa | null>(null);
  const lista = progressoPorEtapa(etapas, tarefas);
  if (!lista.length) {
    return <Cartao><EstadoVazio icone={<Layers size={20} />} titulo="Nenhuma etapa definida" acao={<Botao variante="primario" onClick={aoNova}><Plus size={16} /> Nova etapa</Botao>}>Etapas agrupam tarefas e marcam entregas intermediárias, como “Projeto de pesquisa” ou “Versão para o orientador”.</EstadoVazio></Cartao>;
  }
  return (
    <>
      <Cartao className="overflow-hidden">
        <ul className="divide-y divide-borda">
          {lista.map(({ etapa: e, percentual, concluidas, total }, i) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cinza-100 text-xs font-semibold text-marinho-700">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.nome}</p>
                <p className="text-xs text-cinza-500">
                  {e.dataInicio || e.dataFim ? `${dataCurta(e.dataInicio) || '…'} a ${dataCurta(e.dataFim) || '…'}` : 'Sem datas'}
                  {' · '}{total ? `${concluidas} de ${plural(total, 'tarefa concluída', 'tarefas concluídas')}` : 'sem tarefas'}
                </p>
                <Barra percentual={percentual} className="mt-1.5 max-w-xs" />
              </div>
              {percentual === 100 && <CheckCircle2 size={18} className="shrink-0 text-sucesso-700" aria-label="Etapa concluída" />}
              <div className="flex shrink-0">
                <button disabled={i === 0} onClick={() => moverEtapa(e.id, -1)} aria-label={`Mover ${e.nome} para cima`} className="rounded p-1.5 text-cinza-500 hover:bg-cinza-100 disabled:opacity-30"><ArrowUp size={15} /></button>
                <button disabled={i === lista.length - 1} onClick={() => moverEtapa(e.id, 1)} aria-label={`Mover ${e.nome} para baixo`} className="rounded p-1.5 text-cinza-500 hover:bg-cinza-100 disabled:opacity-30"><ArrowDown size={15} /></button>
                <button onClick={() => aoEditar(e)} aria-label={`Editar ${e.nome}`} className="rounded p-1.5 text-cinza-500 hover:bg-cinza-100 hover:text-marinho-900"><Pencil size={15} /></button>
                <button onClick={() => setExcluindo(e)} aria-label={`Excluir ${e.nome}`} className="rounded p-1.5 text-cinza-500 hover:bg-perigo-50 hover:text-perigo-700"><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      </Cartao>
      <Confirmacao aberto={!!excluindo} titulo="Excluir etapa?" textoConfirmar="Excluir etapa" perigoso aoCancelar={() => setExcluindo(null)} aoConfirmar={async () => { const e = excluindo!; setExcluindo(null); await excluirEtapa(e.id); avisar('sucesso', 'Etapa excluída. As tarefas dela foram mantidas, sem etapa.'); }}>
        <p>A etapa <strong>{excluindo?.nome}</strong> será apagada. As tarefas dela <strong>não</strong> serão apagadas: elas ficam “sem etapa”.</p>
      </Confirmacao>
    </>
  );
}

// ---------------------------------------------------------------------
// Planejamento sugerido
// ---------------------------------------------------------------------
function ModalSugestao({ inicioInicial, fimInicial, aoFechar, aoAplicar }: { inicioInicial?: string; fimInicial?: string; aoFechar: () => void; aoAplicar: (inicio: string, fim: string) => Promise<void> }) {
  const [inicio, setInicio] = useState(inicioInicial ?? hojeIso());
  const [fim, setFim] = useState(fimInicial ?? '');
  const previa = useMemo(() => {
    if (!inicio || !fim) return { erro: null, etapas: [] };
    try { return { erro: null, etapas: sugerirPlanejamento(inicio, fim) }; } catch (e) { return { erro: (e as Error).message, etapas: [] }; }
  }, [inicio, fim]);
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Planejamento sugerido" largura="max-w-xl" rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" disabled={!previa.etapas.length} onClick={() => aoAplicar(inicio, fim)}>Criar este planejamento</Botao></>}>
      <p className="text-cinza-600">Um ponto de partida para TCCs de revisão de literatura. As etapas são distribuídas entre as datas abaixo, e <strong className="font-medium text-marinho-700">tudo pode ser editado, reordenado ou excluído depois</strong>.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Data de início" id="sug-inicio"><Entrada id="sug-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
        <Campo rotulo="Prazo final de entrega" id="sug-fim" erro={previa.erro ?? undefined}><Entrada id="sug-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} aria-invalid={!!previa.erro} /></Campo>
      </div>
      {previa.etapas.length > 0 && (
        <ol className="mt-4 flex flex-col gap-2">
          {previa.etapas.map((e, i) => (
            <li key={e.nome} className="rounded-md border border-borda px-3 py-2">
              <p className="flex justify-between gap-3 text-sm font-medium"><span>{i + 1}. {e.nome}</span><span className="shrink-0 text-xs font-normal text-cinza-500">{dataCurta(e.dataInicio)} – {dataCurta(e.dataFim)} ({diasEntre(e.dataInicio, e.dataFim) + 1} dias)</span></p>
              <p className="mt-0.5 text-xs text-cinza-500">{e.tarefas.map((t) => t.titulo).join(' · ')}</p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------
type Aba = 'tarefas' | 'cronograma' | 'etapas';

export function Planejamento() {
  const projeto = useProjetoObrigatorio();
  const avisar = useAvisos();
  const [aba, setAba] = useState<Aba>('tarefas');
  const [editandoTarefa, setEditandoTarefa] = useState<Tarefa | 'nova' | null>(null);
  const [editandoEtapa, setEditandoEtapa] = useState<Etapa | 'nova' | null>(null);
  const [sugerindo, setSugerindo] = useState(false);
  const hoje = hojeIso();

  const dados = useLiveQuery(async () => {
    const [etapas, tarefas] = await Promise.all([
      db.etapas.where('projetoId').equals(projeto.id).sortBy('ordem'),
      db.tarefas.where('projetoId').equals(projeto.id).toArray(),
    ]);
    return { etapas, tarefas };
  }, [projeto.id]);
  if (!dados) return null;
  const { etapas, tarefas } = dados;
  const geral = progresso(tarefas);
  const atrasadas = tarefas.filter((t) => situacaoTarefa(t, hoje) === 'atrasada').length;
  const semana = tarefas.filter((t) => situacaoTarefa(t, hoje) === 'vence_em_breve').length;
  const vazio = etapas.length === 0 && tarefas.length === 0;
  const diasEntrega = projeto.prazoFinal ? diasEntre(hoje, projeto.prazoFinal) : null;

  async function aplicarSugestao(inicio: string, fim: string) {
    try {
      await aplicarPlanejamentoSugerido(projeto.id, inicio, fim);
      if (!projeto.dataInicio || !projeto.prazoFinal) {
        await atualizarProjeto(projeto.id, { ...projeto, dataInicio: projeto.dataInicio ?? inicio, prazoFinal: projeto.prazoFinal ?? fim });
      }
      setSugerindo(false);
      avisar('sucesso', 'Planejamento criado. Ajuste o que quiser.');
    } catch (e) {
      avisar('erro', (e as Error).message);
    }
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Planejamento"
        descricao={<>Etapas, tarefas e prazos do seu TCC. <Link to="/projeto" className="text-acao-700 hover:underline">Datas do projeto</Link></>}
        acoes={!vazio && (
          <>
            <Botao onClick={() => setEditandoEtapa('nova')}><Layers size={15} /> Nova etapa</Botao>
            <Botao variante="primario" onClick={() => setEditandoTarefa('nova')}><Plus size={16} /> Nova tarefa</Botao>
          </>
        )}
      />
      <AjudaSecao secao="planejamento" />

      {vazio ? (
        <Cartao>
          <EstadoVazio
            icone={<CalendarCheck size={20} />}
            titulo="Monte o planejamento do seu TCC"
            acao={
              <div className="flex flex-wrap justify-center gap-2">
                <Botao variante="primario" onClick={() => setSugerindo(true)}><Sparkles size={15} /> Usar planejamento sugerido</Botao>
                <Botao onClick={() => setEditandoEtapa('nova')}>Começar do zero</Botao>
              </div>
            }
          >
            Você pode partir de um planejamento sugerido para revisão de literatura, com etapas e tarefas distribuídas até a sua entrega, ou criar as suas etapas do zero. Nenhum TCC é igual: tudo é editável.
          </EstadoVazio>
        </Cartao>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador icone={<CheckCircle2 size={15} />} rotulo="Progresso geral" valor={geral.percentual === null ? '—' : `${geral.percentual}%`} detalhe={<><Barra percentual={geral.percentual} className="mb-1.5" />{geral.total ? `${geral.concluidas} de ${plural(geral.total, 'tarefa concluída', 'tarefas concluídas')}` : 'crie tarefas para medir'}</>} />
            <Indicador icone={<AlertTriangle size={15} />} rotulo="Atrasadas" valor={atrasadas} tom={atrasadas ? 'text-perigo-700' : undefined} detalhe={atrasadas ? 'reveja os prazos ou conclua' : 'nada atrasado'} />
            <Indicador icone={<Clock size={15} />} rotulo="Próximos 7 dias" valor={semana} detalhe="tarefas com prazo chegando" />
            <Indicador icone={<CalendarCheck size={15} />} rotulo="Entrega final" valor={projeto.prazoFinal ? dataCurta(projeto.prazoFinal) : '—'} detalhe={diasEntrega === null ? <Link to="/projeto" className="text-acao-700 hover:underline">definir prazo</Link> : diasEntrega > 0 ? `faltam ${plural(diasEntrega, 'dia', 'dias')}` : diasEntrega === 0 ? 'é hoje' : `passou há ${plural(-diasEntrega, 'dia', 'dias')}`} />
          </div>

          <div role="tablist" aria-label="Visualizações" className="mb-4 flex gap-1 overflow-x-auto border-b border-borda">
            {([['tarefas', 'Tarefas', ListTodo], ['cronograma', 'Cronograma', GanttChart], ['etapas', 'Etapas', Layers]] as const).map(([id, rotulo, Icone]) => (
              <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={cx('-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors', aba === id ? 'border-acao-600 font-medium text-acao-700' : 'border-transparent text-cinza-600 hover:text-marinho-900')}>
                <Icone size={15} /> {rotulo}
              </button>
            ))}
          </div>

          {aba === 'tarefas' && <ListaTarefas tarefas={tarefas} etapas={etapas} hoje={hoje} aoEditar={setEditandoTarefa} aoNova={() => setEditandoTarefa('nova')} />}
          {aba === 'cronograma' && <Cronograma etapas={etapas} tarefas={tarefas} hoje={hoje} inicioProjeto={projeto.dataInicio} fimProjeto={projeto.prazoFinal} />}
          {aba === 'etapas' && <ListaEtapas etapas={etapas} tarefas={tarefas} aoEditar={setEditandoEtapa} aoNova={() => setEditandoEtapa('nova')} />}
        </>
      )}

      {editandoTarefa && <FormularioTarefa key={editandoTarefa === 'nova' ? 'nova' : editandoTarefa.id} projetoId={projeto.id} etapas={etapas} tarefa={editandoTarefa === 'nova' ? undefined : editandoTarefa} aoFechar={() => setEditandoTarefa(null)} />}
      {editandoEtapa && <FormularioEtapa key={editandoEtapa === 'nova' ? 'nova' : editandoEtapa.id} projetoId={projeto.id} etapa={editandoEtapa === 'nova' ? undefined : editandoEtapa} aoFechar={() => setEditandoEtapa(null)} />}
      {sugerindo && <ModalSugestao inicioInicial={projeto.dataInicio} fimInicial={projeto.prazoFinal} aoFechar={() => setSugerindo(false)} aoAplicar={aplicarSugestao} />}
    </>
  );
}
