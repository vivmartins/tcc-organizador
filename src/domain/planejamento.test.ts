import { describe, expect, test } from 'vitest';
import {
  diasEntre, somarDias, situacaoTarefa, progresso, progressoPorEtapa, etapaAtual, ordenarTarefas,
  sugerirPlanejamento, periodoDoCronograma, posicaoNoPeriodo, validarEtapa, MODELO_REVISAO, type TarefaBase,
} from './planejamento.ts';

const T = (p: Partial<TarefaBase>): TarefaBase => ({ titulo: 't', prioridade: 'media', status: 'a_fazer', ...p });
const HOJE = '2026-10-14';

describe('datas', () => {
  test('dias entre datas, inclusive em anos bissextos e virada de ano', () => {
    expect(diasEntre('2026-10-14', '2026-10-21')).toBe(7);
    expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2);
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('situação das tarefas', () => {
  test('atrasada, vence em breve, no prazo, sem prazo e concluída', () => {
    expect(situacaoTarefa(T({ prazo: '2026-10-13' }), HOJE)).toBe('atrasada');
    expect(situacaoTarefa(T({ prazo: '2026-10-14' }), HOJE)).toBe('vence_em_breve');
    expect(situacaoTarefa(T({ prazo: '2026-10-21' }), HOJE)).toBe('vence_em_breve');
    expect(situacaoTarefa(T({ prazo: '2026-10-22' }), HOJE)).toBe('no_prazo');
    expect(situacaoTarefa(T({}), HOJE)).toBe('sem_prazo');
    expect(situacaoTarefa(T({ prazo: '2020-01-01', status: 'concluida' }), HOJE)).toBe('concluida');
  });
});

describe('progresso', () => {
  test('calculado só pelas tarefas concluídas; sem tarefas não há percentual', () => {
    expect(progresso([])).toEqual({ total: 0, concluidas: 0, percentual: null });
    expect(progresso([T({ status: 'concluida' }), T({ status: 'em_andamento' }), T({})])).toEqual({ total: 3, concluidas: 1, percentual: 33 });
  });
  test('por etapa, na ordem das etapas', () => {
    const etapas = [{ id: 'b', nome: 'B', ordem: 1 }, { id: 'a', nome: 'A', ordem: 0 }];
    const r = progressoPorEtapa(etapas, [T({ etapaId: 'a', status: 'concluida' }), T({ etapaId: 'a' }), T({ etapaId: 'b', status: 'concluida' })]);
    expect(r.map((x) => [x.etapa.id, x.percentual])).toEqual([['a', 50], ['b', 100]]);
  });
  test('etapa atual pela data, ou a primeira com pendências', () => {
    const etapas = [
      { id: 'a', nome: 'A', ordem: 0, dataInicio: '2026-09-01', dataFim: '2026-09-30' },
      { id: 'b', nome: 'B', ordem: 1, dataInicio: '2026-10-01', dataFim: '2026-10-31' },
    ];
    expect(etapaAtual(etapas, [], HOJE)?.id).toBe('b');
    expect(etapaAtual(etapas, [T({ etapaId: 'a' })], '2027-05-01')?.id).toBe('a');
    expect(etapaAtual(etapas, [], '2027-05-01')).toBeNull();
  });
});

test('ordena pendentes por prazo e prioridade, concluídas no fim', () => {
  const l = ordenarTarefas([
    T({ titulo: 'concluída', prazo: '2026-01-01', status: 'concluida' }),
    T({ titulo: 'sem prazo' }),
    T({ titulo: 'b-media', prazo: '2026-11-01' }),
    T({ titulo: 'a-alta', prazo: '2026-11-01', prioridade: 'alta' }),
    T({ titulo: 'cedo', prazo: '2026-10-20' }),
  ]);
  expect(l.map((t) => t.titulo)).toEqual(['cedo', 'a-alta', 'b-media', 'sem prazo', 'concluída']);
});

describe('planejamento sugerido', () => {
  test('cobre todo o período, sem buracos nem sobreposição, terminando no prazo final', () => {
    const s = sugerirPlanejamento('2026-10-14', '2027-06-30');
    expect(s).toHaveLength(MODELO_REVISAO.length);
    expect(s[0].dataInicio).toBe('2026-10-14');
    expect(s[s.length - 1].dataFim).toBe('2027-06-30');
    for (let i = 1; i < s.length; i++) expect(diasEntre(s[i - 1].dataFim, s[i].dataInicio)).toBe(1);
    for (const e of s) {
      expect(e.dataFim >= e.dataInicio).toBe(true);
      expect(e.tarefas.every((t) => t.prazo === e.dataFim)).toBe(true);
    }
    // a redação (30%) fica com mais tempo que a definição do tema (10%)
    const dur = (i: number) => diasEntre(s[i].dataInicio, s[i].dataFim);
    expect(dur(3)).toBeGreaterThan(dur(0));
  });
  test('período curto demais é recusado', () => {
    expect(() => sugerirPlanejamento('2026-10-14', '2026-10-16')).toThrow('pelo menos');
  });
});

describe('cronograma', () => {
  test('período inclui datas fora do intervalo do projeto e calcula posições', () => {
    const p = periodoDoCronograma(['2026-12-01', '2027-08-01'], '2026-10-01', '2027-06-30')!;
    expect(p).toEqual({ inicio: '2026-10-01', fim: '2027-08-01' });
    expect(posicaoNoPeriodo('2026-10-01', p)).toBe(0);
    expect(posicaoNoPeriodo('2027-08-01', p)).toBe(100);
    expect(posicaoNoPeriodo('2030-01-01', p)).toBe(100);
    expect(periodoDoCronograma([undefined])).toBeNull();
  });
});

test('valida etapa', () => {
  expect(validarEtapa({ nome: ' ', ordem: 0 }).nome).toBeTruthy();
  expect(validarEtapa({ nome: 'X', ordem: 0, dataInicio: '2026-10-10', dataFim: '2026-10-01' }).dataFim).toBeTruthy();
});
