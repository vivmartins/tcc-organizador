// Testes do gerador ABNT. Rodar com: node --test src/domain
import { test } from 'vitest';
import assert from 'node:assert/strict';
import type { DadosBibliograficos } from '../tipos.ts';
import { gerarReferencia, gerarListaDeReferencias, formatarDataAcesso, tituloComoEntrada } from './referencia.ts';
import { gerarCitacao, capitalizarSobrenome } from './citacao.ts';

const P = (sobrenome: string, prenomes?: string) => ({ tipo: 'pessoa' as const, sobrenome, prenomes });

// ---------------------------------------------------------------------
// Referências — NBR 6023:2018
// ---------------------------------------------------------------------

const artigo: DadosBibliograficos = {
  tipo: 'artigo_periodico',
  autores: [P('Silva', 'Maria Aparecida'), P('Souza', 'João')],
  titulo: 'Humanização no atendimento em radioterapia',
  subtitulo: 'revisão narrativa',
  veiculo: 'Revista Brasileira de Cancerologia',
  localPublicacao: 'Rio de Janeiro',
  volume: '67',
  numero: '2',
  paginas: '45 - 60',
  ano: 2021,
  doi: 'https://doi.org/10.32635/2176-9745.RBC.2021v67n2.1234',
  url: 'https://rbc.inca.gov.br/index.php/revista/article/view/1234',
  dataAcesso: '2026-10-14',
};

test('artigo de periódico completo', () => {
  const r = gerarReferencia(artigo);
  assert.equal(
    r.texto,
    'SILVA, Maria Aparecida; SOUZA, João. Humanização no atendimento em radioterapia: revisão narrativa. ' +
      'Revista Brasileira de Cancerologia, Rio de Janeiro, v. 67, n. 2, p. 45-60, 2021. ' +
      'DOI: 10.32635/2176-9745.RBC.2021v67n2.1234. ' +
      'Disponível em: https://rbc.inca.gov.br/index.php/revista/article/view/1234. Acesso em: 14 out. 2026.',
  );
  assert.ok(r.html.includes('<strong>Revista Brasileira de Cancerologia</strong>,'));
  assert.equal(r.completa, true);
});

test('livro com edição e subtítulo (só o título em negrito)', () => {
  const r = gerarReferencia({
    tipo: 'livro',
    autores: [P('Freire', 'Paulo')],
    titulo: 'Pedagogia da autonomia',
    subtitulo: 'saberes necessários à prática educativa',
    edicao: '25ª edição',
    localPublicacao: 'São Paulo',
    editora: 'Paz e Terra',
    ano: 2002,
  });
  assert.equal(
    r.texto,
    'FREIRE, Paulo. Pedagogia da autonomia: saberes necessários à prática educativa. 25. ed. São Paulo: Paz e Terra, 2002.',
  );
  assert.ok(r.html.startsWith('FREIRE, Paulo. <strong>Pedagogia da autonomia</strong>: saberes'));
});

test('livro sem local e editora usa [S. l.: s. n.] e não indica 1ª edição', () => {
  const r = gerarReferencia({ tipo: 'livro', autores: [P('Lima', 'A.')], titulo: 'Título', edicao: '1', ano: 2015 });
  assert.equal(r.texto, 'LIMA, A. Título. [S. l.: s. n.], 2015.');
  assert.ok(r.pendencias.some((p) => p.campo === 'localPublicacao' && p.nivel === 'recomendado'));
});

test('apenas local ou apenas editora', () => {
  const base = { tipo: 'livro' as const, autores: [P('Lima', 'A.')], titulo: 'T', ano: 2015 };
  assert.match(gerarReferencia({ ...base, localPublicacao: 'Curitiba' }).texto, /Curitiba: \[s\. n\.\], 2015\.$/);
  assert.match(gerarReferencia({ ...base, editora: 'Atlas' }).texto, /\[S\. l\.\]: Atlas, 2015\.$/);
});

test('capítulo de livro', () => {
  const r = gerarReferencia({
    tipo: 'capitulo_livro',
    autores: [P('Lima', 'Ana')],
    titulo: 'Comunicação em saúde',
    organizadores: [P('Pereira', 'Carlos')],
    veiculo: 'Cuidado em oncologia',
    localPublicacao: 'Porto Alegre',
    editora: 'Artmed',
    ano: 2019,
    paginas: '33-50',
  });
  assert.equal(
    r.texto,
    'LIMA, Ana. Comunicação em saúde. In: PEREIRA, Carlos (org.). Cuidado em oncologia. Porto Alegre: Artmed, 2019. p. 33-50.',
  );
  assert.ok(r.html.includes('<strong>Cuidado em oncologia</strong>.'));
});

