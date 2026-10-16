// Auditoria no estilo Vancouver: citações numéricas no texto (¹, (1), [1]) e lista numerada.
// As citações viram o mesmo formato das citações autor-data (obra = autor e ano da referência daquele
// número), então as outras verificações (citações diretas, semelhança) continuam funcionando.

import type { ParagrafoCorpo } from './documento.ts';
import type { Citacao, ObraCitada } from './citacoes.ts';
import { lerReferencia, normalizarAno, type ReferenciaLida } from './referencias.ts';
import { procurarObra } from './cruzamento.ts';
import type { FonteAuditoria } from './biblioteca.ts';
import { normalizar } from './texto.ts';

export type ChamadaNumerica = 'sobrescrito' | 'parenteses' | 'colchetes';

export interface ReferenciaNumerada extends ReferenciaLida {
  numero: number;
  /** a entrada da lista não começa com número (foi numerada pela posição) */
  semNumero?: boolean;
  /** como mostrar: "Levitt, 2012" */
  rotulo: string;
}

export interface OcorrenciaNumero {
  paragrafo: number;
  inicio: number;
  fim: number;
  texto: string;
}

export interface ResultadoVancouver {
  /** números citados que não existem na lista */
  semReferencia: { numero: number; ocorrencias: OcorrenciaNumero[] }[];
  /** primeira citação de um número fora da sequência (ex.: o texto cita 3 antes de 2) */
  foraDeOrdem: { numero: number; esperado: number; ocorrencia: OcorrenciaNumero }[];
  /** números na ordem em que aparecem pela primeira vez no texto */
  ordem: number[];
  /** a lista de referências tem entradas sem número */
  listaSemNumero: number;
  /** numeração sugerida para a biblioteca, na ordem de citação do TCC */
  numeracao: { fonteId: string; rotulo: string; numero: number }[];
  /** referências citadas que não foram encontradas na biblioteca */
  foraDaBiblioteca: ReferenciaNumerada[];
}

const ANO_PUB = /\b(1[5-9]\d{2}|20\d{2})([a-z])?(?=\s*(?:[;:(]|\[|\.|,|\s+(?:jan|fev|feb|mar|abr|apr|maio|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)\b|$))/gi;

/** Lê uma entrada da lista: número, primeiro autor e ano. Aceita "Silva MA, ..." e "SILVA, Maria ...". */
export function lerReferenciaVancouver(texto: string, posicao: number): ReferenciaNumerada {
  const m = /^\s*\[?(\d{1,3})\s*[.)\]]?\s+/.exec(texto);
  const numero = m ? Number(m[1]) : posicao + 1;
  const corpo = m ? texto.slice(m[0].length) : texto;
  const base = lerReferencia(corpo, posicao);
  let autores = base.autores;
  let nome = '';
  const v = /^\s*([\p{Lu}][\p{L}'’\-]*(?:\s+[\p{Ll}]{1,3})?(?:\s+[\p{Lu}][\p{Ll}'’\-]+)*)\s+\p{Lu}{1,4}\s*[,.]/u.exec(corpo);
  if (v) {
    nome = v[1];
    autores = [normalizar(v[1])];
  } else if (autores.length) {
    nome = corpo.match(/^\s*([^,.]+)/)?.[1] ?? '';
  } else {
    // entidade ou título: até o primeiro ponto
    nome = corpo.match(/^\s*([^.]+)/)?.[1] ?? '';
    autores = nome ? [normalizar(nome)] : [];
  }
  const limpo = corpo
    .replace(/\[citado[^\]]*\]/gi, ' ')
    .replace(/acesso em:?.{0,25}?\d{4}/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bdoi:?\s*\S+/gi, ' ');
  // o ano de publicação vem antes de ";" (artigo: "2012;27(3)"), depois de "Editora; " (livro), ou entre parênteses
  const Y = '(1[5-9]\\d{2}|20\\d{2})([a-z])?';
  const forte = limpo.match(new RegExp(`${Y}(?:\\s+\\p{L}{3,4}(?:\\s+\\d{1,2})?)?\\s*(?:;|\\[citado)`, 'iu'))
    ?? limpo.match(new RegExp(`;\\s*${Y}\\b`, 'iu'))
    ?? limpo.match(new RegExp(`\\(${Y}\\)`, 'iu'));
  const anos = [...limpo.matchAll(ANO_PUB)].map((x) => normalizarAno(x[0]));
  const ano = forte ? normalizarAno(forte[1] + (forte[2] ?? '')) : (anos.at(-1) ?? base.ano);
  const nomeBonito = nome ? nome.trim().toLocaleLowerCase('pt-BR').replace(/(^|[\s-])(\p{L})/gu, (_, a: string, l: string) => a + l.toLocaleUpperCase('pt-BR')) : '';
  return {
    ...base,
    texto,
    autores,
    anos: [...new Set([...(ano ? [ano] : []), ...base.anos])],
    ano,
    numero,
    semNumero: !m,
    rotulo: `${nomeBonito || 'Referência'}${ano ? `, ${ano}` : ''}`,
  };
}

