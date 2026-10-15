// Checagem de cópia: compara o texto do TCC com os textos guardados das fontes e com os
// trechos originais dos fichamentos. Mostra "pontos para conferir", nunca um veredito.
//
// 1. Trechos iguais: sequências de 12 ou mais palavras idênticas a uma fonte.
//    - entre aspas e citando a fonte certa → correto (só contado);
//    - entre aspas, mas citando outra obra → "fonte diferente";
//    - fora de aspas → "igual à fonte, sem aspas".
// 2. Paráfrase muito próxima: frases em que metade ou mais das sequências de 3 palavras
//    aparecem numa mesma fonte.

import type { ParagrafoCorpo } from './documento.ts';
import type { Citacao, CitacaoDireta } from './citacoes.ts';
import type { FonteAuditoria } from './biblioteca.ts';
import { procurarObra } from './cruzamento.ts';
import { palavras, PALAVRAS_VAZIAS, type Palavra } from './texto.ts';

export const TAMANHO_SEMENTE = 8;
export const MINIMO_PALAVRAS_IGUAIS = 12;
export const MINIMO_PARAFRASE = 0.5;
const MINIMO_PALAVRAS_FRASE = 10;

export interface TrechoParecido {
  tipo: 'sem_aspas' | 'fonte_diferente' | 'aspas_sem_citacao' | 'parafrase';
  paragrafo: number;
  inicio: number;
  fim: number;
  textoTcc: string;
  fonte: FonteAuditoria;
  onde: 'ficha' | 'texto';
  textoFonte: string;
  palavras: number;
  /** para paráfrases: proporção das sequências de 3 palavras em comum */
  semelhanca?: number;
  /** o parágrafo do TCC cita esta fonte */
  citaFonte: boolean;
  /** para "fonte diferente": a obra que foi citada */
  citada?: string;
}

export interface ResultadoCopia {
  trechos: TrechoParecido[];
  /** trechos iguais a uma fonte, entre aspas e com a citação certa */
  citadosCorretamente: number;
  fontesComparadas: number;
}

interface Doc {
  fonte: FonteAuditoria;
  onde: 'ficha' | 'texto';
  texto: string;
  w: Palavra[];
}

function montarDocs(fontes: FonteAuditoria[]): Doc[] {
  const docs: Doc[] = [];
  for (const f of fontes) {
    if (f.texto) docs.push({ fonte: f, onde: 'texto', texto: f.texto.texto, w: palavras(f.texto.texto) });
    for (const x of f.fichas) docs.push({ fonte: f, onde: 'ficha', texto: x.trecho, w: palavras(x.trecho) });
  }
  return docs;
}

const fatia = (ws: Palavra[], a: number, n: number) => ws.slice(a, a + n).map((w) => w.p).join(' ');

/** Fontes ligadas às citações de um parágrafo. */
function fontesCitadas(cits: Citacao[], fontes: FonteAuditoria[]): Set<FonteAuditoria> {
  const s = new Set<FonteAuditoria>();
  for (const c of cits) for (const o of c.obras) for (const f of procurarObra(o, fontes).iguais) s.add(f);
  return s;
}

