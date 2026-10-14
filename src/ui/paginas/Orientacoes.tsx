import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { MessagesSquare, Plus, Pencil, Trash2, Search, AlertTriangle, Clock, CheckCircle2, Link2 } from 'lucide-react';
import { db, type Orientacao, type Tarefa } from '../../data/db.ts';
import { ErroDeValidacao } from '../../data/fontes.ts';
import { alterarStatusOrientacao, atualizarOrientacao, criarOrientacao, excluirOrientacao } from '../../data/orientacoes.ts';
import { ROTULO_ORIGEM, ROTULO_STATUS_ORIENTACAO, ordenarOrientacoes, situacaoOrientacao, type OrigemOrientacao, type StatusOrientacao } from '../../domain/orientacao.ts';
import { ROTULO_PRIORIDADE, ROTULO_STATUS_TAREFA, type Prioridade, type Situacao } from '../../domain/planejamento.ts';
import { corresponde, termosDaConsulta } from '../../domain/busca.ts';
import { useProjetoObrigatorio } from '../projetoAtivo.tsx';
import { AreaTexto, Botao, CabecalhoPagina, Campo, Cartao, Entrada, EstadoVazio, Selecao, Selo, cx } from '../componentes/base.tsx';
import { Confirmacao, Modal, useAvisos } from '../componentes/dialogos.tsx';
import { AjudaSecao } from '../ajuda/AjudaSecao.tsx';
import { dataCurta, hojeIso } from '../util.ts';

const COR_PRAZO: Record<Situacao, string> = { concluida: 'text-sucesso-700', atrasada: 'text-perigo-700 font-medium', vence_em_breve: 'text-alerta-700', no_prazo: 'text-cinza-600', sem_prazo: 'text-cinza-500' };
const TOM_STATUS: Record<StatusOrientacao, 'alerta' | 'acao' | 'sucesso'> = { pendente: 'alerta', em_andamento: 'acao', concluida: 'sucesso' };