test('dissertação', () => {
  const r = gerarReferencia({
    tipo: 'dissertacao',
    autores: [P('Costa', 'Beatriz')],
    titulo: 'Experiência do paciente em radioterapia',
    tipoTrabalho: 'Dissertação (Mestrado em Enfermagem)',
    veiculo: 'Universidade de São Paulo',
    localPublicacao: 'São Paulo',
    ano: 2020,
  });
  assert.equal(
    r.texto,
    'COSTA, Beatriz. Experiência do paciente em radioterapia. 2020. ' +
      'Dissertação (Mestrado em Enfermagem) – Universidade de São Paulo, São Paulo, 2020.',
  );
});

test('trabalho publicado em anais de evento', () => {
  const r = gerarReferencia({
    tipo: 'trabalho_evento',
    autores: [P('Rocha', 'Pedro')],
    titulo: 'Segurança do paciente',
    veiculo: 'Congresso Brasileiro de Radioterapia',
    numeroEvento: '20º',
    anoEvento: 2018,
    localEvento: 'Recife',
    localPublicacao: 'Recife',
    editora: 'SBRT',
    ano: 2018,
    paginas: '10-12',
  });
  assert.equal(
    r.texto,
    'ROCHA, Pedro. Segurança do paciente. In: CONGRESSO BRASILEIRO DE RADIOTERAPIA, 20., 2018, Recife. ' +
      'Anais [...]. Recife: SBRT, 2018. p. 10-12.',
  );
});

test('autoria de entidade com hierarquia', () => {
  const r = gerarReferencia({
    tipo: 'documento_institucional',
    autores: [{ tipo: 'entidade', sobrenome: 'Brasil. Ministério da Saúde' }],
    titulo: 'Política Nacional de Humanização',
    localPublicacao: 'Brasília',
    editora: 'Ministério da Saúde',
    ano: 2013,
  });
  assert.equal(r.texto, 'BRASIL. Ministério da Saúde. Política Nacional de Humanização. Brasília: Ministério da Saúde, 2013.');
});

test('sem autoria: entrada pelo título, sem negrito, artigo inicial incluído', () => {
  const r = gerarReferencia({ tipo: 'livro', autores: [], titulo: 'O cuidado humanizado', localPublicacao: 'Natal', editora: 'EDUFRN', ano: 2010 });
  assert.equal(r.texto, 'O CUIDADO humanizado. Natal: EDUFRN, 2010.');
  assert.ok(!r.html.includes('<strong>'));
  assert.equal(tituloComoEntrada('Radioterapia hoje'), 'RADIOTERAPIA hoje');
});

test('quatro ou mais autores: todos por padrão, et al. quando escolhido', () => {
  const d: DadosBibliograficos = {
    tipo: 'livro',
    autores: [P('Silva', 'A.'), P('Souza', 'B.'), P('Lima', 'C.'), P('Rocha', 'D.')],
    titulo: 'T',
    localPublicacao: 'X',
    editora: 'Y',
    ano: 2000,
  };
  assert.ok(gerarReferencia(d).texto.startsWith('SILVA, A.; SOUZA, B.; LIMA, C.; ROCHA, D. T.'));
  assert.ok(gerarReferencia(d, { etAlAPartirDe4: true }).texto.startsWith('SILVA, A. et al. T.'));
});

// ---------------------------------------------------------------------
// Metadados incompletos: nada é inventado
// ---------------------------------------------------------------------

test('artigo sem ano e sem periódico fica marcado e incompleto', () => {
  const r = gerarReferencia({ tipo: 'artigo_periodico', autores: [P('Silva', 'M.')], titulo: 'Estudo X' });
  assert.equal(r.texto, 'SILVA, M. Estudo X. [PERIÓDICO?], [ANO?].');
  assert.equal(r.completa, false);
  const obrig = r.pendencias.filter((p) => p.nivel === 'obrigatorio').map((p) => p.campo).sort();
  assert.deepEqual(obrig, ['ano', 'veiculo']);
});

test('URL sem data de acesso deixa marcador e pendência obrigatória', () => {
  const r = gerarReferencia({ ...artigo, dataAcesso: undefined });
  assert.ok(r.texto.endsWith('Acesso em: [DATA DE ACESSO?].'));
  assert.equal(r.completa, false);
});

test('data de acesso inválida é apontada', () => {
  const r = gerarReferencia({ ...artigo, dataAcesso: '2026-13-40' });
  assert.ok(r.pendencias.some((p) => p.campo === 'dataAcesso' && p.mensagem.includes('inválida')));
});

test('diferencia dados verificados de dados importados ou não conferidos', () => {
  const r = gerarReferencia({
    ...artigo,
    statusCampos: { titulo: 'verificado', autores: 'verificado', veiculo: 'importado' },
  });
  const conferir = r.pendencias.filter((p) => p.nivel === 'conferir');
  assert.ok(!conferir.some((p) => p.campo === 'titulo' || p.campo === 'autores'));
  assert.ok(conferir.some((p) => p.campo === 'veiculo' && p.mensagem.includes('busca automática')));
  assert.ok(conferir.some((p) => p.campo === 'paginas' && p.mensagem.includes('não foi conferido')));
  assert.equal(r.completa, true); // conferir não impede, mas fica visível
});