export function checarCopia(corpo: ParagrafoCorpo[], citacoes: Citacao[], diretas: CitacaoDireta[], fontes: FonteAuditoria[]): ResultadoCopia {
  const docs = montarDocs(fontes);
  const comMaterial = new Set(docs.map((d) => d.fonte)).size;
  const trechos: TrechoParecido[] = [];
  let citadosCorretamente = 0;
  if (!docs.length) return { trechos, citadosCorretamente, fontesComparadas: 0 };

  // Índice das sementes (8 palavras seguidas) e das sequências de 3 palavras
  const sementes = new Map<string, [number, number][]>();
  const trigramas = new Map<string, number[]>();
  docs.forEach((d, di) => {
    for (let p = 0; p + TAMANHO_SEMENTE <= d.w.length; p++) {
      const k = fatia(d.w, p, TAMANHO_SEMENTE);
      const l = sementes.get(k);
      if (!l) sementes.set(k, [[di, p]]);
      else if (l.length < 30) l.push([di, p]);
    }
    for (let p = 0; p + 3 <= d.w.length; p++) {
      if (PALAVRAS_VAZIAS.has(d.w[p].p) && PALAVRAS_VAZIAS.has(d.w[p + 1].p) && PALAVRAS_VAZIAS.has(d.w[p + 2].p)) continue;
      const k = fatia(d.w, p, 3);
      const l = trigramas.get(k);
      if (!l) trigramas.set(k, [di]);
      else if (l.at(-1) !== di) l.push(di);
    }
  });

  corpo.forEach((par, pi) => {
    const t = par.texto;
    const w = palavras(t);
    const citsPar = citacoes.filter((c) => c.paragrafo === pi);
    const citadasNoPar = fontesCitadas(citsPar, fontes);
    const diretasPar = diretas.filter((d) => d.paragrafo === pi);
    const dentroDeCitacao = (ini: number, fim: number) =>
      diretasPar.find((d) => {
        const sobre = Math.min(fim, d.fim) - Math.max(ini, d.inicio);
        return sobre > 0 && sobre >= 0.8 * (fim - ini);
      });

    // 1. sequências idênticas
    type Corrida = { i: number; n: number; di: number; p: number };
    const corridas: Corrida[] = [];
    for (let i = 0; i + TAMANHO_SEMENTE <= w.length; ) {
      const hits = sementes.get(fatia(w, i, TAMANHO_SEMENTE));
      let melhor: Corrida | null = null;
      for (const [di, p] of hits ?? []) {
        const dw = docs[di].w;
        let n = TAMANHO_SEMENTE;
        while (i + n < w.length && p + n < dw.length && w[i + n].p === dw[p + n].p) n++;
        // prefere o texto completo da fonte às fichas quando o tamanho é igual
        if (!melhor || n > melhor.n || (n === melhor.n && docs[di].onde === 'texto' && docs[melhor.di].onde === 'ficha')) melhor = { i, n, di, p };
      }
      if (melhor) { corridas.push(melhor); i += melhor.n; } else i++;
    }
    // junta corridas próximas da mesma fonte (pequenas trocas de palavra no meio)
    const segs: Corrida[][] = [];
    for (const c of corridas) {
      const ult = segs.at(-1)?.at(-1);
      if (ult && docs[ult.di].fonte === docs[c.di].fonte && c.i - (ult.i + ult.n) <= 4) segs.at(-1)!.push(c);
      else segs.push([c]);
    }
    const marcados: [number, number][] = [];
    for (const s of segs) {
      const a = s[0];
      const z = s.at(-1)!;
      const n = z.i + z.n - a.i;
      if (n < MINIMO_PALAVRAS_IGUAIS) continue;
      const ini = w[a.i].inicio;
      const fim = w[z.i + z.n - 1].fim;
      marcados.push([ini, fim]);
      const doc = docs[a.di];
      const docZ = docs[z.di];
      const textoFonte = doc === docZ ? doc.texto.slice(doc.w[a.p].inicio, doc.w[z.p + z.n - 1].fim) : doc.texto.slice(doc.w[a.p].inicio, doc.w[a.p + a.n - 1].fim);
      const base = { paragrafo: pi, inicio: ini, fim, textoTcc: t.slice(ini, fim), fonte: doc.fonte, onde: doc.onde, textoFonte: textoFonte.replace(/\s+/g, ' '), palavras: n };
      const cit = dentroDeCitacao(ini, fim);
      if (cit) {
        if (!cit.citacao) {
          // entre aspas, mas sem citação: mostramos de qual fonte o trecho é
          trechos.push({ ...base, tipo: 'aspas_sem_citacao', citaFonte: citadasNoPar.has(doc.fonte) });
          continue;
        }
        const ligadas = fontesCitadas([cit.citacao], fontes);
        if (ligadas.has(doc.fonte) || ligadas.size === 0) citadosCorretamente++;
        else trechos.push({ ...base, tipo: 'fonte_diferente', citaFonte: false, citada: [...ligadas].map((f) => f.rotulo).join('; ') });
        continue;
      }
      trechos.push({ ...base, tipo: 'sem_aspas', citaFonte: citadasNoPar.has(doc.fonte) });
    }

    // 2. paráfrase muito próxima, frase a frase
    for (const m of t.matchAll(/[^.!?]+(?:[.!?]+|$)/g)) {
      const ini = m.index!;
      const fim = ini + m[0].length;
      if (marcados.some(([a, b]) => Math.min(b, fim) - Math.max(a, ini) > 0.3 * (fim - ini))) continue;
      if (dentroDeCitacao(ini, fim)) continue;
      // só as palavras da própria autora: fora de aspas, de citações recuadas e das citações (Silva, 2020)
      const fw = w.filter(
        (x) => x.inicio >= ini && x.fim <= fim &&
          !diretasPar.some((d) => x.inicio >= d.inicio && x.fim <= d.fim) &&
          !citsPar.some((c) => x.inicio >= c.inicio && x.fim <= c.fim),
      );
      if (fw.length < MINIMO_PALAVRAS_FRASE) continue;
      const contagem = new Map<FonteAuditoria, { n: number; di: number }>();
      let total = 0;
      for (let k = 0; k + 3 <= fw.length; k++) {
        if (PALAVRAS_VAZIAS.has(fw[k].p) && PALAVRAS_VAZIAS.has(fw[k + 1].p) && PALAVRAS_VAZIAS.has(fw[k + 2].p)) continue;
        total++;
        const vistos = new Set<FonteAuditoria>();
        for (const di of trigramas.get(fatia(fw, k, 3)) ?? []) {
          const f = docs[di].fonte;
          if (vistos.has(f)) continue;
          vistos.add(f);
          const c = contagem.get(f) ?? { n: 0, di };
          c.n++;
          contagem.set(f, c);
        }
      }
      let melhor: { f: FonteAuditoria; n: number; di: number } | null = null;
      for (const [f, c] of contagem) if (!melhor || c.n > melhor.n) melhor = { f, ...c };
      if (!melhor || total < 4 || melhor.n / total < MINIMO_PARAFRASE) continue;
      const doc = docs[melhor.di];
      const ws = fw.map((x) => x.p);
      // trecho da fonte: região com mais sequências em comum
      const tri = new Set<string>();
      for (let k = 0; k + 3 <= ws.length; k++) tri.add(ws.slice(k, k + 3).join(' '));
      let a = -1;
      let z = -1;
      for (let p = 0; p + 3 <= doc.w.length; p++) {
        if (tri.has(fatia(doc.w, p, 3))) {
          if (a < 0 || p - z > 40) { if (a >= 0 && z - a > 3) break; a = p; }
          z = p + 2;
        }
      }
      trechos.push({
        tipo: 'parafrase', paragrafo: pi, inicio: fw[0].inicio, fim: fw.at(-1)!.fim, textoTcc: t.slice(fw[0].inicio, fw.at(-1)!.fim),
        fonte: melhor.f, onde: doc.onde, palavras: fw.length, semelhanca: melhor.n / total,
        textoFonte: a >= 0 ? doc.texto.slice(doc.w[a].inicio, doc.w[z].fim).replace(/\s+/g, ' ') : '',
        citaFonte: citadasNoPar.has(melhor.f),
      });
    }
  });
  return { trechos, citadosCorretamente, fontesComparadas: comMaterial };
}
