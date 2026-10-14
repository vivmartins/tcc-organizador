import { describe, expect, test } from 'vitest';
import { textoDaFicha, validarFicha } from './fichamento.ts';
import type { DadosBibliograficos } from './tipos.ts';

const fonte: DadosBibliograficos = {
  tipo: 'livro',
  autores: [{ tipo: 'pessoa', sobrenome: 'Freire', prenomes: 'Paulo' }],
  titulo: 'Pedagogia da autonomia',
  localPublicacao: 'São Paulo',
  editora: 'Paz e Terra',
  ano: 1996,
};

describe('validação', () => {
  test('citação direta exige trecho e página', () => {
    expect(Object.keys(validarFicha({ tipo: 'citacao_direta', parafrase: 'x' })).sort()).toEqual(['pagina', 'trechoOriginal']);
    expect(validarFicha({ tipo: 'citacao_direta', trechoOriginal: 'abc', pagina: '25' })).toEqual({});
  });
  test('precisa de algum conteúdo', () => {
    expect(validarFicha({ tipo: 'ideia', tema: 'só tema' }).geral).toBeTruthy();
    expect(validarFicha({ tipo: 'ideia', interpretacao: 'uma ideia' })).toEqual({});
  });
});

describe('ficha completa para copiar', () => {
  test('preserva o trecho original exatamente e identifica fonte e página', () => {
    const trecho = 'Ensinar não é transferir conhecimento,  mas criar as possibilidades';
    const t = textoDaFicha({ tipo: 'citacao_direta', trechoOriginal: trecho, pagina: '25', interpretacao: 'Base para o cap. 2', capituloSecao: 'Cap. 2', tema: 'Educação' }, fonte);
    expect(t).toContain(`“${trecho}” (Freire, 1996, p. 25)`);
    expect(t).toContain('Minha interpretação: Base para o cap. 2');
    expect(t).toContain('Uso no TCC: Cap. 2');
    expect(t.startsWith('[Citação direta] Tema: Educação')).toBe(true);
    expect(t).toContain('Fonte: FREIRE, Paulo. Pedagogia da autonomia. São Paulo: Paz e Terra, 1996.');
  });
  test('paráfrase sem trecho leva a citação junto', () => {
    const t = textoDaFicha({ tipo: 'citacao_indireta', parafrase: 'O autor defende a autonomia.' }, fonte);
    expect(t).toContain('Resumo/paráfrase: O autor defende a autonomia. (Freire, 1996)');
  });
});
