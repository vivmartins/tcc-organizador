import { describe, expect, test } from 'vitest';
import { buscarPorDoi, combinar, converterCrossref, converterOpenAlex, limparTexto, separarNome, ErroDeImportacao } from './metadados.ts';
import { gerarReferencia } from '../domain/abnt/referencia.ts';
import type { DadosBibliograficos } from '../domain/tipos.ts';

// Respostas no formato real das APIs (campos e estrutura como o Crossref e o OpenAlex devolvem).
const CROSSREF_ARTIGO = {
  status: 'ok',
  message: {
    DOI: '10.1590/S0034-89102010000100001',
    type: 'journal-article',
    title: ['Humaniza&ccedil;&atilde;o no atendimento em <i>radioterapia</i>'],
    subtitle: ['revisão narrativa'],
    author: [
      { given: 'Maria Aparecida', family: 'Silva', sequence: 'first', affiliation: [] },
      { given: 'João', family: 'Souza', sequence: 'additional', affiliation: [] },
    ],
    'container-title': ['Revista de Saúde Pública'],
    publisher: 'FapUNIFESP (SciELO)',
    volume: '44',
    issue: '1',
    page: '1–9',
    'published-print': { 'date-parts': [[2010, 2]] },
    issued: { 'date-parts': [[2010, 2]] },
    URL: 'https://doi.org/10.1590/S0034-89102010000100001',
  },
};

const CROSSREF_CAPITULO = {
  status: 'ok',
  message: {
    DOI: '10.1007/978-3-030-00000-0_3',
    type: 'book-chapter',
    title: ['Patient communication in radiotherapy'],
    author: [{ given: 'Ana', family: 'Lima' }],
    editor: [{ given: 'Carlos', family: 'Pereira' }],
    'container-title': ['Supportive Care in Oncology'],
    publisher: 'Springer International Publishing',
    'publisher-location': 'Cham',
    page: '33-50',
    issued: { 'date-parts': [[2019]] },
  },
};

const CROSSREF_EVENTO = {
  status: 'ok',
  message: {
    DOI: '10.1109/x.2018.1',
    type: 'proceedings-article',
    title: ['Patient safety in RT'],
    author: [{ given: 'Pedro', family: 'Rocha' }, { name: 'Grupo de Física Médica' }],
    'container-title': ['Anais do 20º Congresso'],
    event: { name: 'Congresso Brasileiro de Radioterapia', location: 'Recife' },
    issued: { 'date-parts': [[2018, 10]] },
  },
};

const OPENALEX_ARTIGO = {
  id: 'https://openalex.org/W123',
  doi: 'https://doi.org/10.1590/s0034-89102010000100001',
  title: 'Humanização no atendimento em radioterapia',
  display_name: 'Humanização no atendimento em radioterapia',
  publication_year: 2010,
  type: 'article',
  authorships: [{ author: { display_name: 'Maria Aparecida Silva' } }, { author: { display_name: 'João Souza Filho' } }],
  primary_location: { source: { display_name: 'Revista de Saúde Pública', type: 'journal' } },
  biblio: { volume: '44', issue: '1', first_page: '1', last_page: '9' },
};

