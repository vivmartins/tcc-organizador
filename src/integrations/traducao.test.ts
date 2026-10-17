import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { traduzirTermos, prepararTradutor, _limparCacheDeTradutores } from './traducao.ts';

const DICIONARIO: Record<string, string> = { Radiotherapy: 'Radioterapia', 'patient communication': 'comunicação com o paciente.', Oncology: 'Oncologia', Radiation: 'radioterapia' };
function instalarTradutor(disponibilidade = 'available', criados: string[] = []) {
  (globalThis as Record<string, unknown>).Translator = {
    availability: async () => disponibilidade,
    create: async (o: { sourceLanguage: string; targetLanguage: string }) => {
      criados.push(`${o.sourceLanguage}->${o.targetLanguage}`);
      return { translate: async (t: string) => DICIONARIO[t] ?? `?${t}` };
    },
  };
}

// Por padrão, sem internet: o serviço on-line falha (cada teste que o usa instala a sua resposta).
beforeEach(() => { vi.stubGlobal('fetch', () => Promise.reject(new Error('offline'))); });

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as Record<string, unknown>).Translator;
  _limparCacheDeTradutores();
});

describe('tradução para o português', () => {
  test('traduz, tira ponto final, põe inicial maiúscula e remove repetidos', async () => {
    const criados: string[] = [];
    instalarTradutor('available', criados);
    expect(await traduzirTermos(['Radiotherapy', 'patient communication', 'Radiation'], 'en')).toEqual(['Radioterapia', 'Comunicação com o paciente']);
    expect(await traduzirTermos(['Oncology'], 'en')).toEqual(['Oncologia']);
    expect(criados).toEqual(['en->pt']); // o tradutor é preparado uma vez só
  });

  test('sem tradutor no navegador, devolve null (os termos em inglês não são usados)', async () => {
    expect(await traduzirTermos(['Radiotherapy'], 'en')).toBeNull();
    expect(await prepararTradutor('en')).toBeNull();
  });

  test('par de idiomas indisponível também devolve null, e permite tentar de novo depois', async () => {
    instalarTradutor('unavailable');
    expect(await traduzirTermos(['Radiotherapy'], 'es')).toBeNull();
    instalarTradutor('available');
    expect(await traduzirTermos(['Radiotherapy'], 'es')).toEqual(['Radioterapia']);
  });

  test('lista vazia não precisa de tradutor', async () => {
    expect(await traduzirTermos([], 'en')).toEqual([]);
  });
});

describe('tempo-limite', () => {
  test('se o navegador não termina de preparar o tradutor, desiste e devolve null', async () => {
    const { vi } = await import('vitest');
    vi.useFakeTimers();
    try {
      (globalThis as Record<string, unknown>).Translator = {
        availability: async () => 'downloadable',
        create: () => new Promise(() => {}), // nunca termina (ex.: sem internet para baixar o pacote)
      };
      const r = traduzirTermos(['Radiotherapy'], 'en');
      await vi.advanceTimersByTimeAsync(61_000);
      expect(await r).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('serviço on-line (quando o navegador não tem o tradutor)', () => {
  test('usa o MyMemory, um termo por pedido, e arruma a resposta', async () => {
    const pedidos: string[] = [];
    const respostas: Record<string, string> = { Radiotherapy: 'radioterapia', 'patient&#39;s care': 'cuidado do paciente.' };
    vi.stubGlobal('fetch', async (url: string) => {
      pedidos.push(url);
      const q = new URL(url).searchParams.get('q')!;
      return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: respostas[q] ?? q } }) };
    });
    expect(await traduzirTermos(['Radiotherapy', 'patient&#39;s care'], 'en')).toEqual(['Radioterapia', 'Cuidado do paciente']);
    expect(pedidos[0]).toContain('langpair=en|pt-BR');
    expect(pedidos).toHaveLength(2);
  });

  test('cota esgotada ou erro: devolve null (nada em inglês entra)', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ responseStatus: 429, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY' } }) }));
    expect(await traduzirTermos(['Radiotherapy'], 'en')).toBeNull();
  });

  test('o tradutor do navegador tem prioridade', async () => {
    let usouOnline = false;
    vi.stubGlobal('fetch', async () => { usouOnline = true; return { ok: false }; });
    instalarTradutor();
    expect(await traduzirTermos(['Oncology'], 'en')).toEqual(['Oncologia']);
    expect(usouOnline).toBe(false);
  });
});
