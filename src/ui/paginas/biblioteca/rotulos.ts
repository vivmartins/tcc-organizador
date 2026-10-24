import type { Autor } from '../../../domain/tipos.ts';
import type { Acesso, Prioridade, StatusLeitura } from '../../../data/db.ts';
import { capitalizarSobrenome } from '../../../domain/abnt/citacao.ts';
import { entradaDoAutor } from '../../../domain/abnt/nomes.ts';

export const ROTULO_STATUS_LEITURA: Record<StatusLeitura, string> = {
  nao_iniciado: 'Não iniciado',
  lendo: 'Lendo',
  lido: 'Lido',
  revisado: 'Revisado',
};

export const TOM_STATUS_LEITURA: Record<StatusLeitura, 'neutro' | 'acao' | 'sucesso'> = {
  nao_iniciado: 'neutro',
  lendo: 'acao',
  lido: 'sucesso',
  revisado: 'sucesso',
};

export const ORDEM_STATUS: StatusLeitura[] = ['nao_iniciado', 'lendo', 'lido', 'revisado'];

export const ROTULO_ACESSO: Record<Acesso, string> = { gratuito: 'Gratuito', pago: 'Pago' };
export const ROTULO_ACESSO_LONGO: Record<Acesso, string> = { gratuito: 'Acesso gratuito', pago: 'Acesso pago' };
export const TOM_ACESSO: Record<Acesso, 'sucesso' | 'alerta'> = { gratuito: 'sucesso', pago: 'alerta' };
export const ORDEM_ACESSO: Acesso[] = ['gratuito', 'pago'];

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = { alta: 'Prioridade alta', media: 'Prioridade média', baixa: 'Prioridade baixa' };
export const ROTULO_PRIORIDADE_CURTO: Record<Prioridade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const TOM_PRIORIDADE: Record<Prioridade, 'perigo' | 'alerta' | 'neutro'> = { alta: 'perigo', media: 'alerta', baixa: 'neutro' };
export const ORDEM_PRIORIDADE: Prioridade[] = ['alta', 'media', 'baixa'];
/** Para ordenar: alta, média, baixa e, por último, as sem prioridade. */
export const pesoPrioridade = (p?: Prioridade) => (p ? ORDEM_PRIORIDADE.indexOf(p) : ORDEM_PRIORIDADE.length);

/** "Silva, Souza e Lima" / "Silva et al." para listas. */
export function autoresCurtos(autores: Autor[] = []): string {
  const nomes = autores.map((a) => (a.tipo === 'entidade' ? a.sobrenome : capitalizarSobrenome(entradaDoAutor(a).sobrenome)));
  if (nomes.length === 0) return '';
  if (nomes.length > 3) return `${nomes[0]} et al.`;
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
