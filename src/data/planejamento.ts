import { db, novoId, agora, type Etapa, type Tarefa } from './db.ts';
import { ErroDeValidacao } from './fontes.ts';
import { sugerirPlanejamento, validarEtapa, validarTarefa } from '../domain/planejamento.ts';

export type DadosEtapa = Pick<Etapa, 'nome' | 'dataInicio' | 'dataFim'>;
export type DadosTarefa = Pick<Tarefa, 'titulo' | 'descricao' | 'etapaId' | 'prazo' | 'prioridade' | 'status'>;

const limpo = (s?: string) => (s?.trim() ? s.trim() : undefined);
function semIndefinidos<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

// ---------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------
export async function criarEtapa(projetoId: string, d: DadosEtapa): Promise<Etapa> {
  const nome = d.nome.trim();
  const erros = validarEtapa({ ...d, nome, ordem: 0 });
  if (Object.keys(erros).length) throw new ErroDeValidacao(erros);
  const ultima = await db.etapas.where('projetoId').equals(projetoId).toArray();
  const t = agora();
  const etapa: Etapa = semIndefinidos({
    id: novoId(), projetoId, nome, ordem: ultima.reduce((m, e) => Math.max(m, e.ordem + 1), 0),
    dataInicio: limpo(d.dataInicio), dataFim: limpo(d.dataFim), criadoEm: t, atualizadoEm: t,
  });
  await db.etapas.add(etapa);
  return etapa;
}

export async function atualizarEtapa(id: string, d: DadosEtapa): Promise<void> {
  const atual = await db.etapas.get(id);
  if (!atual) throw new Error('Etapa não encontrada.');
  const nome = d.nome.trim();
  const erros = validarEtapa({ ...d, nome, ordem: atual.ordem });
  if (Object.keys(erros).length) throw new ErroDeValidacao(erros);
  await db.etapas.put(semIndefinidos({ ...atual, nome, dataInicio: limpo(d.dataInicio), dataFim: limpo(d.dataFim), atualizadoEm: agora() }));
}

/** Exclui a etapa. As tarefas dela continuam existindo, apenas sem etapa. */
export async function excluirEtapa(id: string): Promise<void> {
  await db.transaction('rw', db.etapas, db.tarefas, async () => {
    await db.tarefas.where('etapaId').equals(id).modify((t) => { delete t.etapaId; });
    await db.etapas.delete(id);
  });
}

/** Move a etapa uma posição para cima (-1) ou para baixo (+1). */
export async function moverEtapa(id: string, direcao: -1 | 1): Promise<void> {
  await db.transaction('rw', db.etapas, async () => {
    const atual = await db.etapas.get(id);
    if (!atual) return;
    const lista = (await db.etapas.where('projetoId').equals(atual.projetoId).toArray()).sort((a, b) => a.ordem - b.ordem);
    const i = lista.findIndex((e) => e.id === id);
    const j = i + direcao;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    await Promise.all(lista.map((e, k) => db.etapas.update(e.id, { ordem: k })));
  });
}

// ---------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------
function normalizarTarefa(d: DadosTarefa) {
  return { titulo: d.titulo.trim(), descricao: limpo(d.descricao), etapaId: limpo(d.etapaId), prazo: limpo(d.prazo), prioridade: d.prioridade, status: d.status };
}

export async function criarTarefa(projetoId: string, dados: DadosTarefa): Promise<Tarefa> {
  const d = normalizarTarefa(dados);
  const erros = validarTarefa(d);
  if (Object.keys(erros).length) throw new ErroDeValidacao(erros);
  const t = agora();
  const tarefa: Tarefa = semIndefinidos({ ...d, id: novoId(), projetoId, concluidaEm: d.status === 'concluida' ? t : undefined, criadoEm: t, atualizadoEm: t });
  await db.tarefas.add(tarefa);
  return tarefa;
}

export async function atualizarTarefa(id: string, dados: DadosTarefa): Promise<void> {
  const atual = await db.tarefas.get(id);
  if (!atual) throw new Error('Tarefa não encontrada.');
  const d = normalizarTarefa(dados);
  const erros = validarTarefa(d);
  if (Object.keys(erros).length) throw new ErroDeValidacao(erros);
  const t = agora();
  const concluidaEm = d.status === 'concluida' ? (atual.status === 'concluida' ? atual.concluidaEm : t) : undefined;
  await db.tarefas.put(semIndefinidos({ id: atual.id, projetoId: atual.projetoId, criadoEm: atual.criadoEm, ...d, concluidaEm, atualizadoEm: t }));
}

export async function alterarStatusTarefa(id: string, status: Tarefa['status']): Promise<void> {
  const atual = await db.tarefas.get(id);
  if (!atual) return;
  await atualizarTarefa(id, { ...atual, status });
}

/** Exclui a tarefa e desfaz vínculos de orientações ligadas a ela. */
export async function excluirTarefa(id: string): Promise<void> {
  await db.transaction('rw', db.tarefas, db.orientacoes, async () => {
    await db.orientacoes.where('tarefaId').equals(id).modify((o) => { delete o.tarefaId; });
    await db.tarefas.delete(id);
  });
}

// ---------------------------------------------------------------------
// Planejamento sugerido
// ---------------------------------------------------------------------
export async function aplicarPlanejamentoSugerido(projetoId: string, inicio: string, fim: string): Promise<void> {
  const sugestao = sugerirPlanejamento(inicio, fim);
  await db.transaction('rw', db.etapas, db.tarefas, async () => {
    const jaExistem = await db.etapas.where('projetoId').equals(projetoId).count();
    if (jaExistem) throw new Error('Este projeto já tem etapas. O planejamento sugerido só pode ser criado num planejamento vazio.');
    const t = agora();
    for (const e of sugestao) {
      const etapaId = novoId();
      await db.etapas.add({ id: etapaId, projetoId, nome: e.nome, ordem: e.ordem, dataInicio: e.dataInicio, dataFim: e.dataFim, criadoEm: t, atualizadoEm: t });
      await db.tarefas.bulkAdd(e.tarefas.map((x) => ({ id: novoId(), projetoId, etapaId, titulo: x.titulo, prazo: x.prazo, prioridade: x.prioridade, status: 'a_fazer' as const, criadoEm: t, atualizadoEm: t })));
    }
  });
}
