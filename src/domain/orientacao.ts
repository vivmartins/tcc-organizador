// Regras das orientações do orientador.
import { situacaoTarefa, type Prioridade, type Situacao } from './planejamento.ts';

export type StatusOrientacao = 'pendente' | 'em_andamento' | 'concluida';
export type OrigemOrientacao = 'reuniao' | 'email' | 'comentario_documento' | 'outro';

export const ROTULO_STATUS_ORIENTACAO: Record<StatusOrientacao, string> = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' };
export const ROTULO_ORIGEM: Record<OrigemOrientacao, string> = { reuniao: 'Reunião', email: 'E-mail', comentario_documento: 'Comentário no documento', outro: 'Outro' };

export interface OrientacaoBase {
  titulo: string;
  prazo?: string;
  prioridade: Prioridade;
  status: StatusOrientacao;
  dataFeedback?: string;
}

export function validarOrientacao(o: OrientacaoBase, hoje: string): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!o.titulo.trim()) erros.titulo = 'Informe o assunto da orientação.';
  if (o.dataFeedback && o.dataFeedback > hoje) erros.dataFeedback = 'A data da orientação não pode estar no futuro.';
  return erros;
}

/** Mesma lógica de prazos das tarefas: atrasada, vence em breve, no prazo, sem prazo, concluída. */
export function situacaoOrientacao(o: OrientacaoBase, hoje: string): Situacao {
  return situacaoTarefa({ titulo: o.titulo, prazo: o.prazo, prioridade: o.prioridade, status: o.status === 'concluida' ? 'concluida' : 'a_fazer' }, hoje);
}

/** Pendentes primeiro (atrasadas e prazos mais próximos antes, depois prioridade), concluídas no fim (mais recentes primeiro). */
export function ordenarOrientacoes<T extends OrientacaoBase & { criadoEm: string }>(lista: T[]): T[] {
  const peso: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };
  return [...lista].sort((a, b) => {
    const ca = a.status === 'concluida' ? 1 : 0;
    const cb = b.status === 'concluida' ? 1 : 0;
    if (ca !== cb) return ca - cb;
    if (ca === 1) return b.criadoEm.localeCompare(a.criadoEm);
    const pa = a.prazo ?? '9999-12-31';
    const pb = b.prazo ?? '9999-12-31';
    if (pa !== pb) return pa.localeCompare(pb);
    return peso[a.prioridade] - peso[b.prioridade] || b.criadoEm.localeCompare(a.criadoEm);
  });
}
