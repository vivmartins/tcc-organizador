import { describe, expect, test } from 'vitest';
import { extrairPalavrasChave, juntarPalavrasChave, sugerirTemasExistentes } from './palavrasChave.ts';

describe('palavras-chave dos autores', () => {
  test('artigo brasileiro: prefere as palavras-chave em português e para no Abstract', () => {
    const texto = `Humanização no atendimento em radioterapia
RESUMO Objetivo: analisar...
Palavras-chave: Radioterapia; Humanização da Assistência; Enfermagem Oncológica.
ABSTRACT Objective: to analyze...
Keywords: Radiotherapy; Humanization of Assistance; Oncology Nursing.`;
    expect(extrairPalavrasChave(texto)).toEqual({ idioma: 'pt', termos: ['Radioterapia', 'Humanização da Assistência', 'Enfermagem Oncológica'] });
  });

  test('aceita "Descritores", separadores por ponto e por vírgula', () => {
    expect(extrairPalavrasChave('DESCRITORES: Radioterapia. Ansiedade. Comunicação em Saúde.\n\nIntrodução')?.termos).toEqual(['Radioterapia', 'Ansiedade', 'Comunicação em Saúde']);
    expect(extrairPalavrasChave('Keywords: radiotherapy, anxiety, patient education DOI: 10.1/x')).toEqual({ idioma: 'en', termos: ['radiotherapy', 'anxiety', 'patient education'] });
    expect(extrairPalavrasChave('Palabras clave: radioterapia; ansiedad.')?.idioma).toBe('es');
  });

  test('texto sem palavras-chave não inventa nada', () => {
    expect(extrairPalavrasChave('Um texto qualquer sobre radioterapia sem a seção.')).toBeNull();
  });

  test('junta listas sem repetir', () => {
    expect(juntarPalavrasChave(['Radioterapia', 'Ansiedade'], ['radioterapia', 'Enfermagem'])).toEqual(['Radioterapia', 'Ansiedade', 'Enfermagem']);
  });
});

describe('sugestão de temas existentes', () => {
  const temas = ['Humanização', 'Comunicação', 'Segurança do paciente', 'Radioterapia', 'Experiência do paciente', 'Nutrição'];

  test('casa pelo título e pelas palavras-chave, mesmo com variações da palavra', () => {
    const r = sugerirTemasExistentes({ titulo: 'Cuidado humanizado e comunicação com pacientes', palavrasChave: ['Radioterapia'] }, temas);
    expect(r).toEqual(['Humanização', 'Comunicação', 'Radioterapia']);
  });

  test('temas de várias palavras exigem todas as palavras', () => {
    expect(sugerirTemasExistentes({ titulo: 'Segurança do paciente em radioterapia' }, temas)).toContain('Segurança do paciente');
    expect(sugerirTemasExistentes({ titulo: 'Segurança no trabalho' }, temas)).not.toContain('Segurança do paciente');
  });

  test('sem texto, sem sugestão', () => {
    expect(sugerirTemasExistentes({ titulo: '' }, temas)).toEqual([]);
  });
});
