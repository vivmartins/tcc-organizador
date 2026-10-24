// Busca de metadados bibliográficos por DOI.
//
// Fontes: Crossref (principal) e OpenAlex (complementa o que faltar e serve de
// reserva se o Crossref falhar). As consultas saem direto do navegador de quem
// usa o app; nenhum servidor nosso participa.
//
// Regra de ouro: só preenche o que o serviço informou. O que não vier fica vazio
// e aparece como pendência para a estudante completar.

import type { Autor, CampoBibliografico, DadosBibliograficos, TipoPublicacao } from '../domain/tipos.ts';
import { normalizarDoi } from '../domain/abnt/referencia.ts';

export type FonteDeDados = 'crossref' | 'openalex' | 'pdf';
export type Importado = Partial<Omit<DadosBibliograficos, 'statusCampos'>>;

export interface ResultadoImportacao {
  dados: Importado;
  /** Campos preenchidos e de qual serviço vieram. */
  origemDosCampos: Partial<Record<CampoBibliografico | 'tipo', FonteDeDados>>;
  servicos: FonteDeDados[];
  /** Palavras-chave do OpenAlex (geradas automaticamente, em geral em inglês). */
  palavrasChave: string[];
  /** Tópicos do OpenAlex, para sugerir temas (em inglês). */
  temas: string[];
  /** Resumo (abstract) do OpenAlex, quando disponível, para a auditoria. */
  resumo?: string;
  /** O OpenAlex encontrou uma versão gratuita (acesso aberto) do texto completo. */
  acessoAberto?: { url?: string };
}

export class ErroDeImportacao extends Error {}

/** Monta o texto do resumo a partir do "índice invertido" do OpenAlex ({palavra: [posições]}). */
export function resumoDoIndiceInvertido(indice?: Record<string, number[]> | null): string | null {
  if (!indice) return null;
  const palavras: string[] = [];
  for (const [palavra, posicoes] of Object.entries(indice)) for (const p of posicoes) palavras[p] = palavra;
  const texto = palavras.filter(Boolean).join(' ').trim();
  return texto || null;
}


type Buscar = (url: string) => Promise<Response>;

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
/** Remove marcações HTML/MathML e decodifica entidades (&ccedil; etc.) que o Crossref às vezes manda nos títulos.
 *  O DOMParser apenas lê o texto: nenhum script é executado. */
export function limparTexto(s?: string | null): string | undefined {
  if (!s) return undefined;
  const t = new DOMParser().parseFromString(`<!doctype html><body>${s}`, 'text/html').body.textContent ?? '';
  const limpo = t.replace(/\s+/g, ' ').trim();
  return limpo || undefined;
}

const SUFIXOS = new Set(['filho', 'filha', 'júnior', 'junior', 'jr', 'jr.', 'neto', 'neta', 'sobrinho', 'sobrinha']);

/** "Maria A. Silva Filho" → sobrenome "Silva Filho", prenomes "Maria A.". Usado quando o serviço só dá o nome completo. */
export function separarNome(completo: string): Autor {
  const partes = completo.replace(/\s+/g, ' ').trim().split(' ');
  if (partes.length === 1) return { tipo: 'pessoa', sobrenome: partes[0] };
  let n = 1;
  if (partes.length > 2 && SUFIXOS.has(partes[partes.length - 1].toLowerCase())) n = 2;
  return { tipo: 'pessoa', sobrenome: partes.slice(-n).join(' '), prenomes: partes.slice(0, -n).join(' ') };
}

/** "Título: subtítulo" → separa nas duas partes, quando o serviço não informa o subtítulo à parte. */
export function separarTitulo(titulo?: string, subtitulo?: string): { titulo?: string; subtitulo?: string } {
  if (!titulo || subtitulo) return { titulo, subtitulo };
  const i = titulo.indexOf(': ');
  if (i < 3 || i > titulo.length - 4) return { titulo };
  return { titulo: titulo.slice(0, i).trim(), subtitulo: titulo.slice(i + 2).trim() };
}

