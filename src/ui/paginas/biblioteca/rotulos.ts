import type { Autor } from '../../../domain/tipos.ts';
import type { StatusLeitura } from '../../../data/db.ts';
import { capitalizarSobrenome } from '../../../domain/abnt/citacao.ts';

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

/** "Silva, Souza e Lima" / "Silva et al." para listas. */
export function autoresCurtos(autores: Autor[] = []): string {
  const nomes = autores.map((a) => (a.tipo === 'entidade' ? a.sobrenome : capitalizarSobrenome(a.sobrenome)));
  if (nomes.length === 0) return '';
  if (nomes.length > 3) return `${nomes[0]} et al.`;
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}
