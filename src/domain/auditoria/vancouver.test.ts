import { test } from 'vitest';
import assert from 'node:assert/strict';
import { auditar } from './index.ts';
import { prepararFonte } from './biblioteca.ts';
import { encontrarNumeros, expandirNumeros, lerReferenciaVancouver } from './vancouver.ts';

const p = (texto: string, indice = 0) => ({ texto, indice });

test('lê referências Vancouver e no modelo com sobrenome em maiúsculas', () => {
  const a = lerReferenciaVancouver('1. Levitt G. Renal tumours: long-term outcome. Pediatr Nephrol. 2012;27(3):911-6.', 0);
  assert.deepEqual([a.numero, a.autores[0], a.ano, a.rotulo], [1, 'levitt', '2012', 'Levitt, 2012']);
  const b = lerReferenciaVancouver('2. LEVITT, Gill. Renal tumours: long-term outcome. Pediatr Nephol (2012) 27(3) : 911-916.', 1);
  assert.deepEqual([b.numero, b.autores[0], b.ano], [2, 'levitt', '2012']);
  const c = lerReferenciaVancouver('Instituto Brasileiro de Geografia e Estatística. Demografia das empresas 2008. Rio de Janeiro: IBGE; 2010.', 4);
  assert.deepEqual([c.numero, c.semNumero, c.ano], [5, true, '2010']);
  const d = lerReferenciaVancouver('3. Salvajoli JV, Souhami L, Faria SL. Radioterapia em oncologia. 2a ed. São Paulo: Atheneu; 2013.', 2);
  assert.deepEqual([d.autores[0], d.ano], ['salvajoli', '2013']);
});

test('encontra números sobrescritos, entre parênteses e colchetes, sem pegar unidades e figuras', () => {
  assert.deepEqual(expandirNumeros('1-3, 5'), [1, 2, 3, 5]);
  const corpo = [p('O erro caiu para 2 mm¹ e a área foi de 4 cm². A dose (3) e a Figura (2) e a Tabela [1].'), p('(1) item de lista que não é citação.')];
  assert.deepEqual(encontrarNumeros(corpo, 'sobrescrito', 30).map((a) => a.numeros), [[1]]);
  assert.deepEqual(encontrarNumeros(corpo, 'parenteses', 30).map((a) => a.texto), ['¹', '(3)']);
  assert.deepEqual(encontrarNumeros([p('Como mostrado [2, p. 47].')], 'colchetes', 30).map((a) => [a.numeros, a.pagina]), [[[2], '47']]);
});

test('auditoria Vancouver: número sem referência, ordem, não citadas, diretas e numeração da biblioteca', () => {
  const doc = {
    nomeArquivo: 'tcc.docx',
    origem: 'docx' as const,
    paragrafos: [
      p('INTRODUÇÃO'),
      p('A imagem diária reduz erros¹. Segundo o estudo, “a verificação diária reduziu os erros de posicionamento”³. Outro ponto²˒⁷.'),
      p('REFERÊNCIAS'),
      p('1. Silva MA, Souza J. Erros de posicionamento. Rev Bras Fis Med. 2021;16(2):45-60.'),
      p('2. Costa B. Margens de PTV. Radiother Oncol. 2022;5:1-9.'),
      p('3. Lima R. Física da radioterapia. São Paulo: Atheneu; 2019.'),
      p('4. Ferreira P. Não citado. Rev X. 2020;1:1-2.'),
    ],
  };
  const fontes = [
    prepararFonte({ id: 'f1', titulo: 'Erros', ano: 2021, autores: [{ sobrenome: 'Silva' }, { sobrenome: 'Souza' }] }, { texto: 'A verificação diária reduziu os erros de posicionamento em todas as direções.', origem: 'pdf' }, []),
    prepararFonte({ id: 'f3', titulo: 'Física', ano: 2019, autores: [{ sobrenome: 'Lima' }] }, undefined, []),
  ];
  const r = auditar(doc, fontes, { norma: 'vancouver', chamada: 'sobrescrito' });
  const v = r.vancouver!;
  assert.deepEqual(v.ordem, [1, 3, 2, 7]);
  assert.deepEqual(v.foraDeOrdem.map((f) => [f.numero, f.esperado]), [[3, 2], [7, 4]]);
  assert.deepEqual(v.semReferencia.map((s) => s.numero), [7]);
  assert.deepEqual(r.citacoes.naoCitadas.map((x) => x.indice), [3]);
  // a citação direta foi ligada à obra 3 (Lima), e não a Silva: aponta que a fonte é outra/sem material
  assert.equal(r.diretas.length, 1);
  assert.equal(r.diretas[0].direta.citacao?.texto, '³');
  // numeração na ordem do TCC: Silva é a 1ª obra citada, Lima a 2ª
  assert.deepEqual(v.numeracao.map((n) => [n.fonteId, n.numero]), [['f1', 1], ['f3', 2]]);
  assert.deepEqual(v.foraDaBiblioteca.map((x) => x.rotulo), ['Costa, 2022']);
});
