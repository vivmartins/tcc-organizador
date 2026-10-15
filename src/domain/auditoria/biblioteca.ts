// O que a auditoria precisa saber de cada fonte da biblioteca: quem é (para ligar às citações),
// o texto guardado (PDF ou resumo) e os trechos originais dos fichamentos.

import type { Citavel } from './cruzamento.ts';
import { normalizar } from './texto.ts';

export interface FichaAuditoria {
  id: string;
  trecho: string;
  pagina?: string;
}

export interface FonteAuditoria extends Citavel {
  id: string;
  /** "Silva, 2020" ou o título, para mostrar */
  rotulo: string;
  titulo: string;
  texto?: { texto: string; origem: 'pdf' | 'resumo' };
  fichas: FichaAuditoria[];
}

export interface FonteParaAuditoria {
  id: string;
  titulo: string;
  ano?: number;
  autores: { sobrenome: string }[];
}

/** Monta a fonte da auditoria a partir da fonte cadastrada, do texto e das fichas dela. */
export function prepararFonte(
  f: FonteParaAuditoria,
  texto: FonteAuditoria['texto'] | undefined,
  fichas: { id: string; trechoOriginal?: string; pagina?: string }[],
): FonteAuditoria {
  const autores = f.autores.map((a) => normalizar(a.sobrenome)).filter(Boolean);
  const porTitulo = autores.length === 0;
  const primeiro = f.autores[0]?.sobrenome;
  const ano = f.ano ? String(f.ano) : 'sd';
  return {
    id: f.id,
    titulo: f.titulo,
    rotulo: primeiro ? `${primeiro}${f.autores.length > 2 ? ' et al.' : f.autores.length === 2 ? `; ${f.autores[1].sobrenome}` : ''}, ${f.ano ?? '[s. d.]'}` : f.titulo,
    autores: porTitulo ? [normalizar(f.titulo)] : autores,
    anos: [ano],
    porTitulo,
    texto,
    fichas: fichas
      .filter((x) => (x.trechoOriginal ?? '').trim())
      .map((x) => ({ id: x.id, trecho: x.trechoOriginal!.trim(), pagina: x.pagina })),
  };
}