export const lerReferenciasVancouver = (lista: string[]) => lista.map((t, i) => lerReferenciaVancouver(t, i));

const SOBRE: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '˒': ',' };
const DIG_SOBRE = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** "1-3, 5" → [1, 2, 3, 5] (intervalos de até 50 números). */
export function expandirNumeros(s: string): number[] {
  const r: number[] = [];
  for (const parte of s.split(/[,;]/)) {
    const m = /^\s*(\d{1,3})\s*(?:[-–]\s*(\d{1,3}))?\s*$/.exec(parte);
    if (!m) return [];
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (b < a || b - a > 50) return [];
    for (let n = a; n <= b; n++) r.push(n);
  }
  return r;
}

const PALAVRA_ANTES = /(figura|fig|tabela|quadro|gráfico|grafico|equação|equacao|anexo|apêndice|apendice|capítulo|capitulo|item|passo|etapa|nota|art|inciso|grupo|n)\.?\s*$/i;

interface Achado { paragrafo: number; inicio: number; fim: number; texto: string; numeros: number[]; pagina?: string }

/** Encontra as citações numéricas. O sobrescrito é sempre procurado; parênteses e colchetes só no formato escolhido. */
export function encontrarNumeros(corpo: ParagrafoCorpo[], chamada: ChamadaNumerica, maximo: number): Achado[] {
  const r: Achado[] = [];
  const ok = (ns: number[]) => ns.length > 0 && ns.every((n) => n >= 1 && n <= maximo);
  corpo.forEach((par, pi) => {
    const t = par.texto;
    for (const m of t.matchAll(new RegExp(`[${DIG_SOBRE}]+(?:\\s?[,⁻˒–-]\\s?[${DIG_SOBRE}]+)*`, 'g'))) {
      // unidades (cm², m³) e potências (10³) não são citação
      const antes = t.slice(Math.max(0, m.index! - 4), m.index!);
      if (/\d$/.test(antes) || (/^[²³]$/.test(m[0]) && /(?:^|[^\p{L}])(?:m|cm|mm|km|dm|l|ml|s|x|r|p)$/iu.test(antes))) continue;
      const ns = expandirNumeros([...m[0]].map((c) => SOBRE[c] ?? c).join(''));
      if (ok(ns)) r.push({ paragrafo: pi, inicio: m.index!, fim: m.index! + m[0].length, texto: m[0], numeros: ns });
    }
    if (chamada === 'sobrescrito') return;
    const [a, b] = chamada === 'parenteses' ? ['\\(', '\\)'] : ['\\[', '\\]'];
    const re = new RegExp(`${a}\\s*(\\d{1,3}(?:\\s*[,;–-]\\s*\\d{1,3})*)(?:\\s*[,:]\\s*(?:p\\.?\\s*)?(\\d+(?:\\s*[-–]\\s*\\d+)?))?\\s*${b}`, 'g');
    for (const m of t.matchAll(re)) {
      if (PALAVRA_ANTES.test(t.slice(Math.max(0, m.index! - 14), m.index!))) continue;
      // "(1)" no começo de um item de lista não é citação
      if (/^\s*$/.test(t.slice(0, m.index!)) && /^\s*\S/.test(t.slice(m.index! + m[0].length))) continue;
      const ns = expandirNumeros(m[1]);
      if (ok(ns)) r.push({ paragrafo: pi, inicio: m.index!, fim: m.index! + m[0].length, texto: m[0], numeros: ns, pagina: m[2]?.replace(/\s+/g, '') });
    }
  });
  return r.sort((x, y) => x.paragrafo - y.paragrafo || x.inicio - y.inicio);
}

