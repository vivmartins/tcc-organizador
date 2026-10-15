import { describe, expect, test } from 'vitest';
import { separarDocumento, type DocumentoTcc } from './documento.ts';
import { lerReferencia } from './referencias.ts';
import { encontrarCitacoes, encontrarCitacoesDiretas } from './citacoes.ts';
import { cruzarCitacoes, rotuloObra } from './cruzamento.ts';

const par = (texto: string, recuoCm?: number) => ({ texto, recuoCm });
const corpo = (...ts: string[]) => ts.map((t, i) => ({ texto: t, indice: i }));

describe('separar o documento', () => {
  test('usa o último título "Referências" e para nos apêndices', () => {
    const doc: DocumentoTcc = {
      nomeArquivo: 'tcc.docx', origem: 'docx',
      paragrafos: [
        par('SUMÁRIO'), par('REFERÊNCIAS ........ 30'), par('1 INTRODUÇÃO'), par('Texto (Silva, 2020).'),
        par('REFERÊNCIAS'), par('SILVA, M. Título. São Paulo: Atlas, 2020.'), par('continuação da linha'),
        par('A HUMANIZAÇÃO do cuidado. Revista, 2019.'), par('APÊNDICE A – Questionário'), par('Pergunta 1'),
      ],
    };
    const s = separarDocumento(doc);
    expect(s.achouReferencias).toBe(true);
    expect(s.corpo.map((p) => p.texto)).toContain('Texto (Silva, 2020).');
    expect(s.referencias).toEqual(['SILVA, M. Título. São Paulo: Atlas, 2020. continuação da linha', 'A HUMANIZAÇÃO do cuidado. Revista, 2019.']);
  });
});

describe('ler referências', () => {
  test('pessoas, entidade, título e anos', () => {
    const r = lerReferencia('SILVA, M. A.; SOUZA NETO, J. Cuidado. Rev. Enf., v. 10, n. 2, p. 3-10, 2021. DOI: 10.1590/x2019. Disponível em: https://a.b/2018. Acesso em: 3 out. 2024.');
    expect(r.autores).toEqual(['silva', 'souza neto']);
    expect(r.ano).toBe('2021');
    expect(r.anos).toEqual(['2021']);
    expect(lerReferencia('BRASIL. Ministério da Saúde. Política. Brasília, DF: MS, 2013.').autores).toEqual(['brasil']);
    expect(lerReferencia('ORGANIZAÇÃO MUNDIAL DA SAÚDE. Relatório. Genebra: OMS, 2020a.').autores).toEqual(['organizacao mundial da saude']);
    expect(lerReferencia('ORGANIZAÇÃO MUNDIAL DA SAÚDE. Relatório. Genebra: OMS, 2020a.').ano).toBe('2020a');
    expect(lerReferencia('A HUMANIZAÇÃO do cuidado. Revista, 2019.').autores).toEqual(['a humanizacao']);
    expect(lerReferencia('LIMA, A. Livro. [S. l.]: Ed., [s. d.].').ano).toBe('sd');
  });
});

describe('encontrar citações', () => {
  test('entre parênteses: vários autores, várias obras, página, apud', () => {
    const c = encontrarCitacoes(corpo('Texto (SILVA; SOUZA, 2020, p. 15). Outro (Lima, 2010, 2015; Costa et al., 2021). E (Freire, 1996 apud Gadotti, 2003).'));
    expect(c).toHaveLength(3);
    expect(c[0].obras[0].autores.map((a) => a.escrito)).toEqual(['SILVA', 'SOUZA']);
    expect(c[0].obras[0].pagina).toBe('15');
    expect(c[0].estilo).toBe('maiusculas');
    expect(c[1].obras.map(rotuloObra)).toEqual(['Lima, 2010', 'Lima, 2015', 'Costa et al., 2021']);
    expect(c[1].estilo).toBe('minusculas');
    expect(c[2].obras.map((o) => [rotuloObra(o), !!o.apudOriginal])).toEqual([['Freire, 1996', true], ['Gadotti, 2003', false]]);
  });

  test('narrativa: com palavra antes, dois autores, et al., página', () => {
    const c = encontrarCitacoes(corpo('Segundo Freire (1996), ensinar exige. Silva e Souza (2020, p. 3) dizem algo. Para Costa et al. (2021) também. Em março (2020) nada.'));
    expect(c.map((x) => x.obras.map(rotuloObra)[0])).toEqual(['Freire, 1996', 'Silva; Souza, 2020', 'Costa et al., 2021']);
    expect(c[0].obras[0].autores[0].candidatos).toEqual(['segundo freire', 'freire']);
    expect(c[1].obras[0].pagina).toBe('3');
    expect(c[1].texto).toBe('Silva e Souza (2020, p. 3)');
  });

  test('não confunde parênteses comuns com citação', () => {
    expect(encontrarCitacoes(corpo('Foram 20 pacientes (adultos) em 2020 (dados do serviço).'))).toHaveLength(0);
    expect(encontrarCitacoes(corpo('A Lei (nº 8.080, de 1990) dispõe.'))).toHaveLength(0);
  });

  test('título como entrada, com reticências', () => {
    const c = encontrarCitacoes(corpo('Texto (A humanização..., 2019).'));
    expect(c[0].obras[0].autores[0]).toMatchObject({ escrito: 'A humanização', prefixo: true });
  });
});

