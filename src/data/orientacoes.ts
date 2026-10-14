import { db, novoId, agora, type Orientacao } from './db.ts';
import { ErroDeValidacao } from './fontes.ts';
import { validarOrientacao } from '../domain/orientacao.ts';
import { criarTarefa } from './planejamento.ts';

export type DadosOrientacao = Pick<Orientacao, 'titulo' | 'descricao' | 'dataFeedback' | 'origem' | 'capituloSecao' | 'prioridade' | 'prazo' | 'status' | 'observacoesAlteracao' | 'tarefaId'>;

const limpo = (s?: string) => (s?.trim() ? s.trim() : undefined);
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function normalizar(projetoId: string, d: DadosOrientacao) {
  const o = {
    titulo: d.titulo.trim(),
    descricao: limpo(d.descricao),
    dataFeedback: limpo(d.dataFeedback),
    origem: d.origem,
    capituloSecao: limpo(d.capituloSecao),
    prioridade: d.prioridade,
    prazo: limpo(d.prazo),
    status: d.status,
    observacoesAlteracao: limpo(d.observacoesAlteracao),
    tarefaId: limpo(d.tarefaId),
  };
  const erros = validarOrientacao(o, hoje());
  if (o.tarefaId) {
    const t = await db.tarefas.get(o.tarefaId);
    if (!t || t.projetoId !== projetoId) erros.tarefaId = 'A tarefa escolhida não existe neste projeto.';
  }
  if (Object.keys(erros).length) throw new ErroDeValidacao(erros);
  return o;
}

function semIndefinidos<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

/** Cria a orientação. Com `criarTarefaVinculada`, também cria uma tarefa no Planejamento e liga as duas. */
export async function criarOrientacao(projetoId: string, dados: DadosOrientacao, opcoes: { criarTarefaVinculada?: boolean } = {}): Promise<Orientacao> {
  const d = await normalizar(projetoId, dados);
  const t = agora();
  return db.transaction('rw', db.orientacoes, db.tarefas, db.etapas, async () => {
    let tarefaId = d.tarefaId;
    if (opcoes.criarTarefaVinculada && !tarefaId) {
      const tarefa = await criarTarefa(projetoId, {
        titulo: d.titulo,
        descricao: [d.descricao, d.capituloSecao && `Capítulo/seção: ${d.capituloSecao}`, 'Criada a partir de uma orientação.'].filter(Boolean).join('\n'),
        prazo: d.prazo,
        prioridade: d.prioridade,
        status: d.status === 'concluida' ? 'concluida' : d.status === 'em_andamento' ? 'em_andamento' : 'a_fazer',
      });
      tarefaId = tarefa.id;
    }
    const o: Orientacao = semIndefinidos({ ...d, tarefaId, id: novoId(), projetoId, criadoEm: t, atualizadoEm: t });
    await db.orientacoes.add(o);
    return o;
  });
}

export async function atualizarOrientacao(id: string, dados: DadosOrientacao): Promise<void> {
  const atual = await db.orientacoes.get(id);
  if (!atual) throw new Error('Orientação não encontrada.');
  const d = await normalizar(atual.projetoId, dados);
  await db.orientacoes.put(semIndefinidos({ id: atual.id, projetoId: atual.projetoId, criadoEm: atual.criadoEm, ...d, atualizadoEm: agora() }));
}

export async function alterarStatusOrientacao(id: string, status: Orientacao['status']): Promise<void> {
  await db.orientacoes.update(id, { status, atualizadoEm: agora() });
}

/** Exclui a orientação. A tarefa vinculada (se houver) continua no Planejamento. */
export async function excluirOrientacao(id: string): Promise<void> {
  await db.orientacoes.delete(id);
}
