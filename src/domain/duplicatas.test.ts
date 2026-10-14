import { test } from 'vitest';
import assert from 'node:assert/strict';
import { encontrarDuplicatas, extrairDoi, normalizarUrl } from './duplicatas.ts';

const existentes = [
  { id: 'a', titulo: 'Humanização em radioterapia', ano: 2021, doi: '10.1590/ABC.123', autores: [{ tipo: 'pessoa' as const, sobrenome: 'Silva' }] },
  { id: 'b', titulo: 'Comunicação com o paciente oncológico', ano: 2019, url: 'https://www.scielo.br/j/rlae/a/XYZ/' },
];

test('mesmo DOI com prefixo e maiúsculas diferentes', () => {
  assert.deepEqual(encontrarDuplicatas({ titulo: 'Outro', doi: 'https://doi.org/10.1590/abc.123' }, existentes), [{ id: 'a', motivo: 'doi' }]);
});

test('mesma URL ignorando www, barra final e parâmetros de rastreio', () => {
  assert.deepEqual(
    encontrarDuplicatas({ titulo: 'x', url: 'https://scielo.br/j/rlae/a/XYZ?utm_source=google' }, existentes),
    [{ id: 'b', motivo: 'url' }],
  );
  assert.equal(normalizarUrl('não é url'), null);
});

test('mesmo título (sem acentos e pontuação), ano e primeiro autor', () => {
  const r = encontrarDuplicatas({ titulo: 'HUMANIZACAO EM RADIOTERAPIA.', ano: 2021, autores: [{ tipo: 'pessoa', sobrenome: 'SILVA' }] }, existentes);
  assert.deepEqual(r, [{ id: 'a', motivo: 'metadados' }]);
});

test('título igual mas ano diferente não é duplicata', () => {
  assert.deepEqual(encontrarDuplicatas({ titulo: 'Humanização em radioterapia', ano: 2015 }, existentes), []);
});

test('ignora a própria fonte durante a edição', () => {
  assert.deepEqual(encontrarDuplicatas({ id: 'a', titulo: 'Humanização em radioterapia', ano: 2021, doi: '10.1590/abc.123' }, existentes), []);
});

test('extrai DOI de URLs e de texto de PDF', () => {
  assert.equal(extrairDoi('https://onlinelibrary.wiley.com/doi/full/10.1002/cncr.12345'), '10.1002/cncr.12345');
  assert.equal(extrairDoi('https://www.tandfonline.com/doi/pdf/10.1080/0145.2020.1/pdf'), '10.1080/0145.2020.1');
  assert.equal(extrairDoi('https://x.org/a?doi=10.1590%2F1518-8345.1234.5678'), '10.1590/1518-8345.1234.5678');
  assert.equal(extrairDoi('Rev Saúde Pública. DOI: 10.1590/S0034-89102010000100001.'), '10.1590/s0034-89102010000100001');
  assert.equal(extrairDoi('https://www.scielo.br/j/rlae/a/XYZ/'), null);
});