describe('citações diretas', () => {
  test('aspas com citação depois, narrativa antes com (p. X), sem página e sem autoria', () => {
    const cp = corpo(
      'Como afirma a autora, “o cuidado começa na escuta atenta do paciente” (Silva, 2020, p. 12).',
      'Para Souza (2019), “a comunicação reduz a ansiedade dos pacientes” (p. 40). Já “o acolhimento é essencial para todos” (Lima, 2018).',
      'Uma frase entre aspas “que ninguém disse antes em lugar nenhum do mundo” aqui.',
      'Um “termo curto” não conta.',
    );
    const cits = encontrarCitacoes(cp);
    const d = encontrarCitacoesDiretas(cp, cits);
    expect(d.map((x) => [x.trecho.slice(0, 12), x.pagina ?? null, !!x.citacao])).toEqual([
      ['o cuidado co', '12', true],
      ['a comunicaçã', '40', true],
      ['o acolhiment', null, true],
      ['que ninguém ', null, false],
    ]);
  });

  test('citação longa recuada, com a citação no fim ou no parágrafo anterior', () => {
    const cp = [
      { texto: 'Silva (2020, p. 8) explica:', indice: 0 },
      { texto: 'O cuidado humanizado depende de tempo, de escuta e de uma equipe preparada para acolher as dúvidas.', indice: 1, recuoCm: 4 },
      { texto: 'O cuidado humanizado depende de tempo, de escuta e de uma equipe preparada. (Lima, 2018, p. 3).', indice: 2, recuoCm: 4 },
    ];
    const d = encontrarCitacoesDiretas(cp, encontrarCitacoes(cp));
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ recuada: true, pagina: '8' });
    expect(d[1].pagina).toBe('3');
    expect(d[1].trecho.endsWith('equipe preparada')).toBe(true);
  });
});

describe('cruzar citações e referências', () => {
  test('acha referência faltando, ano diferente, não citadas e sem página', () => {
    const cp = corpo(
      'Segundo Freire (1996), algo. Outro (Silva; Souza, 2021). E (Lima, 2010 apud Costa, 2015). Ainda (A humanização..., 2019).',
      '“O cuidado começa na escuta do paciente” (Silva; Souza, 2020). Também (Pereira, 2022) e (PEREIRA, 2022).',
    );
    const refs = [
      'FREIRE, P. Pedagogia da autonomia. São Paulo: Paz e Terra, 1996.',
      'SILVA, M.; SOUZA, J. Cuidado. Revista, v. 1, 2020.',
      'COSTA, A. Livro. Recife: UFPE, 2015.',
      'A HUMANIZAÇÃO do cuidado. Revista, 2019.',
      'NUNES, R. Nunca citado. 2018.',
    ].map((t, i) => lerReferencia(t, i));
    const cits = encontrarCitacoes(cp);
    const r = cruzarCitacoes(cits, encontrarCitacoesDiretas(cp, cits), refs);
    expect(r.problemas.map((p) => [p.tipo, p.obra, p.ocorrencias.length])).toEqual([
      ['sem_referencia', 'Pereira, 2022', 2],
      ['ano_diferente', 'Silva; Souza, 2021', 1],
    ]);
    expect(r.problemas[1].referencias[0].ano).toBe('2020');
    expect(r.naoCitadas.map((x) => x.autores[0])).toEqual(['nunes']);
    expect(r.semPagina).toHaveLength(1);
    expect(r.estilos).toEqual({ maiusculas: 1, minusculas: 5 });
  });
});
