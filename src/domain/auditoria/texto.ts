// Utilidades de texto usadas pela auditoria: normalizar, separar em palavras e localizar trechos.

/** Minúsculas, sem acentos, só letras e números separados por um espaço. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface Palavra {
  /** forma normalizada (minúsculas, sem acento) */
  p: string;
  /** posição no texto original */
  inicio: number;
  fim: number;
}

/** Separa o texto em palavras, guardando onde cada uma está no texto original. */
export function palavras(texto: string): Palavra[] {
  const r: Palavra[] = [];
  for (const m of texto.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)) {
    const n = normalizar(m[0]).replace(/ /g, '');
    if (n) r.push({ p: n, inicio: m.index!, fim: m.index! + m[0].length });
  }
  return r;
}

/** Palavras muito comuns, que sozinhas não indicam semelhança entre textos. */
export const PALAVRAS_VAZIAS = new Set(
  (
    'a o as os um uma uns umas de da do das dos em na no nas nos por pela pelo pelas pelos para pra com sem sob sobre entre ' +
    'e ou mas que se como mais menos muito muita muitos muitas ja nao sim tambem ao aos a as isso isto esse essa esses essas ' +
    'este esta estes estas aquele aquela seu sua seus suas ser sao foi foram era eram ha tem tinha estar esta estao ' +
    'quando onde qual quais cujo cuja ate apos desde pois porque assim entao the of and in to is for on with by an'
  ).split(' '),
);

/** Trecho curto ao redor de uma posição, para mostrar onde algo aparece. */
export function contexto(texto: string, inicio: number, fim: number, margem = 60): string {
  const a = Math.max(0, inicio - margem);
  const b = Math.min(texto.length, fim + margem);
  return `${a > 0 ? '…' : ''}${texto.slice(a, b).replace(/\s+/g, ' ').trim()}${b < texto.length ? '…' : ''}`;
}
