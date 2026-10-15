// Encontra as citações no texto do TCC (sistema autor-data da NBR 10520):
//   entre parênteses: (Silva, 2020), (SILVA; SOUZA, 2020, p. 15), (Silva, 2010 apud Lima, 2020)
//   no texto (narrativa): Silva (2020), Silva e Souza (2020, p. 3), Silva et al. (2020)
// e as citações diretas (trechos entre aspas ou em parágrafo recuado, ligados a uma citação).

import type { ParagrafoCorpo } from './documento.ts';
import { normalizar } from './texto.ts';
import { normalizarAno } from './referencias.ts';

export interface AutorCitado {
  /** como está escrito no TCC */
  escrito: string;
  /** chaves possíveis, da mais longa para a mais curta (em "Segundo Freire (1996)": "segundo freire", "freire") */
  candidatos: string[];
  /** título usado como entrada, abreviado com reticências: "(A humanização..., 2020)" */
  prefixo?: boolean;
}

export interface ObraCitada {
  autores: AutorCitado[];
  etAl: boolean;
  ano: string;
  pagina?: string;
  /** obra citada por meio de outra (a que vem antes de "apud"); não precisa estar nas referências */
  apudOriginal?: boolean;
}

export interface Citacao {
  id: number;
  tipo: 'parentetica' | 'narrativa';
  /** trecho do TCC, como está escrito */
  texto: string;
  /** posição do parágrafo dentro do corpo, e posição dentro do parágrafo */
  paragrafo: number;
  inicio: number;
  fim: number;
  obras: ObraCitada[];
  /** Nome em MAIÚSCULAS dentro dos parênteses (padrão antigo) ou em minúsculas (NBR 10520:2023). */
  estilo?: 'maiusculas' | 'minusculas';
}

export interface Aspas {
  inicio: number;
  fim: number;
  /** texto sem as aspas */
  texto: string;
}

export interface CitacaoDireta {
  paragrafo: number;
  inicio: number;
  fim: number;
  trecho: string;
  /** citação longa, em parágrafo recuado */
  recuada: boolean;
  citacao?: Citacao;
  /** página informada (na citação ou num "(p. 12)" logo após o trecho) */
  pagina?: string;
}

const ANO_TOKEN = /\[?(?:\b(?:1[5-9]\d{2}|20\d{2})[a-z]?(?!\d)\??|\bs\.\s?d\.)\]?/i;
const PARTICULAS = new Set(['de', 'da', 'do', 'dos', 'das', 'del', 'van', 'von', "d'", 'di', 'du', 'la', 'le']);

