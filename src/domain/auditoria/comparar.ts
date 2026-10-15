// Comparação palavra a palavra entre um trecho do TCC e um texto da fonte.
// Ignora maiúsculas, acentos e pontuação; respeita supressões marcadas com [...].

import { palavras, type Palavra } from './texto.ts';

export interface PedacoDiferenca {
  tipo: 'igual' | 'so_tcc' | 'so_fonte';
  texto: string;
}

export interface Comparacao {
  /** todas as partes do trecho aparecem exatamente, na ordem */
  identico: boolean;
  /** proporção das palavras do trecho que aparecem na mesma ordem no texto (0 a 1) */
  semelhanca: number;
  /** trecho correspondente no texto da fonte */
  trechoFonte: string;
  diferencas: PedacoDiferenca[];
}

const SUPRESSAO = /\[\s*(?:\.\.\.|…)\s*\]|\(\s*(?:\.\.\.|…)\s*\)|\.\.\.|…/;
const SUPRESSOES = new RegExp(SUPRESSAO.source, 'g');

/** Procura o trecho (com possíveis supressões [...]) no texto. */
export function contemTrecho(trecho: string, alvo: Palavra[]): boolean {
  const partes = trecho.split(SUPRESSAO).map((p) => palavras(p).map((w) => w.p)).filter((p) => p.length);
  if (!partes.length) return false;
  const texto = ` ${alvo.map((w) => w.p).join(' ')} `;
  let de = 0;
  for (const p of partes) {
    const i = texto.indexOf(` ${p.join(' ')} `, de);
    if (i < 0) return false;
    de = i + p.join(' ').length;
  }
  return true;
}

/** Onde o trecho provavelmente está no texto: votação por sequências de 3 palavras. */
export function localizar(q: string[], alvo: string[]): number | null {
  if (q.length < 3 || alvo.length < 3) return null;
  const tri = new Map<string, number[]>();
  for (let i = 0; i + 2 < q.length; i++) {
    const k = `${q[i]} ${q[i + 1]} ${q[i + 2]}`;
    const l = tri.get(k) ?? [];
    l.push(i);
    tri.set(k, l);
  }
  const votos = new Map<number, number>();
  for (let j = 0; j + 2 < alvo.length; j++) {
    const ps = tri.get(`${alvo[j]} ${alvo[j + 1]} ${alvo[j + 2]}`);
    if (!ps) continue;
    for (const i of ps) {
      const s = Math.floor((j - i) / 4); // agrupa inícios próximos
      votos.set(s, (votos.get(s) ?? 0) + 1);
    }
  }
  let melhor: number | null = null;
  let max = 0;
  for (const [s, v] of votos) if (v > max) { max = v; melhor = s; }
  return melhor === null ? null : Math.max(0, melhor * 4);
}

function lcs(a: string[], b: string[]): number[][] {
  const t = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  return t;
}

/** Compara o trecho do TCC com um texto da fonte. Devolve null se não houver nada parecido. */
export function comparar(trechoTcc: string, textoFonte: string, alvoPronto?: Palavra[]): Comparacao | null {
  const qw = palavras(trechoTcc.replace(SUPRESSOES, ' '));
  const aw = alvoPronto ?? palavras(textoFonte);
  if (!qw.length || !aw.length) return null;
  const q = qw.map((w) => w.p);
  const ini = localizar(q, aw.map((w) => w.p));
  if (ini === null) return null;
  const a0 = Math.max(0, ini - 6);
  const janela = aw.slice(a0, Math.min(aw.length, ini + q.length + 10));
  const b = janela.map((w) => w.p);
  const t = lcs(q, b);
  // percorre a tabela montando as diferenças; corta o que sobra da janela antes e depois
  const ops: { tipo: PedacoDiferenca['tipo']; w: Palavra; doTcc: boolean }[] = [];
  let i = 0;
  let j = 0;
  while (i < q.length && j < b.length) {
    if (q[i] === b[j]) { ops.push({ tipo: 'igual', w: qw[i], doTcc: true }); i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) { ops.push({ tipo: 'so_tcc', w: qw[i], doTcc: true }); i++; }
    else { ops.push({ tipo: 'so_fonte', w: janela[j], doTcc: false }); j++; }
  }
  for (; i < q.length; i++) ops.push({ tipo: 'so_tcc', w: qw[i], doTcc: true });
  const primeiro = ops.findIndex((o) => o.tipo === 'igual');
  let ultimo = -1;
  ops.forEach((o, k) => { if (o.tipo === 'igual') ultimo = k; });
  const util = ops.filter((o, k) => !(o.tipo === 'so_fonte' && (k < primeiro || k > ultimo)));
  const iguais = util.filter((o) => o.tipo === 'igual').length;
  const diferencas: PedacoDiferenca[] = [];
  for (const o of util) {
    const texto = o.doTcc ? trechoTcc.replace(SUPRESSOES, ' ').slice(o.w.inicio, o.w.fim) : textoFonte.slice(o.w.inicio, o.w.fim);
    const ult = diferencas.at(-1);
    if (ult && ult.tipo === o.tipo) ult.texto += ` ${texto}`;
    else diferencas.push({ tipo: o.tipo, texto });
  }
  const casadasFonte: Palavra[] = [];
  // posições na fonte do primeiro e do último trecho igual, para recortar o texto original
  let jj = 0;
  for (const o of ops) {
    if (o.tipo === 'so_tcc') continue;
    if (o.tipo === 'igual') casadasFonte.push(janela[jj]);
    jj++;
  }
  const trechoFonte = casadasFonte.length
    ? textoFonte.slice(casadasFonte[0].inicio, casadasFonte.at(-1)!.fim).replace(/\s+/g, ' ')
    : '';
  return {
    identico: contemTrecho(trechoTcc, aw),
    semelhanca: q.length ? iguais / q.length : 0,
    trechoFonte,
    diferencas,
  };
}

/** "12", "12-13", "p. 12" → [12, 13]. Números romanos não são comparados. */
function intervalo(p?: string): [number, number] | null {
  const m = (p ?? '').match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return [a, Math.max(a, b)];
}

/** true/false se dá para comparar; null se alguma página não é numérica ou não foi informada. */
export function paginasConferem(a?: string, b?: string): boolean | null {
  const x = intervalo(a);
  const y = intervalo(b);
  if (!x || !y) return null;
  return x[0] <= y[1] && y[0] <= x[1];
}
