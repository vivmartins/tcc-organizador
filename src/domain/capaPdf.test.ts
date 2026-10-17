import { expect, test } from 'vitest';
import { lerCapa, lerFasciculo, lerNomes, montarLinhas, type LinhaPdf } from './capaPdf.ts';

/** Monta linhas de cima para baixo: [altura, texto, espaço antes (em linhas)]. */
function pagina(...l: [number, string, number?][]): LinhaPdf[] {
  let y = 800;
  return l.map(([altura, texto, antes = 0]) => { y -= altura * (1.3 + antes); return { texto, x: 72, y, altura }; });
}

test('junta índices superiores ao nome e separa os autores', () => {
  const linhas = montarLinhas([
    { str: 'Ana Lima', x: 72, y: 700, altura: 10, largura: 40 },
    { str: '1', x: 112, y: 704, altura: 6, largura: 3 },
    { str: ', Carlos de Souza', x: 115, y: 700, altura: 10, largura: 80 },
    { str: '2', x: 195, y: 704, altura: 6, largura: 3 },
  ]);
  expect(linhas).toHaveLength(1);
  expect(lerNomes(linhas[0].texto)).toEqual(['Ana Lima', 'Carlos de Souza']);
  expect(lerNomes('Rui Wang^1^and Günter Neumann^2^')).toEqual(['Rui Wang', 'Günter Neumann']);
  expect(lerNomes('Information Synthesis for Answer Validation')).toBeNull();
  expect(lerNomes('Universidade Federal de São Paulo')).toBeNull();
});

test('fascículo nos estilos Vancouver e ABNT', () => {
  expect(lerFasciculo('Rev Bras Enferm. 2021;74(2):112-20')).toEqual({ veiculo: 'Rev Bras Enferm', ano: 2021, volume: '74', numero: '2', paginas: '112-20' });
  expect(lerFasciculo('Revista X, Curitiba, v. 8, n. 1, p. 45-58, jan./jun. 2019.')).toEqual({ veiculo: 'Revista X', volume: '8', numero: '1', paginas: '45-58', ano: 2019 });
});

test('artigo: título maior com autores abaixo (não o título em inglês nem o rótulo da seção)', () => {
  const r = lerCapa([pagina(
    [8, 'Rev Bras Fis Med. 2021;15(2):e20210045'],
    [9, 'ARTIGO ORIGINAL'],
    [16, 'Verificação diária por imagem na radioterapia de próstata: impacto nas', 1],
    [16, 'margens de planejamento'],
    [11, 'Daily image verification in prostate radiotherapy'],
    [10, 'Mariana Costa Ribeiro^1^, Carlos Eduardo de Souza^2^, Rita de Cássia Dias Filho^1,3^'],
    [7.5, '^1^Universidade Federal de São Paulo, São Paulo, SP, Brasil.'],
    [9, 'RESUMO', 1],
    ...Array.from({ length: 12 }, () => [9, 'Texto do resumo com várias palavras para formar o corpo do artigo.'] as [number, string]),
  )]);
  expect(r.dados).toMatchObject({
    tipo: 'artigo_periodico', titulo: 'Verificação diária por imagem na radioterapia de próstata', subtitulo: 'impacto nas margens de planejamento',
    veiculo: 'Rev Bras Fis Med', ano: 2021, volume: '15', numero: '2', numeroArtigo: 'e20210045',
  });
  expect(r.dados.autores?.map((a) => `${a.sobrenome}, ${a.prenomes}`)).toEqual(['Ribeiro, Mariana Costa', 'Souza, Carlos Eduardo de', 'Dias Filho, Rita de Cássia']);
});

test('título em maiúsculas vira minúsculas (siglas sem vogal ficam) e avisa', () => {
  const r = lerCapa([pagina(
    [13, 'MARGENS DE PTV EM RADIOTERAPIA GUIADA POR IMAGEM:'],
    [13, 'REVISÃO INTEGRATIVA'],
    [10.5, 'João Pedro Almeida^*^', 1],
    ...Array.from({ length: 10 }, () => [10.5, 'Corpo do texto do artigo com muitas palavras seguidas.'] as [number, string]),
  )]);
  expect(r.dados.titulo).toBe('Margens de PTV em radioterapia guiada por imagem');
  expect(r.dados.subtitulo).toBe('revisão integrativa');
  expect(r.avisos.join(' ')).toMatch(/maiúsculas/);
});

test('capa de dissertação: instituição, autora, título, local e ano; tipo pela folha de rosto', () => {
  const r = lerCapa([
    pagina(
      [12, 'UNIVERSIDADE FEDERAL DE SÃO PAULO'], [12, 'ESCOLA PAULISTA DE MEDICINA'],
      [12, 'MARIANA COSTA RIBEIRO', 6],
      [12, 'VERIFICAÇÃO DE POSICIONAMENTO POR IMAGEM NA RADIOTERAPIA', 8], [12, 'DE PRÓSTATA:'], [12, 'análise das margens de planejamento', 0.6],
      [12, 'SÃO PAULO', 10], [12, '2022'],
    ),
    pagina([12, 'Dissertação apresentada ao Programa de Pós-Graduação em Ciências da Saúde da Universidade Federal de São Paulo, como requisito para obtenção do título de Mestre em Ciências da Saúde.']),
  ]);
  expect(r.dados).toMatchObject({
    tipo: 'dissertacao', tipoTrabalho: 'Dissertação (Mestrado em Ciências da Saúde)',
    veiculo: 'Escola Paulista de Medicina, Universidade Federal de São Paulo', localPublicacao: 'São Paulo', ano: 2022,
    titulo: 'Verificação de posicionamento por imagem na radioterapia de próstata', subtitulo: 'análise das margens de planejamento',
  });
  expect(r.dados.autores).toEqual([{ tipo: 'pessoa', sobrenome: 'Ribeiro', prenomes: 'Mariana Costa' }]);
});

test('não inventa: sem título reconhecível, devolve vazio; metadados do arquivo só se forem um título de verdade', () => {
  const corpo = pagina(...Array.from({ length: 10 }, () => [10, 'Um texto qualquer sem título destacado.'] as [number, string]));
  expect(lerCapa([corpo], { Title: 'Microsoft Word - artigo_final.docx', Author: 'usuario' }).dados).toEqual({});
  expect(lerCapa([corpo], { Title: 'Comunicação com pacientes em radioterapia', Author: 'Ana Lima; Carlos Souza' }).dados).toMatchObject({
    titulo: 'Comunicação com pacientes em radioterapia', autores: [{ sobrenome: 'Lima' }, { sobrenome: 'Souza' }],
  });
});