function limparNome(s: string): string {
  return s.replace(/^[\s,;:(]+|[\s,;:]+$/g, '').replace(/\s+/g, ' ');
}

function pareceNome(s: string): boolean {
  if (!s || /\d/.test(s)) return false;
  const palavras = s.split(' ');
  if (palavras.length > 7) return false;
  return /^[\p{Lu}]/u.test(s) || /^(d'|de |da |do |van |von )/i.test(s);
}

function autorDosParenteses(escrito: string): AutorCitado {
  const prefixo = /(\.\.\.|…|\[\.\.\.\])$/.test(escrito);
  const limpo = escrito.replace(/(\.\.\.|…|\[\.\.\.\])$/, '').trim();
  return { escrito: limpo, candidatos: [normalizar(limpo)], prefixo: prefixo || undefined };
}

const ehMaiusculo = (s: string) => /\p{Lu}{4,}/u.test(s) && s === s.toUpperCase();

/** Lê uma parte "Nome, 2020, 2021, p. 15" (o nome pode faltar). */
function lerParte(parte: string): { nomes: string; anos: string[]; pagina?: string } | null {
  const m = parte.match(ANO_TOKEN);
  if (!m || m.index === undefined) return null;
  const nomes = limparNome(parte.slice(0, m.index)).replace(/^(?:cf\.|ver também|ver|vide|conforme|segundo)\s+/i, '');
  let resto = parte.slice(m.index);
  const anos: string[] = [];
  for (;;) {
    const a = resto.match(/^\s*(?:,|\be\b)?\s*(\[?(?:(?:1[5-9]\d{2}|20\d{2})[a-z]?(?!\d)\??|s\.\s?d\.)\]?)/i);
    if (!a) break;
    anos.push(normalizarAno(a[1]));
    resto = resto.slice(a[0].length);
  }
  const p = resto.match(/\b(?:p|pp|f)\.\s*([\divxlc]+(?:\s*[-–]\s*[\divxlc]+)?)/i);
  return { nomes, anos, pagina: p ? p[1].replace(/\s+/g, '') : undefined };
}

/** Separa "Silva e Souza" ou "Silva, Souza e Lima" em nomes. */
function separarNomes(s: string): string[] {
  return s
    .split(/\s*(?:;|,|\s&\s|\se\s)\s*/)
    .map(limparNome)
    .filter(Boolean);
}

function lerConteudoParenteses(conteudo: string): { obras: ObraCitada[]; semNome: boolean; estilo?: Citacao['estilo'] } | null {
  const grupos = conteudo.split(/\s+apud\s+/i);
  const obras: ObraCitada[] = [];
  let semNome = false;
  let estilo: Citacao['estilo'];
  grupos.forEach((grupo, gi) => {
    let pendentes: string[] = [];
    let ultimos: AutorCitado[] = [];
    let ultimoEtAl = false;
    for (const token of grupo.split(';')) {
      const parte = lerParte(token);
      if (!parte || parte.anos.length === 0) {
        const n = limparNome(token).replace(/^(?:cf\.|ver também|ver|vide|conforme|segundo)\s+/i, '');
        if (n) pendentes.push(n);
        continue;
      }
      let nomes = parte.nomes;
      let etAl = false;
      if (/\bet\s+al\.?$/i.test(nomes)) {
        etAl = true;
        nomes = nomes.replace(/\s*\bet\s+al\.?$/i, '').trim();
      }
      const todos = [...pendentes, ...(nomes ? separarNomes(nomes) : [])];
      pendentes = [];
      let autores: AutorCitado[];
      if (todos.length === 0) {
        if (obras.length === 0 && gi === 0) semNome = true;
        autores = ultimos; // "(Silva, 2010; 2015)" ou narrativa "Silva (2020)"
        etAl = etAl || ultimoEtAl;
      } else {
        if (!todos.every(pareceNome)) continue;
        autores = todos.map(autorDosParenteses);
        if (todos.some(ehMaiusculo)) estilo = 'maiusculas';
        else if (todos.some((n) => /\p{Ll}/u.test(n))) estilo ??= 'minusculas';
      }
      ultimos = autores;
      ultimoEtAl = etAl;
      for (const ano of parte.anos) {
        obras.push({ autores, etAl, ano, pagina: parte.pagina, apudOriginal: gi < grupos.length - 1 || undefined });
      }
    }
  });
  if (!obras.length) return null;
  return { obras, semNome, estilo };
}

/** Lê o nome que vem antes de "(2020)": "Segundo Freire", "Silva e Souza", "Silva et al.". */
function nomesAntes(texto: string): { autores: AutorCitado[]; etAl: boolean; inicio: number } | null {
  let antes = texto.replace(/\s+$/, '');
  let etAl = false;
  const ea = antes.match(/\s+et\s+al\.?$/i);
  if (ea) {
    etAl = true;
    antes = antes.slice(0, antes.length - ea[0].length);
  }
  const tokens = [...antes.matchAll(/\S+/g)];
  const pegos: { t: string; i: number }[] = [];
  for (let k = tokens.length - 1; k >= 0 && pegos.length < 8; k--) {
    const bruto = tokens[k][0];
    const t = bruto.replace(/,$/, '');
    // pontuação de fim de frase antes do nome encerra a busca
    if (pegos.length && /[.!?:;)]$/.test(bruto) && !/^\p{Lu}\.$/u.test(bruto)) break;
    if (/^[\p{Lu}][\p{L}'’\-]*$/u.test(t) || (pegos.length > 0 && (PARTICULAS.has(t.toLowerCase()) || t === 'e' || t === '&'))) {
      pegos.unshift({ t: bruto, i: tokens[k].index! });
    } else break;
  }
  // não pode começar com partícula ou "e"
  while (pegos.length && (PARTICULAS.has(pegos[0].t.toLowerCase()) || pegos[0].t === 'e' || pegos[0].t === '&')) pegos.shift();
  if (!pegos.length) return null;
  const frase = pegos.map((p) => p.t).join(' ');
  const nomes = frase.split(/\s*(?:,\s*|\s&\s|\se\s)\s*/).map(limparNome).filter(Boolean);
  const autores = nomes.map((n) => {
    const ps = n.split(' ');
    const candidatos: string[] = [];
    for (let k = 0; k < ps.length; k++) {
      if (PARTICULAS.has(ps[k].toLowerCase())) continue;
      candidatos.push(normalizar(ps.slice(k).join(' ')));
    }
    const ultimo = ps.at(-1)!;
    return { escrito: n, candidatos: candidatos.length ? candidatos : [normalizar(ultimo)] };
  });
  return { autores, etAl, inicio: pegos[0].i };
}

/** Todas as citações autor-data dos parágrafos do corpo. */
export function encontrarCitacoes(corpo: ParagrafoCorpo[]): Citacao[] {
  const r: Citacao[] = [];
  corpo.forEach((par, pi) => {
    const t = par.texto;
    for (const m of t.matchAll(/\(([^()]{2,300})\)/g)) {
      const conteudo = m[1];
      if (!ANO_TOKEN.test(conteudo)) continue;
      const lido = lerConteudoParenteses(conteudo);
      if (!lido) continue;
      const inicio = m.index!;
      const fim = inicio + m[0].length;
      if (!lido.semNome) {
        r.push({ id: r.length, tipo: 'parentetica', texto: m[0], paragrafo: pi, inicio, fim, obras: lido.obras, estilo: lido.estilo });
        continue;
      }
      // Narrativa: o nome está antes dos parênteses
      const janela = Math.max(0, inicio - 160);
      const antes = nomesAntes(t.slice(janela, inicio));
      if (!antes) continue;
      const obras = lido.obras.map((o, k) =>
        k === 0 || o.autores.length === 0 ? { ...o, autores: antes.autores, etAl: antes.etAl || o.etAl } : o,
      );
      // obras sem nome depois da primeira (ex.: "Silva (2010, 2015)") herdam o nome
      for (const o of obras) if (o.autores.length === 0) { o.autores = antes.autores; o.etAl = antes.etAl; }
      r.push({ id: r.length, tipo: 'narrativa', texto: t.slice(janela + antes.inicio, fim), paragrafo: pi, inicio: janela + antes.inicio, fim, obras });
    }
  });
  return r;
}

/** Trechos entre aspas (“...”, "..." ou «...») de um parágrafo. */
export function encontrarAspas(texto: string): Aspas[] {
  const r: Aspas[] = [];
  for (const m of texto.matchAll(/“([^”]{2,})”|"([^"]{2,})"|«([^»]{2,})»/g)) {
    r.push({ inicio: m.index!, fim: m.index! + m[0].length, texto: (m[1] ?? m[2] ?? m[3]).trim() });
  }
  return r;
}

const contarPalavras = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;
const RECUO_CITACAO_LONGA = 3; // cm (a norma pede 4 cm; aceitamos a partir de 3)

/**
 * Citações diretas: trechos entre aspas com 4 ou mais palavras e parágrafos recuados,
 * ligados à citação que vem logo depois (entre parênteses) ou antes, na mesma frase (narrativa).
 */
export function encontrarCitacoesDiretas(corpo: ParagrafoCorpo[], citacoes: Citacao[]): CitacaoDireta[] {
  const r: CitacaoDireta[] = [];
  const doParagrafo = (pi: number) => citacoes.filter((c) => c.paragrafo === pi);
  corpo.forEach((par, pi) => {
    const t = par.texto;
    const cits = doParagrafo(pi);
    if ((par.recuoCm ?? 0) >= RECUO_CITACAO_LONGA && contarPalavras(t) >= 8) {
      // Citação longa: a citação costuma estar no fim do próprio parágrafo, ou antes, no parágrafo anterior terminado em ":"
      const noFim = cits.filter((c) => c.tipo === 'parentetica' && t.slice(c.fim).replace(/[\s.]/g, '') === '').at(-1);
      let citacao = noFim;
      if (!citacao && pi > 0 && /:\s*$/.test(corpo[pi - 1].texto)) citacao = doParagrafo(pi - 1).at(-1);
      const fimTrecho = noFim ? noFim.inicio : t.length;
      r.push({
        paragrafo: pi, inicio: 0, fim: fimTrecho, trecho: t.slice(0, fimTrecho).replace(/[\s.]+$/, '').replace(/^["“]|["”]$/g, '').trim(),
        recuada: true, citacao, pagina: citacao?.obras[0]?.pagina,
      });
      return;
    }
    for (const a of encontrarAspas(t)) {
      if (contarPalavras(a.texto) < 4) continue; // termos curtos entre aspas não são citação
      const depois = t.slice(a.fim, a.fim + 20);
      let citacao = cits.find((c) => c.tipo === 'parentetica' && c.inicio >= a.fim && /^[\s.,;:]*$/.test(t.slice(a.fim, c.inicio)) && c.inicio - a.fim <= 12);
      let pagina = citacao?.obras[0]?.pagina;
      if (!citacao) {
        // narrativa antes do trecho, na mesma frase
        citacao = cits
          .filter((c) => c.fim <= a.inicio && a.inicio - c.fim <= 250 && !/[.!?]\s+\p{Lu}/u.test(t.slice(c.fim, a.inicio)))
          .at(-1);
        pagina = citacao?.obras[0]?.pagina;
        const p = depois.match(/^\s*\(\s*(?:p|f)\.\s*([\divxlc]+(?:\s*[-–]\s*[\divxlc]+)?)\s*\)/i);
        if (p) pagina = p[1].replace(/\s+/g, '');
      }
      r.push({ paragrafo: pi, inicio: a.inicio, fim: a.fim, trecho: a.texto, recuada: false, citacao, pagina });
    }
  });
  return r;
}
