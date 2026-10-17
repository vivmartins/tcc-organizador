import { expect, test } from 'vitest';
import { carregarModulo, MENSAGEM_VERSAO_NOVA } from './versao.ts';

test('tenta de novo e, se o arquivo sumiu, explica em português', async () => {
  let n = 0;
  await expect(carregarModulo(() => { n++; return Promise.reject(new TypeError('Failed to fetch dynamically imported module: https://x/assets/pdf-a.js')); })).rejects.toThrow(MENSAGEM_VERSAO_NOVA);
  expect(n).toBe(2);
});

test('segunda tentativa pode dar certo', async () => {
  let n = 0;
  expect(await carregarModulo(() => (++n === 1 ? Promise.reject(new TypeError('Failed to fetch dynamically imported module')) : Promise.resolve(42)))).toBe(42);
});

test('outros erros passam como estão', async () => {
  await expect(carregarModulo(() => Promise.reject(new Error('outro')))).rejects.toThrow('outro');
});