/** Endereço da página do artigo (não o link do DOI, que já vai no campo DOI). */
function urlDoArtigo(...candidatos: (string | null | undefined)[]): string | undefined {
  for (const c of candidatos) {
    const u = c?.trim();
    if (!u || !/^https?:\/\//i.test(u)) continue;
    if (/^https?:\/\/(dx\.)?doi\.org\//i.test(u)) continue;
    return u;
  }
  return undefined;
}

function paginasDe(first?: string | null, last?: string | null): string | undefined {
  if (!first) return undefined;
  return last && last !== first ? `${first}-${last}` : first;
}

// ---------------------------------------------------------------------
// Crossref
// ---------------------------------------------------------------------
const TIPO_CROSSREF: Record<string, TipoPublicacao> = {
  'journal-article': 'artigo_periodico',
  book: 'livro',
  monograph: 'livro',
  'edited-book': 'livro',
  'reference-book': 'livro',
  'book-chapter': 'capitulo_livro',
  'book-section': 'capitulo_livro',
  'book-part': 'capitulo_livro',
  'proceedings-article': 'trabalho_evento',
  dissertation: 'dissertacao',
  report: 'documento_institucional',
};

interface PessoaCrossref { given?: string; family?: string; name?: string }
interface MensagemCrossref {
  DOI?: string;
  URL?: string;
  resource?: { primary?: { URL?: string } };
  type?: string;
  title?: string[];
  subtitle?: string[];
  author?: PessoaCrossref[];
  editor?: PessoaCrossref[];
  'container-title'?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  'article-number'?: string;
  publisher?: string;
  'publisher-location'?: string;
  ISBN?: string[];
  ISSN?: string[];
  issued?: { 'date-parts'?: (number | null)[][] };
  published?: { 'date-parts'?: (number | null)[][] };
  'published-print'?: { 'date-parts'?: (number | null)[][] };
  'published-online'?: { 'date-parts'?: (number | null)[][] };
  event?: { name?: string; location?: string };
  institution?: { name?: string }[];
}

function pessoasCrossref(lista?: PessoaCrossref[]): Autor[] {
  return (lista ?? [])
    .map((p): Autor | null => {
      const family = limparTexto(p.family);
      if (family) return { tipo: 'pessoa', sobrenome: family, prenomes: limparTexto(p.given) };
      const nome = limparTexto(p.name);
      return nome ? { tipo: 'entidade', sobrenome: nome } : null;
    })
    .filter((a): a is Autor => !!a);
}

function anoCrossref(m: MensagemCrossref): number | undefined {
  for (const d of [m['published-print'], m.published, m.issued, m['published-online']]) {
    const ano = d?.['date-parts']?.[0]?.[0];
    if (typeof ano === 'number' && ano > 1000) return ano;
  }
  return undefined;
}

export function converterCrossref(m: MensagemCrossref): Importado {
  const tipo = TIPO_CROSSREF[m.type ?? ''] ?? 'outro';
  const container = limparTexto(m['container-title']?.[0]);
  const d: Importado = {
    tipo,
    ...separarTitulo(limparTexto(m.title?.[0]), limparTexto(m.subtitle?.[0])),
    autores: pessoasCrossref(m.author),
    url: urlDoArtigo(m.resource?.primary?.URL),
    ano: anoCrossref(m),
    doi: m.DOI,
    volume: limparTexto(m.volume),
    numero: limparTexto(m.issue),
    paginas: limparTexto(m.page)?.replace(/[–—]/g, '-'),
    numeroArtigo: limparTexto(m['article-number']),
    editora: limparTexto(m.publisher),
    localPublicacao: limparTexto(m['publisher-location']),
  };
  if (tipo === 'artigo_periodico') {
    d.veiculo = container;
    // Em artigos, a "editora" do Crossref é a empresa que publica a revista: não entra na referência ABNT.
    delete d.editora;
  } else if (tipo === 'capitulo_livro') {
    d.veiculo = container;
    d.organizadores = pessoasCrossref(m.editor);
  } else if (tipo === 'trabalho_evento') {
    d.veiculo = limparTexto(m.event?.name) ?? container;
    d.localEvento = limparTexto(m.event?.location);
    if (container && container !== d.veiculo) d.tituloAnais = container;
  } else if (tipo === 'dissertacao') {
    d.veiculo = limparTexto(m.institution?.[0]?.name) ?? limparTexto(m.publisher);
    delete d.editora;
  } else if (tipo === 'outro' && container) {
    d.veiculo = container;
  }
  return d;
}

// ---------------------------------------------------------------------
// OpenAlex
// ---------------------------------------------------------------------
const TIPO_OPENALEX: Record<string, TipoPublicacao> = {
  article: 'artigo_periodico',
  review: 'artigo_periodico',
  letter: 'artigo_periodico',
  editorial: 'artigo_periodico',
  book: 'livro',
  'book-chapter': 'capitulo_livro',
  dissertation: 'dissertacao',
  report: 'documento_institucional',
};

interface ObraOpenAlex {
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  type?: string | null;
  authorships?: { author?: { display_name?: string | null } | null; raw_author_name?: string | null }[];
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null; type?: string | null; host_organization_name?: string | null } | null } | null;
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null } | null;
  keywords?: { display_name?: string | null; score?: number | null }[] | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_topic?: TopicoOpenAlex | null;
  topics?: TopicoOpenAlex[] | null;
  open_access?: { is_oa?: boolean | null; oa_url?: string | null } | null;
}
interface TopicoOpenAlex { display_name?: string | null; score?: number | null; subfield?: { display_name?: string | null } | null }