describe('conversões', () => {
  test('limpa HTML e entidades dos títulos', () => {
    expect(limparTexto('Humaniza&ccedil;&atilde;o em <i>radio</i>terapia &amp; X')).toBe('Humanização em radioterapia & X');
    expect(limparTexto('  ')).toBeUndefined();
  });

  test('separa nome completo em sobrenome e prenomes (com Filho/Júnior)', () => {
    expect(separarNome('Maria A. Silva')).toEqual({ tipo: 'pessoa', sobrenome: 'Silva', prenomes: 'Maria A.' });
    expect(separarNome('João Souza Filho')).toEqual({ tipo: 'pessoa', sobrenome: 'Souza Filho', prenomes: 'João' });
    expect(separarNome('Platão')).toEqual({ tipo: 'pessoa', sobrenome: 'Platão' });
  });

  test('artigo do Crossref vira uma referência ABNT completa', () => {
    const d = converterCrossref(CROSSREF_ARTIGO.message) as DadosBibliograficos;
    expect(d.tipo).toBe('artigo_periodico');
    expect(d.titulo).toBe('Humanização no atendimento em radioterapia');
    expect(d.paginas).toBe('1-9');
    expect(d.editora).toBeUndefined(); // empresa que publica a revista não entra
    expect(gerarReferencia(d).texto).toBe(
      'SILVA, Maria Aparecida; SOUZA, João. Humanização no atendimento em radioterapia: revisão narrativa. ' +
        'Revista de Saúde Pública, v. 44, n. 1, p. 1-9, 2010. DOI: 10.1590/S0034-89102010000100001.',
    );
  });

  test('capítulo traz organizadores, livro, local e editora', () => {
    const d = converterCrossref(CROSSREF_CAPITULO.message) as DadosBibliograficos;
    expect(d.tipo).toBe('capitulo_livro');
    expect(gerarReferencia(d).texto).toBe(
      'LIMA, Ana. Patient communication in radiotherapy. In: PEREIRA, Carlos (org.). Supportive Care in Oncology. Cham: Springer International Publishing, 2019. p. 33-50. DOI: 10.1007/978-3-030-00000-0_3.',
    );
  });

  test('trabalho em evento: nome e local do evento, anais e autoria institucional', () => {
    const d = converterCrossref(CROSSREF_EVENTO.message);
    expect(d.tipo).toBe('trabalho_evento');
    expect(d.veiculo).toBe('Congresso Brasileiro de Radioterapia');
    expect(d.localEvento).toBe('Recife');
    expect(d.tituloAnais).toBe('Anais do 20º Congresso');
    expect(d.autores?.[1]).toEqual({ tipo: 'entidade', sobrenome: 'Grupo de Física Médica' });
  });

  test('OpenAlex: nome completo separado e páginas montadas', () => {
    const d = converterOpenAlex(OPENALEX_ARTIGO);
    expect(d.autores?.[1]).toEqual({ tipo: 'pessoa', sobrenome: 'Souza Filho', prenomes: 'João' });
    expect(d.paginas).toBe('1-9');
    expect(d.doi).toBe('10.1590/s0034-89102010000100001');
  });

  test('combinar: Crossref é a base; OpenAlex só completa o que falta', () => {
    const cr = converterCrossref({ ...CROSSREF_ARTIGO.message, volume: undefined });
    const r = combinar(cr, converterOpenAlex(OPENALEX_ARTIGO));
    expect(r.dados.autores?.[1].sobrenome).toBe('Souza'); // do Crossref, não substituído
    expect(r.dados.volume).toBe('44');
    expect(r.origemDosCampos.volume).toBe('openalex');
    expect(r.origemDosCampos.titulo).toBe('crossref');
    expect(r.servicos).toEqual(['crossref', 'openalex']);
  });

  test('combinar: tipos diferentes não misturam periódico com livro', () => {
    const r = combinar(converterCrossref(CROSSREF_CAPITULO.message), { tipo: 'artigo_periodico', veiculo: 'Outra revista', volume: '9' });
    expect(r.dados.veiculo).toBe('Supportive Care in Oncology');
    expect(r.dados.volume).toBe('9');
  });
});

describe('busca por DOI', () => {
  const resposta = (status: number, corpo?: unknown) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });

  test('consulta Crossref e OpenAlex e combina', async () => {
    const urls: string[] = [];
    const r = await buscarPorDoi('https://doi.org/10.1590/S0034-89102010000100001', async (u) => {
      urls.push(u);
      return u.includes('crossref') ? resposta(200, CROSSREF_ARTIGO) : resposta(200, OPENALEX_ARTIGO);
    });
    expect(urls.some((u) => u.startsWith('https://api.crossref.org/works/10.1590/s0034'))).toBe(true);
    expect(urls.some((u) => u.startsWith('https://api.openalex.org/works/doi:10.1590/'))).toBe(true);
    expect(r.dados.titulo).toBe('Humanização no atendimento em radioterapia');
  });

  test('se o Crossref não conhece o DOI, usa o OpenAlex', async () => {
    const r = await buscarPorDoi('10.1590/s0034-89102010000100001', async (u) => (u.includes('crossref') ? resposta(404) : resposta(200, OPENALEX_ARTIGO)));
    expect(r.servicos).toEqual(['openalex']);
    expect(r.dados.autores).toHaveLength(2);
  });

  test('se o Crossref está fora do ar, ainda tenta o OpenAlex', async () => {
    const r = await buscarPorDoi('10.1590/x', async (u) => { if (u.includes('crossref')) throw new TypeError('Failed to fetch'); return resposta(200, OPENALEX_ARTIGO); });
    expect(r.servicos).toEqual(['openalex']);
  });

  test('mensagens claras para DOI inválido, não encontrado e sem internet', async () => {
    await expect(buscarPorDoi('abc', async () => resposta(200, {}))).rejects.toThrow('não parece um DOI');
    await expect(buscarPorDoi('10.1590/naoexiste', async () => resposta(404))).rejects.toThrow('Nenhum dado encontrado');
    await expect(buscarPorDoi('10.1590/x', async () => { throw new TypeError('Failed to fetch'); })).rejects.toThrow('Sem conexão');
    await expect(buscarPorDoi('10.1590/x', async () => resposta(500))).rejects.toBeInstanceOf(ErroDeImportacao);
  });
});
