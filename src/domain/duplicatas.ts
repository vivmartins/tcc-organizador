// Detecção de possíveis publicações duplicadas e extração de DOI.
// Só AVISA: a decisão de manter ou não é sempre da estudante.

import type { Autor } from './tipos.ts';
import { normalizarDoi } from './abnt/referencia.ts';

export interface FonteComparavel {
  id: string;
  titulo: string;
  ano?: number;
  doi?: string;
  url?: string;
  autores?: Autor[];
}

export type MotivoDuplicata = 'doi' | 'url' | 'metadados';

export interface PossivelDuplicata {
  id: string;
  motivo: MotivoDuplicata;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

export function normalizarTitulo(t: string): string {
  return semAcento(t.toLowerCase())
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const PARAMETROS_DE_RASTREIO = /^(utm_|fbclid$|gclid$|mc_|_ga$|ref$|source$)/i;

export function normalizarUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const params = [...u.searchParams.entries()]
    .filter(([k]) => !PARAMETROS_DE_RASTREIO.test(k))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const caminho = u.pathname.replace(/\/+$/, '');
  return `${host}${caminho}${query}`;
}

/** Procura um DOI dentro de um texto qualquer (URL, conteúdo de PDF...). */
export function extrairDoi(texto: string): string | null {
  let t = texto;
  try {
    t = decodeURIComponent(texto); // DOIs em URLs podem vir codificados (%2F)
  } catch {
    /* texto com % solto: usa como está */
  }
  const m = /\b(10\.\d{4,9}\/[^\s"'<>]+)/i.exec(t);
  if (!m) return null;
  return m[1]
    .replace(/[.,;:)\]}]+$/, '') // pontuação final que não faz parte do DOI
    .replace(/\/(full|pdf|abstract|epdf|html)$/i, '') // sufixos comuns de editoras
    .toLowerCase();
}

function primeiroSobrenome(autores?: Autor[]): string | null {
  const a = autores?.find((x) => x.sobrenome.trim());
  return a ? normalizarTitulo(a.sobrenome).split(' ')[0] : null;
}

export function encontrarDuplicatas(
  nova: Omit<FonteComparavel, 'id'> & { id?: string },
  existentes: FonteComparavel[],
): PossivelDuplicata[] {
  const resultado: PossivelDuplicata[] = [];
  const doi = nova.doi?.trim() ? normalizarDoi(nova.doi) : null;
  const url = nova.url?.trim() ? normalizarUrl(nova.url) : null;
  const titulo = normalizarTitulo(nova.titulo);
  const autor = primeiroSobrenome(nova.autores);

  for (const e of existentes) {
    if (nova.id && e.id === nova.id) continue;
    if (doi && e.doi?.trim() && normalizarDoi(e.doi) === doi) {
      resultado.push({ id: e.id, motivo: 'doi' });
      continue;
    }
    if (url && e.url?.trim() && normalizarUrl(e.url) === url) {
      resultado.push({ id: e.id, motivo: 'url' });
      continue;
    }
    if (titulo.length >= 10 && normalizarTitulo(e.titulo) === titulo) {
      const anoBate = !nova.ano || !e.ano || nova.ano === e.ano;
      const outroAutor = primeiroSobrenome(e.autores);
      const autorBate = !autor || !outroAutor || autor === outroAutor;
      if (anoBate && autorBate) resultado.push({ id: e.id, motivo: 'metadados' });
    }
  }
  return resultado;
}