function Formulario({ projetoId, tarefas, orientacao, aoFechar }: { projetoId: string; tarefas: Tarefa[]; orientacao?: Orientacao; aoFechar: () => void }) {
  const avisar = useAvisos();
  const hoje = hojeIso();
  const [d, setD] = useState({
    titulo: orientacao?.titulo ?? '',
    descricao: orientacao?.descricao ?? '',
    dataFeedback: orientacao?.dataFeedback ?? (orientacao ? '' : hoje),
    origem: (orientacao?.origem ?? 'reuniao') as OrigemOrientacao,
    capituloSecao: orientacao?.capituloSecao ?? '',
    prioridade: (orientacao?.prioridade ?? 'media') as Prioridade,
    prazo: orientacao?.prazo ?? '',
    status: (orientacao?.status ?? 'pendente') as StatusOrientacao,
    observacoesAlteracao: orientacao?.observacoesAlteracao ?? '',
    tarefaId: orientacao?.tarefaId ?? '',
  });
  const [criarTarefa, setCriarTarefa] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (orientacao) await atualizarOrientacao(orientacao.id, d);
      else await criarOrientacao(projetoId, d, { criarTarefaVinculada: criarTarefa && !d.tarefaId });
      avisar('sucesso', orientacao ? 'Orientação atualizada.' : criarTarefa && !d.tarefaId ? 'Orientação registrada e tarefa criada no Planejamento.' : 'Orientação registrada.');
      aoFechar();
    } catch (err) {
      if (err instanceof ErroDeValidacao) setErros(err.erros);
      else avisar('erro', `Não foi possível salvar: ${(err as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={orientacao ? 'Editar orientação' : 'Registrar orientação'} largura="max-w-2xl" rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-orientacao" disabled={salvando}>{orientacao ? 'Salvar' : 'Registrar'}</Botao></>}>
      <form id="form-orientacao" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <Campo rotulo="Assunto" id="or-titulo" obrigatorio erro={erros.titulo}>
          <Entrada id="or-titulo" value={d.titulo} onChange={set('titulo')} aria-invalid={!!erros.titulo} autoFocus placeholder="Ex.: Reorganizar o capítulo 2" />
        </Campo>
        <Campo rotulo="O que o orientador pediu" id="or-descricao">
          <AreaTexto id="or-descricao" value={d.descricao} onChange={set('descricao')} rows={3} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Data da orientação" id="or-data" erro={erros.dataFeedback}>
            <Entrada id="or-data" type="date" max={hoje} value={d.dataFeedback} onChange={set('dataFeedback')} aria-invalid={!!erros.dataFeedback} />
          </Campo>
          <Campo rotulo="Recebida por" id="or-origem">
            <Selecao id="or-origem" value={d.origem} onChange={set('origem')}>
              {(Object.keys(ROTULO_ORIGEM) as OrigemOrientacao[]).map((o) => <option key={o} value={o}>{ROTULO_ORIGEM[o]}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Capítulo ou seção" id="or-capitulo">
            <Entrada id="or-capitulo" value={d.capituloSecao} onChange={set('capituloSecao')} placeholder="Ex.: 2.1" />
          </Campo>
          <Campo rotulo="Prioridade" id="or-prioridade">
            <Selecao id="or-prioridade" value={d.prioridade} onChange={set('prioridade')}>
              {(['alta', 'media', 'baixa'] as Prioridade[]).map((p) => <option key={p} value={p}>{ROTULO_PRIORIDADE[p]}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Prazo para ajustar" id="or-prazo">
            <Entrada id="or-prazo" type="date" value={d.prazo} onChange={set('prazo')} />
          </Campo>
          <Campo rotulo="Status" id="or-status">
            <Selecao id="or-status" value={d.status} onChange={set('status')}>
              {(Object.keys(ROTULO_STATUS_ORIENTACAO) as StatusOrientacao[]).map((s) => <option key={s} value={s}>{ROTULO_STATUS_ORIENTACAO[s]}</option>)}
            </Selecao>
          </Campo>
        </div>
        <Campo rotulo="O que você alterou" id="or-obs" dica="Anote como resolveu, para mostrar ao orientador na próxima reunião.">
          <AreaTexto id="or-obs" value={d.observacoesAlteracao} onChange={set('observacoesAlteracao')} rows={2} />
        </Campo>
        <fieldset className="rounded-md border border-borda p-3">
          <legend className="px-1 text-[13px] font-medium text-marinho-700">Tarefa no Planejamento</legend>
          <Campo rotulo="Vincular a uma tarefa existente" id="or-tarefa" erro={erros.tarefaId}>
            <Selecao id="or-tarefa" value={d.tarefaId} onChange={set('tarefaId')}>
              <option value="">Nenhuma</option>
              {tarefas.map((t) => <option key={t.id} value={t.id}>{t.titulo}{t.status === 'concluida' ? ' (concluída)' : ''}</option>)}
            </Selecao>
          </Campo>
          {!orientacao && !d.tarefaId && (
            <label className="mt-3 flex items-start gap-2 text-sm text-marinho-700">
              <input type="checkbox" className="mt-0.5 size-4 accent-acao-600" checked={criarTarefa} onChange={(e) => setCriarTarefa(e.target.checked)} />
              <span>Criar uma tarefa no Planejamento com este assunto e prazo<span className="block text-xs text-cinza-500">Evita registrar a mesma coisa duas vezes.</span></span>
            </label>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}

function Indicador({ icone, rotulo, valor, tom }: { icone: ReactNode; rotulo: string; valor: number; tom?: string }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie p-4">
      <div className="flex items-center gap-2 text-[13px] text-cinza-600"><span className="text-cinza-500">{icone}</span>{rotulo}</div>
      <div className={cx('mt-2 text-2xl font-semibold tracking-tight', valor > 0 && tom)}>{valor}</div>
    </div>
  );
}

type Visao = 'pendentes' | 'prazo' | 'concluidas' | 'todas';

export function Orientacoes() {
  const projeto = useProjetoObrigatorio();
  const avisar = useAvisos();
  const [params, setParams] = useSearchParams();
  const hoje = hojeIso();
  const [visao, setVisao] = useState<Visao>('pendentes');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Orientacao | 'nova' | null>(params.get('nova') === '1' ? 'nova' : null);
  const [excluindo, setExcluindo] = useState<Orientacao | null>(null);

  const dados = useLiveQuery(async () => {
    const [orientacoes, tarefas] = await Promise.all([
      db.orientacoes.where('projetoId').equals(projeto.id).toArray(),
      db.tarefas.where('projetoId').equals(projeto.id).toArray(),
    ]);
    return { orientacoes, tarefas: tarefas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')) };
  }, [projeto.id]);
  const tarefasPorId = useMemo(() => new Map((dados?.tarefas ?? []).map((t) => [t.id, t])), [dados?.tarefas]);
  if (!dados) return null;

  const todas = ordenarOrientacoes(dados.orientacoes);
  const pendentes = todas.filter((o) => o.status !== 'concluida');
  const comPrazoProximo = pendentes.filter((o) => ['atrasada', 'vence_em_breve'].includes(situacaoOrientacao(o, hoje)));
  const atrasadas = pendentes.filter((o) => situacaoOrientacao(o, hoje) === 'atrasada').length;
  const concluidas = todas.filter((o) => o.status === 'concluida');
  const base = { pendentes, prazo: comPrazoProximo, concluidas, todas }[visao];
  const termos = termosDaConsulta(busca);
  const lista = base.filter((o) => corresponde(termos, [o.titulo, o.descricao, o.capituloSecao, o.observacoesAlteracao]));
  const fechar = () => { setEditando(null); if (params.get('nova')) setParams({}); };

  return (
    <>
      <CabecalhoPagina
        titulo="Orientações"
        descricao="O que o seu orientador pediu e o que você já ajustou."
        acoes={dados.orientacoes.length > 0 && <Botao variante="primario" onClick={() => setEditando('nova')}><Plus size={16} /> Registrar orientação</Botao>}
      />
      <AjudaSecao secao="orientacoes" />

      {dados.orientacoes.length === 0 ? (
        <Cartao>
          <EstadoVazio icone={<MessagesSquare size={20} />} titulo="Nenhuma orientação registrada" acao={<Botao variante="primario" onClick={() => setEditando('nova')}><Plus size={16} /> Registrar orientação</Botao>}>
            Depois de cada reunião, e-mail ou comentário do orientador, registre o que foi pedido, com prazo e capítulo. Assim nada se perde até a entrega.
          </EstadoVazio>
        </Cartao>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador icone={<MessagesSquare size={15} />} rotulo="Pendentes" valor={pendentes.length} tom="text-alerta-700" />
            <Indicador icone={<AlertTriangle size={15} />} rotulo="Atrasadas" valor={atrasadas} tom="text-perigo-700" />
            <Indicador icone={<Clock size={15} />} rotulo="Prazo nos próximos 7 dias" valor={comPrazoProximo.length - atrasadas} tom="text-alerta-700" />
            <Indicador icone={<CheckCircle2 size={15} />} rotulo="Revisões concluídas" valor={concluidas.length} tom="text-sucesso-700" />
          </div>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div role="tablist" aria-label="Visualizar" className="flex shrink-0 gap-1 overflow-x-auto rounded-md border border-borda bg-superficie p-1">
              {([['pendentes', 'Pendentes', pendentes.length], ['prazo', 'Prazo próximo', comPrazoProximo.length], ['concluidas', 'Concluídas', concluidas.length], ['todas', 'Todas', todas.length]] as const).map(([id, rotulo, n]) => (
                <button key={id} role="tab" aria-selected={visao === id} onClick={() => setVisao(id)} className={cx('whitespace-nowrap rounded px-3 py-1.5 text-sm transition-colors', visao === id ? 'bg-acao-50 font-medium text-acao-700' : 'text-cinza-600 hover:text-marinho-900')}>
                  {rotulo} <span className="text-xs opacity-70">{n}</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cinza-500" />
              <Entrada type="search" aria-label="Pesquisar orientações" placeholder="Pesquisar…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
          </div>

          {lista.length === 0 ? (
            <Cartao><p className="px-4 py-10 text-center text-sm text-cinza-500">{visao === 'pendentes' && !busca ? 'Nenhuma orientação pendente. 🎉' : 'Nenhuma orientação encontrada.'}</p></Cartao>
          ) : (
            <div className="flex flex-col gap-3">
              {lista.map((o) => {
                const sit = situacaoOrientacao(o, hoje);
                const tarefa = o.tarefaId ? tarefasPorId.get(o.tarefaId) : undefined;
                return (
                  <article key={o.id} className="rounded-lg border border-borda bg-superficie p-4 sm:p-5">
                    <header className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className={cx('text-[15px] font-medium', o.status === 'concluida' && 'text-cinza-500 line-through')}>{o.titulo}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cinza-500">
                          <span>{ROTULO_ORIGEM[o.origem]}{o.dataFeedback && ` em ${dataCurta(o.dataFeedback)}`}</span>
                          {o.capituloSecao && <span>· {o.capituloSecao}</span>}
                          {o.prazo && <span className={COR_PRAZO[sit]}>· {sit === 'atrasada' ? 'Atrasada, prazo ' : 'Prazo '}{dataCurta(o.prazo)}</span>}
                          {o.prioridade === 'alta' && o.status !== 'concluida' && <Selo tom="perigo">Prioridade alta</Selo>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Selecao aria-label={`Status de ${o.titulo}`} value={o.status} onChange={async (e) => { await alterarStatusOrientacao(o.id, e.target.value as StatusOrientacao); avisar('sucesso', 'Status atualizado.'); }} className="h-8 w-36 text-xs">
                          {(Object.keys(ROTULO_STATUS_ORIENTACAO) as StatusOrientacao[]).map((s) => <option key={s} value={s}>{ROTULO_STATUS_ORIENTACAO[s]}</option>)}
                        </Selecao>
                        <button onClick={() => setEditando(o)} aria-label={`Editar ${o.titulo}`} className="rounded p-1.5 text-cinza-500 hover:bg-cinza-100 hover:text-marinho-900"><Pencil size={15} /></button>
                        <button onClick={() => setExcluindo(o)} aria-label={`Excluir ${o.titulo}`} className="rounded p-1.5 text-cinza-500 hover:bg-perigo-50 hover:text-perigo-700"><Trash2 size={15} /></button>
                      </div>
                    </header>
                    {o.descricao && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{o.descricao}</p>}
                    {o.observacoesAlteracao && (
                      <div className="mt-3 rounded-md bg-sucesso-50 px-3 py-2">
                        <p className="text-xs font-medium text-sucesso-700">O que foi alterado</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm">{o.observacoesAlteracao}</p>
                      </div>
                    )}
                    <footer className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <Selo tom={TOM_STATUS[o.status]}>{ROTULO_STATUS_ORIENTACAO[o.status]}</Selo>
                      {tarefa && (
                        <Link to="/planejamento" className="inline-flex items-center gap-1 text-acao-700 hover:underline">
                          <Link2 size={13} /> Tarefa: {tarefa.titulo} ({ROTULO_STATUS_TAREFA[tarefa.status].toLowerCase()})
                        </Link>
                      )}
                      {tarefa?.status === 'concluida' && o.status !== 'concluida' && (
                        <span className="text-sucesso-700">A tarefa vinculada já foi concluída. Marque a orientação como concluída?</span>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {editando && <Formulario key={editando === 'nova' ? 'nova' : editando.id} projetoId={projeto.id} tarefas={dados.tarefas} orientacao={editando === 'nova' ? undefined : editando} aoFechar={fechar} />}
      <Confirmacao aberto={!!excluindo} titulo="Excluir orientação?" textoConfirmar="Excluir" perigoso aoCancelar={() => setExcluindo(null)} aoConfirmar={async () => { const o = excluindo!; setExcluindo(null); await excluirOrientacao(o.id); avisar('sucesso', 'Orientação excluída.'); }}>
        <p><strong>{excluindo?.titulo}</strong> será apagada.{excluindo?.tarefaId && ' A tarefa vinculada continua no Planejamento.'}</p>
      </Confirmacao>
    </>
  );
}
