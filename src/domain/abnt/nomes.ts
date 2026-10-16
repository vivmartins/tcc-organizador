// Entrada do autor pelo último sobrenome, sem a partícula (de, da, do, das, dos).
// Bases como o Crossref às vezes trazem o sobrenome como "De Avila" ou "Da Silva"; pela NBR 6023
// a entrada é "AVILA, Maria Luiza da Rosa de" e "SILVA, Charlene da", e a citação, (Avila, 2023).
// Só ajusta a forma de exibir: o dado guardado na fonte não muda.

import type { Autor } from '../tipos.ts';

const PARTICULA = /^(d[aeo]s?|d['’])\s*(?=\S)/i;

export function entradaDoAutor(a: Autor): Autor {
  if (a.tipo !== 'pessoa') return a;
  const s = (a.sobrenome ?? '').replace(/\s+/g, ' ').trim();
  const m = PARTICULA.exec(s);
  if (!m) return a;
  const resto = s.slice(m[0].length).trim();
  if (!resto) return a;
  const particula = m[1].toLowerCase();
  const prenomes = [(a.prenomes ?? '').trim(), particula].filter(Boolean).join(' ');
  return { ...a, sobrenome: resto, prenomes };
}
