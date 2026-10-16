import { test } from 'vitest';
import assert from 'node:assert/strict';
import type { DadosBibliograficos } from './tipos.ts';
import { chamadaVancouver, compactarNumeros, gerarReferenciaVancouver, iniciais, paginasVancouver } from './vancouver.ts';
import { listaDeReferencias } from './formato.ts';

const P = (sobrenome: string, prenomes?: string) => ({ tipo: 'pessoa' as const, sobrenome, prenomes });

test('iniciais e páginas abreviadas', () => {
  assert.equal(iniciais('Maria Aparecida'), 'MA');
  assert.equal(iniciais('João da'), 'J');
  assert.equal(iniciais('Jean-Pierre'), 'JP');
  assert.equal(paginasVancouver('112-116'), '112-6');
  assert.equal(paginasVancouver('112 – 120'), '112-20');
  assert.equal(paginasVancouver('911-916'), '911-6');
  assert.equal(paginasVancouver('45-60'), '45-60');
  assert.equal(paginasVancouver('99-101'), '99-101');
});

test('artigo com DOI', () => {
  const r = gerarReferenciaVancouver({
    tipo: 'artigo_periodico', autores: [P('Levitt', 'Gill')], titulo: 'Renal tumours', subtitulo: 'long-term outcome',
    veiculo: 'Pediatr Nephrol', volume: '27', numero: '3', paginas: '911-916', ano: 2012, doi: 'https://doi.org/10.1007/s00467-011-1745-0',
  });
  assert.equal(r.texto, 'Levitt G. Renal tumours: long-term outcome. Pediatr Nephrol. 2012;27(3):911-6. doi: 10.1007/s00467-011-1745-0');
});

test('artigo online sem DOI e mais de 6 autores', () => {
  const r = gerarReferenciaVancouver({
    tipo: 'artigo_periodico', titulo: 'Título', veiculo: 'Rev Bras Fis Med', ano: 2021, volume: '16', numero: '2', paginas: '112-120',
    autores: ['Silva', 'Souza', 'Lima', 'Costa', 'Alves', 'Rocha', 'Dias'].map((s) => P(s, 'Ana')),
    url: 'https://exemplo.org/a', dataAcesso: '2026-10-16',
  });
  assert.equal(r.texto, 'Silva A, Souza A, Lima A, Costa A, Alves A, Rocha A, et al. Título. Rev Bras Fis Med [Internet]. 2021 [citado 2026 out 16];16(2):112-20. Disponível em: https://exemplo.org/a');
});

test('livro com edição, capítulo e tese', () => {
  assert.equal(
    gerarReferenciaVancouver({ tipo: 'livro', autores: [P('Salvajoli', 'João Victor')], titulo: 'Radioterapia em oncologia', edicao: '2', localPublicacao: 'São Paulo', editora: 'Atheneu', ano: 2013 }).texto,
    'Salvajoli JV. Radioterapia em oncologia. 2a ed. São Paulo: Atheneu; 2013.',
  );
  assert.equal(
    gerarReferenciaVancouver({
      tipo: 'capitulo_livro', autores: [P('Lima', 'Ana')], titulo: 'Comunicação', veiculo: 'Cuidados de suporte',
      organizadores: [P('Pereira', 'Carlos')], papelOrganizadores: 'org.', localPublicacao: 'Cham', editora: 'Springer', ano: 2019, paginas: '33-50',
    }).texto,
    'Lima A. Comunicação. In: Pereira C, organizador. Cuidados de suporte. Cham: Springer; 2019. p. 33-50.',
  );
  assert.equal(
    gerarReferenciaVancouver({ tipo: 'dissertacao', autores: [P('Souza', 'Rita')], titulo: 'Margens de PTV', veiculo: 'Universidade de São Paulo', localPublicacao: 'São Paulo', ano: 2020 }).texto,
    'Souza R. Margens de PTV [dissertação]. São Paulo: Universidade de São Paulo; 2020.',
  );
});

test('sem dados não inventa: marcadores visíveis', () => {
  const r = gerarReferenciaVancouver({ tipo: 'livro', autores: [], titulo: 'Manual' } as DadosBibliograficos);
  assert.equal(r.texto, 'Manual. [local desconhecido]: [editora desconhecida]; [ANO?].');
  assert.equal(r.completa, false);
});

test('chamada numérica nos três formatos', () => {
  assert.equal(compactarNumeros([3, 1, 2, 5]), '1-3,5');
  assert.equal(compactarNumeros([1, 2]), '1,2');
  assert.equal(chamadaVancouver(1), '¹');
  assert.equal(chamadaVancouver([1, 2, 3, 7]), '¹⁻³,⁷');
  assert.equal(chamadaVancouver(4, 'parenteses', '47'), '(4, p. 47)');
  assert.equal(chamadaVancouver(12, 'colchetes'), '[12]');
  assert.equal(chamadaVancouver(undefined, 'parenteses'), '[nº?]');
});

test('lista Vancouver na ordem dos números, sem número no fim', () => {
  const base = { tipo: 'livro' as const, localPublicacao: 'SP', editora: 'X', ano: 2020 };
  const l = listaDeReferencias([
    { ...base, autores: [P('Zeta', 'A')], titulo: 'Z', numeroVancouver: 2 },
    { ...base, autores: [P('Alfa', 'B')], titulo: 'A' },
    { ...base, autores: [P('Beta', 'C')], titulo: 'B', numeroVancouver: 1 },
  ], { norma: 'vancouver' });
  assert.equal(l.texto, '1. Beta C. B. SP: X; 2020.\n2. Zeta A. Z. SP: X; 2020.\n[nº?] Alfa B. A. SP: X; 2020.');
  assert.equal(l.semNumero, 1);
});

test('Vancouver: partícula fora da entrada', () => {
  const r = gerarReferenciaVancouver({ tipo: 'livro', autores: [P('Da Silva', 'Charlene')], titulo: 'T', localPublicacao: 'SP', editora: 'X', ano: 2020 });
  assert.equal(r.texto, 'Silva C. T. SP: X; 2020.');
});