/** Palavras-chave (as mais relevantes) e tópicos do OpenAlex. */
export function assuntosOpenAlex(o: ObraOpenAlex): { palavrasChave: string[]; temas: string[] } {
  const palavrasChave = (o.keywords ?? [])
    .filter((k) => (k.score ?? 0) >= 0.3)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((k) => limparTexto(k.display_name))
    .filter((k): k is string => !!k)
    .slice(0, 8);
  const temas: string[] = [];
  const add = (t?: string | null) => {
    const l = limparTexto(t);
    if (l && !temas.some((x) => x.toLowerCase() === l.toLowerCase())) temas.push(l);
  };
  add(o.primary_topic?.subfield?.display_name);
  add(o.primary_topic?.display_name);
  for (const t of o.topics ?? []) if ((t.score ?? 0) >= 0.9) add(t.display_name);
  return { palavrasChave, temas: temas.slice(0, 4) };
}

export function converterOpenAlex(o: ObraOpenAlex): Importado {
  const fonte = o.primary_location?.source;
  let tipo = TIPO_OPENALEX[o.type ?? ''] ?? 'outro';
  if (tipo === 'artigo_periodico' && fonte?.type === 'conference') tipo = 'trabalho_evento';
  const d: Importado = {
    tipo,
    ...separarTitulo(limparTexto(o.title ?? o.display_name)),
    url: urlDoArtigo(o.primary_location?.landing_page_url),
    autores: (o.authorships ?? [])
      .map((a) => limparTexto(a.author?.display_name ?? a.raw_author_name))
      .filter((n): n is string => !!n)
      .map(separarNome),
    ano: o.publication_year ?? undefined,
    doi: o.doi ? o.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : undefined,
    veiculo: limparTexto(fonte?.display_name),
    volume: limparTexto(o.biblio?.volume),
    numero: limparTexto(o.biblio?.issue),
    paginas: paginasDe(o.biblio?.first_page, o.biblio?.last_page),
  };
  if (tipo === 'livro') {
    d.editora = limparTexto(fonte?.host_organization_name);
    delete d.veiculo;
  }
  return d;
}

