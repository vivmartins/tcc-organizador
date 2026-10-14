import { expect, test } from 'vitest';
import { ordenarOrientacoes, situacaoOrientacao, validarOrientacao, type OrientacaoBase } from './orientacao.ts';

const O = (p: Partial<OrientacaoBase & { criadoEm: string }>) => ({ titulo: 'o', prioridade: 'media' as const, status: 'pendente' as const, criadoEm: '2026-10-01', ...p });
const HOJE = '2026-10-14';

test('validação: assunto obrigatório e data não futura', () => {
  expect(Object.keys(validarOrientacao(O({ titulo: ' ', dataFeedback: '2026-10-20' }), HOJE)).sort()).toEqual(['dataFeedback', 'titulo']);
  expect(validarOrientacao(O({ dataFeedback: HOJE }), HOJE)).toEqual({});
});

test('situação do prazo', () => {
  expect(situacaoOrientacao(O({ prazo: '2026-10-10' }), HOJE)).toBe('atrasada');
  expect(situacaoOrientacao(O({ prazo: '2026-10-10', status: 'em_andamento' }), HOJE)).toBe('atrasada');
  expect(situacaoOrientacao(O({ prazo: '2026-10-10', status: 'concluida' }), HOJE)).toBe('concluida');
  expect(situacaoOrientacao(O({ prazo: '2026-10-16' }), HOJE)).toBe('vence_em_breve');
});

test('ordenação: pendentes por prazo e prioridade; concluídas no fim', () => {
  const l = ordenarOrientacoes([
    O({ titulo: 'feita', status: 'concluida', prazo: '2026-01-01' }),
    O({ titulo: 'sem prazo alta', prioridade: 'alta' }),
    O({ titulo: 'prazo longe', prazo: '2026-12-01' }),
    O({ titulo: 'prazo perto', prazo: '2026-10-20' }),
  ]);
  expect(l.map((x) => x.titulo)).toEqual(['prazo perto', 'prazo longe', 'sem prazo alta', 'feita']);
});