export function auditarVancouver(corpo: ParagrafoCorpo[], refs: ReferenciaNumerada[], fontes: FonteAuditoria[], chamada: ChamadaNumerica): { citacoes: Citacao[]; vancouver: ResultadoVancouver } {
  const porNumero = new Map(refs.map((r) => [r.numero, r]));
  const maximo = Math.max(refs.length ? Math.max(...refs.map((r) => r.numero)) : 0, 0) + 20; // aceita números além da lista, para apontar o erro
  const achados = encontrarNumeros(corpo, chamada, maximo);
  const citacoes: Citacao[] = [];
  const semRef = new Map<number, OcorrenciaNumero[]>();
  const ordem: number[] = [];
  const foraDeOrdem: ResultadoVancouver['foraDeOrdem'] = [];
  for (const a of achados) {
    const oc: OcorrenciaNumero = { paragrafo: a.paragrafo, inicio: a.inicio, fim: a.fim, texto: a.texto };
    const obras: ObraCitada[] = [];
    for (const n of a.numeros) {
      if (!ordem.includes(n)) {
        const esperado = ordem.length + 1;
        if (n > esperado && !foraDeOrdem.some((f) => f.numero === n)) foraDeOrdem.push({ numero: n, esperado, ocorrencia: oc });
        ordem.push(n);
      }
      const ref = porNumero.get(n);
      if (!ref) { semRef.set(n, [...(semRef.get(n) ?? []), oc]); continue; }
      obras.push({ autores: ref.autores.length ? [{ escrito: ref.rotulo.replace(/,[^,]*$/, ''), candidatos: [ref.autores[0]] }] : [], etAl: false, ano: ref.ano ?? 'sd', pagina: a.pagina });
    }
    if (obras.length) citacoes.push({ id: citacoes.length, tipo: 'parentetica', texto: a.texto, paragrafo: a.paragrafo, inicio: a.inicio, fim: a.fim, obras });
  }
  // numeração sugerida: a k-ésima obra citada pela primeira vez recebe o número k
  const numeracao: ResultadoVancouver['numeracao'] = [];
  const foraDaBiblioteca: ReferenciaNumerada[] = [];
  const usadas = new Set<string>();
  ordem.forEach((n, k) => {
    const ref = porNumero.get(n);
    if (!ref || !ref.autores.length) return;
    const obra: ObraCitada = { autores: [{ escrito: ref.rotulo, candidatos: [ref.autores[0]] }], etAl: false, ano: ref.ano ?? 'sd' };
    const f = procurarObra(obra, fontes).iguais.find((x) => !usadas.has(x.id));
    if (f) { usadas.add(f.id); numeracao.push({ fonteId: f.id, rotulo: f.rotulo, numero: k + 1 }); }
    else foraDaBiblioteca.push(ref);
  });
  return {
    citacoes,
    vancouver: {
      semReferencia: [...semRef.entries()].sort((a, b) => a[0] - b[0]).map(([numero, ocorrencias]) => ({ numero, ocorrencias })),
      foraDeOrdem,
      ordem,
      listaSemNumero: refs.filter((r) => r.semNumero).length,
      numeracao,
      foraDaBiblioteca,
    },
  };
}