// ---------------------------------------------------------------------
// Combinação e busca
// ---------------------------------------------------------------------
const vazio = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Usa o Crossref como base e completa só os campos vazios com o OpenAlex (do mesmo tipo de publicação). */
export function combinar(crossref: Importado | null, openalex: Importado | null): ResultadoImportacao {
  const dados: Importado = {};
  const origemDosCampos: ResultadoImportacao['origemDosCampos'] = {};
  const servicos: FonteDeDados[] = [];
  const aplicar = (fonte: Importado, nome: FonteDeDados) => {
    let usou = false;
    for (const [k, v] of Object.entries(fonte) as [keyof Importado, unknown][]) {
      if (vazio(v) || !vazio(dados[k])) continue;
      (dados as Record<string, unknown>)[k] = v;
      origemDosCampos[k as keyof ResultadoImportacao['origemDosCampos']] = nome;
      usou = true;
    }
    if (usou) servicos.push(nome);
  };
  if (crossref) aplicar(crossref, 'crossref');
  if (openalex && (!crossref || openalex.tipo === crossref.tipo)) aplicar(openalex, 'openalex');
  else if (openalex && crossref) {
    // Tipos diferentes: aproveita só dados neutros (não mistura periódico com livro, por exemplo).
    const neutros = Object.fromEntries(Object.entries(openalex).filter(([k]) => !['tipo', 'veiculo', 'editora'].includes(k))) as Importado;
    aplicar(neutros, 'openalex');
  }
  return { dados, origemDosCampos, servicos, palavrasChave: [], temas: [] };
}

async function obterJson(buscar: Buscar, url: string): Promise<unknown | null> {
  let r: Response;
  try {
    r = await buscar(url);
  } catch {
    throw new ErroDeImportacao('Sem conexão com o serviço de metadados. Verifique a internet.');
  }
  if (r.status === 404) return null;
  if (!r.ok) throw new ErroDeImportacao(`O serviço respondeu com erro (${r.status}).`);
  return r.json();
}

export async function buscarPorDoi(doiDigitado: string, buscar: Buscar = (u) => fetch(u, { headers: { Accept: 'application/json' } })): Promise<ResultadoImportacao> {
  const doi = normalizarDoi(doiDigitado);
  if (!/^10\.\d{4,9}\/\S+$/.test(doi)) throw new ErroDeImportacao('Isso não parece um DOI. Ele começa com "10." (ex.: 10.1590/abc.123).');
  const caminho = encodeURIComponent(doi).replace(/%2F/gi, '/');
  const [cr, oa] = await Promise.allSettled([
    obterJson(buscar, `https://api.crossref.org/works/${caminho}`),
    obterJson(buscar, `https://api.openalex.org/works/doi:${caminho}`),
  ]);
  const crossref = cr.status === 'fulfilled' && cr.value ? converterCrossref((cr.value as { message: MensagemCrossref }).message) : null;
  const openalex = oa.status === 'fulfilled' && oa.value ? converterOpenAlex(oa.value as ObraOpenAlex) : null;
  if (!crossref && !openalex) {
    const falhou = [cr, oa].find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined;
    if (falhou) throw falhou.reason instanceof ErroDeImportacao ? falhou.reason : new ErroDeImportacao('Não foi possível consultar os serviços de metadados.');
    throw new ErroDeImportacao('Nenhum dado encontrado para esse DOI no Crossref nem no OpenAlex. Confira o DOI ou preencha manualmente.');
  }
  const resultado = combinar(crossref, openalex);
  if (oa.status === 'fulfilled' && oa.value) {
    Object.assign(resultado, assuntosOpenAlex(oa.value as ObraOpenAlex));
    const resumo = resumoDoIndiceInvertido((oa.value as ObraOpenAlex).abstract_inverted_index);
    if (resumo) resultado.resumo = resumo;
    const aberto = (oa.value as ObraOpenAlex).open_access;
    if (aberto?.is_oa) resultado.acessoAberto = { url: aberto.oa_url ?? undefined };
  }
  resultado.dados.doi = resultado.dados.doi ?? doi;
  return resultado;
}

// ---------------------------------------------------------------------
// Busca pelo título (PDF sem DOI)
// ---------------------------------------------------------------------

export interface Candidato {
  doi: string;
  titulo: string;
  autores: string[];
  ano?: number;
  veiculo?: string;
  servico: 'crossref' | 'openalex';
}