test('ignora dados que não são bibliográficos (tags, resumo, listas)', () => {
  const comExtras = { ...artigo, resumo: { objetivo: 'x' }, tagIds: ['t1'], palavrasChave: ['a'], statusLeitura: 'lido' } as DadosBibliograficos;
  const r = gerarReferencia(comExtras);
  assert.equal(r.texto, gerarReferencia(artigo).texto);
  assert.ok(r.pendencias.every((p) => p.campo in { titulo: 1, subtitulo: 1, autores: 1, ano: 1, veiculo: 1, localPublicacao: 1, volume: 1, numero: 1, paginas: 1, doi: 1, url: 1, dataAcesso: 1 }));
});

test('datas de acesso por extenso abreviado', () => {
  assert.equal(formatarDataAcesso('2026-05-03'), '3 maio 2026');
  assert.equal(formatarDataAcesso('2026-09-30'), '30 set. 2026');
  assert.equal(formatarDataAcesso('ontem'), null);
});

test('lista de referências em ordem alfabética', () => {
  const lista = gerarListaDeReferencias([
    { tipo: 'livro', autores: [P('Zanetti', 'A.')], titulo: 'Z', ano: 2001 },
    { tipo: 'livro', autores: [P('Álvares', 'B.')], titulo: 'A', ano: 2002 },
    { tipo: 'livro', autores: [P('Moura', 'C.')], titulo: 'M', ano: 2003 },
  ]);
  assert.deepEqual(
    lista.referencias.map((r) => r.texto.split(',')[0]),
    ['ÁLVARES', 'MOURA', 'ZANETTI'],
  );
  assert.equal(lista.texto.split('\n\n').length, 3);
});

test('caracteres especiais são escapados no HTML', () => {
  const r = gerarReferencia({ tipo: 'livro', autores: [P('Lima', 'A.')], titulo: 'A <b> & C', ano: 2000 });
  assert.ok(r.html.includes('A &lt;b&gt; &amp; C'));
});

// ---------------------------------------------------------------------
// Citações — NBR 10520:2023
// ---------------------------------------------------------------------

test('citação com um autor e página', () => {
  const d = { ...artigo, autores: [P('Silva', 'M.')] };
  assert.equal(gerarCitacao(d, { pagina: '15' }), '(Silva, 2021, p. 15)');
  assert.equal(gerarCitacao(d, { estilo: 'narrativa', pagina: '15-16' }), 'Silva (2021, p. 15-16)');
});

test('citação com dois e três autores', () => {
  assert.equal(gerarCitacao(artigo, { pagina: '15' }), '(Silva; Souza, 2021, p. 15)');
  assert.equal(gerarCitacao(artigo, { estilo: 'narrativa' }), 'Silva e Souza (2021)');
  const tres = { ...artigo, autores: [P('Silva'), P('Souza'), P('Lima')] };
  assert.equal(gerarCitacao(tres), '(Silva; Souza; Lima, 2021)');
  assert.equal(gerarCitacao(tres, { estilo: 'narrativa' }), 'Silva, Souza e Lima (2021)');
});

test('citação com quatro ou mais autores usa et al.', () => {
  const quatro = { ...artigo, autores: [P('Silva'), P('Souza'), P('Lima'), P('Rocha')] };
  assert.equal(gerarCitacao(quatro), '(Silva et al., 2021)');
  assert.equal(gerarCitacao(quatro, { estilo: 'narrativa' }), 'Silva et al. (2021)');
});

test('citação de entidade, sem autoria, sem ano e com localização não numérica', () => {
  const ent: DadosBibliograficos = { tipo: 'documento_institucional', autores: [{ tipo: 'entidade', sobrenome: 'Brasil. Ministério da Saúde' }], titulo: 'PNH', ano: 2013 };
  assert.equal(gerarCitacao(ent), '(Brasil, 2013)');
  const semAutor: DadosBibliograficos = { tipo: 'livro', autores: [], titulo: 'O cuidado humanizado', ano: 2010 };
  assert.equal(gerarCitacao(semAutor), '(O cuidado [...], 2010)');
  const semAno: DadosBibliograficos = { tipo: 'livro', autores: [P('Silva')], titulo: 'T' };
  assert.equal(gerarCitacao(semAno), '(Silva, [ano?])');
  assert.equal(gerarCitacao({ ...semAno, ano: 2021 }, { pagina: 'seção 3' }), '(Silva, 2021, seção 3)');
});

test('sobrenomes digitados em maiúsculas são ajustados; caixa mista é respeitada', () => {
  assert.equal(capitalizarSobrenome('SILVA FILHO'), 'Silva Filho');
  assert.equal(capitalizarSobrenome('SANTOS-DUMONT'), 'Santos-Dumont');
  assert.equal(capitalizarSobrenome('OLIVEIRA DA COSTA'), 'Oliveira da Costa');
  assert.equal(capitalizarSobrenome('McDonald'), 'McDonald');
});
