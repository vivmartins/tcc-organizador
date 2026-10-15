// Lê as referências escritas no TCC: quem é o autor de entrada e qual o ano.
// Não confere a formatação (isso é feito na página de cada fonte); só o necessário para cruzar com as citações.

import { normalizar } from './texto.ts';

export interface ReferenciaLida {
  indice: number;
  texto: string;
  /** Sobrenomes (ou entidade, ou início do título), normalizados, na ordem em que aparecem. */
  autores: string[];
  /** Todos os anos encontrados na referência (ex.: "2020", "2020a", "sd"). */
  anos: string[];
  /** Ano principal (o último que aparece, que costuma ser o da publicação). */
  ano?: string;
}

const ANO = /\[?\b(s\.\s?d\.)|\b(1[5-9]\d{2}|20\d{2})([a-z])?(?![\d])/gi;

/** "2020a" → "2020a"; "s.d." ou "[s. d.]" → "sd". */
export function normalizarAno(s: string): string {
  const t = s.toLowerCase().replace(/[[\]?\s]/g, '');
  if (t === 's.d.' || t === 'sd' || t === 's.d') return 'sd';
  const m = t.match(/(\d{4})([a-z])?/);
  return m ? m[1] + (m[2] ?? '') : t;
}

/** Ano sem a letra (2020a → 2020). */
export const anoBase = (a: string) => a.replace(/[a-z]$/, '');

export function lerReferencia(texto: string, indice = 0): ReferenciaLida {
  const autores: string[] = [];
  for (const parte of texto.split(';')) {
    const m = parte.match(/^\s*(\p{Lu}[\p{Lu}'’\- ]*\p{Lu})\s*,/u);
    if (!m) break;
    autores.push(normalizar(m[1]));
  }
  if (!autores.length) {
    // Entidade (BRASIL. Ministério...) ou título como entrada (A HUMANIZAÇÃO do cuidado...)
    const m = texto.match(/^\s*((?:\p{Lu}{1,3}\s+)?\p{Lu}[\p{Lu}'’\- ]*\p{Lu})(?=[.\s,:]|$)/u);
    if (m) autores.push(normalizar(m[1]));
  }
  // Datas de acesso, endereços e DOIs têm números que não são o ano da obra
  const limpo = texto
    .replace(/acesso em:?.{0,25}?\d{4}/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bdoi:?\s*\S+/gi, ' ')
    .replace(/\b10\.\d{4,9}\/\S+/g, ' ');
  const anos = [...limpo.matchAll(ANO)].map((m) => normalizarAno(m[0]));
  return { indice, texto, autores, anos: [...new Set(anos)], ano: anos.at(-1) };
}

export const lerReferencias = (lista: string[]) => lista.map((t, i) => lerReferencia(t, i));