const comparavel = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** Semelhança entre dois títulos (0 a 1), pelas palavras em comum. */
export function semelhancaDeTitulos(a: string, b: string): number {
  const pa = comparavel(a).split(' ').filter(Boolean);
  const pb = comparavel(b).split(' ').filter(Boolean);
  if (!pa.length || !pb.length) return 0;
  const conta = new Map<string, number>();
  for (const p of pb) conta.set(p, (conta.get(p) ?? 0) + 1);
  let comum = 0;
  for (const p of pa) {
    const n = conta.get(p) ?? 0;
    if (n > 0) { comum++; conta.set(p, n - 1); }
  }
  return (2 * comum) / (pa.length + pb.length);
}

/**
 * Procura no Crossref e no OpenAlex uma obra com o MESMO título (e, se soubermos, o mesmo primeiro
 * autor e ano). Só devolve quando a correspondência é forte; a pessoa ainda decide se usa.
 */
export async function procurarPorTitulo(
  titulo: string,
  sobrenomes: string[] = [],
  ano?: number,
  buscar: Buscar = (u) => fetch(u, { headers: { Accept: 'application/json' } }),
): Promise<Candidato | null> {
  if (comparavel(titulo).split(' ').length < 4) return null; // título curto demais para ter certeza
  const consulta = encodeURIComponent([titulo, sobrenomes[0]].filter(Boolean).join(' '));
  const [cr, oa] = await Promise.allSettled([
    obterJson(buscar, `https://api.crossref.org/works?query.bibliographic=${consulta}&rows=5&select=DOI,title,subtitle,author,issued,container-title`),
    obterJson(buscar, `https://api.openalex.org/works?search=${encodeURIComponent(titulo)}&per_page=5&select=doi,title,authorships,publication_year,primary_location`),
  ]);
  const candidatos: Candidato[] = [];
  if (cr.status === 'fulfilled' && cr.value) {
    const itens = (cr.value as { message?: { items?: (MensagemCrossref & { DOI?: string; 'container-title'?: string[] })[] } }).message?.items ?? [];
    for (const i of itens) {
      const t = [i.title?.[0], i.subtitle?.[0]].filter(Boolean).join(': ');
      if (!i.DOI || !t) continue;
      candidatos.push({
        doi: i.DOI, titulo: limparTexto(t) ?? t, servico: 'crossref',
        autores: (i.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name || '').filter(Boolean),
        ano: (i as { issued?: { 'date-parts'?: number[][] } }).issued?.['date-parts']?.[0]?.[0] ?? undefined,
        veiculo: i['container-title']?.[0],
      });
    }
  }
  if (oa.status === 'fulfilled' && oa.value) {
    const itens = (oa.value as { results?: { doi?: string | null; title?: string | null; publication_year?: number | null; authorships?: { author?: { display_name?: string } }[]; primary_location?: { source?: { display_name?: string } | null } | null }[] }).results ?? [];
    for (const i of itens) {
      if (!i.doi || !i.title) continue;
      candidatos.push({
        doi: normalizarDoi(i.doi), titulo: limparTexto(i.title) ?? i.title, servico: 'openalex',
        autores: (i.authorships ?? []).map((a) => a.author?.display_name ?? '').filter(Boolean),
        ano: i.publication_year ?? undefined, veiculo: i.primary_location?.source?.display_name ?? undefined,
      });
    }
  }
  const sobrenome = sobrenomes[0] ? comparavel(sobrenomes[0]).split(' ').pop()! : null;
  const bons = candidatos
    .map((c) => ({ c, s: Math.max(semelhancaDeTitulos(titulo, c.titulo), semelhancaDeTitulos(titulo, c.titulo.split(':')[0])) }))
    .filter(({ c, s }) => {
      if (s < 0.9) return false;
      if (sobrenome && c.autores.length && !c.autores.some((a) => comparavel(a).split(' ').includes(sobrenome))) return false;
      if (ano && c.ano && Math.abs(c.ano - ano) > 1) return false;
      return true;
    })
    .sort((x, y) => y.s - x.s);
  return bons[0]?.c ?? null;
}
