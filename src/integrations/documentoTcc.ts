// Lê o arquivo do TCC (Word .docx ou PDF) no próprio navegador. O arquivo não é enviado nem guardado.

import { carregarModulo } from './versao.ts';
import type { DocumentoTcc, Paragrafo } from '../domain/auditoria/documento.ts';

export const TAMANHO_MAXIMO_TCC = 60 * 1024 * 1024;
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const TWIPS_POR_CM = 567;
const PONTOS_POR_CM = 28.35;

export async function lerDocumentoTcc(arquivo: File): Promise<DocumentoTcc> {
  if (arquivo.size > TAMANHO_MAXIMO_TCC) throw new Error('O arquivo é grande demais (limite de 60 MB).');
  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith('.doc')) throw new Error('Arquivos .doc (Word antigo) não são lidos. No Word, use Arquivo → Salvar como → Documento do Word (.docx).');
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  if (nome.endsWith('.pdf') || arquivo.type === 'application/pdf') return { nomeArquivo: arquivo.name, origem: 'pdf', paragrafos: await lerPdfDoTcc(dados) };
  if (nome.endsWith('.docx') || arquivo.type.includes('wordprocessingml')) return { nomeArquivo: arquivo.name, origem: 'docx', paragrafos: await lerDocx(dados) };
  throw new Error('Escolha o arquivo do TCC em Word (.docx) ou PDF.');
}

// ---------------------------------------------------------------------
// Word (.docx): um arquivo zip com o texto em word/document.xml
// ---------------------------------------------------------------------

function attr(el: Element | null | undefined, nome: string): string | null {
  return el?.getAttributeNS(W, nome) ?? el?.getAttribute(`w:${nome}`) ?? null;
}

const filho = (el: Element | null | undefined, nome: string) =>
  el ? (Array.from(el.children).find((c) => c.localName === nome && c.namespaceURI === W) ?? null) : null;

/** Recuo esquerdo (em twips) de cada estilo de parágrafo, seguindo o "baseado em". */
function recuosDosEstilos(xml: string | null): Map<string, number> {
  const r = new Map<string, number>();
  if (!xml) return r;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const proprios = new Map<string, { recuo: number | null; base: string | null }>();
  for (const s of Array.from(doc.getElementsByTagNameNS(W, 'style'))) {
    if (attr(s, 'type') !== 'paragraph') continue;
    const id = attr(s, 'styleId');
    if (!id) continue;
    const ind = filho(filho(s, 'pPr'), 'ind');
    const v = attr(ind, 'left') ?? attr(ind, 'start');
    proprios.set(id, { recuo: v !== null ? Number(v) : null, base: attr(filho(s, 'basedOn'), 'val') });
  }
  for (const id of proprios.keys()) {
    let atual: string | null = id;
    for (let k = 0; atual && k < 10; k++) {
      const e = proprios.get(atual);
      if (!e) break;
      if (e.recuo !== null && !Number.isNaN(e.recuo)) { r.set(id, e.recuo); break; }
      atual = e.base;
    }
  }
  return r;
}

function textoDoParagrafo(p: Element): string {
  let t = '';
  const visitar = (el: Element) => {
    for (const c of Array.from(el.children)) {
      if (c.namespaceURI !== W) continue;
      switch (c.localName) {
        case 't': t += c.textContent ?? ''; break;
        case 'tab': t += ' '; break;
        case 'br': case 'cr': t += ' '; break;
        case 'noBreakHyphen': t += '-'; break;
        case 'del': case 'delText': case 'instrText': case 'pPr': case 'rPr': break; // revisões apagadas e códigos de campo
        case 'r': {
          // número sobrescrito (chamada do Vancouver): vira ¹²³ no texto, para a auditoria reconhecer
          const antes = t;
          visitar(c);
          if (attr(filho(filho(c, 'rPr'), 'vertAlign'), 'val') === 'superscript') {
            const novo = t.slice(antes.length);
            if (/^[\d,\s\-–]+$/.test(novo)) t = antes + novo.replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).replace(/[-–]/g, '⁻').replace(/\s+/g, '');
          }
          break;
        }
        default: visitar(c);
      }
    }
  };
  visitar(p);
  return t.replace(/\s+/g, ' ').trim();
}

export async function lerDocx(dados: Uint8Array): Promise<Paragrafo[]> {
  const { unzipSync, strFromU8 } = await carregarModulo(() => import('fflate'));
  let arquivos: Record<string, Uint8Array>;
  try {
    arquivos = unzipSync(dados, { filter: (f) => f.name === 'word/document.xml' || f.name === 'word/styles.xml' });
  } catch {
    throw new Error('Não foi possível abrir este arquivo do Word. Ele pode estar danificado ou protegido por senha.');
  }
  const principal = arquivos['word/document.xml'];
  if (!principal) throw new Error('Este arquivo não parece ser um documento do Word (.docx).');
  const estilos = recuosDosEstilos(arquivos['word/styles.xml'] ? strFromU8(arquivos['word/styles.xml']) : null);
  const doc = new DOMParser().parseFromString(strFromU8(principal), 'application/xml');
  const corpo = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!corpo) throw new Error('Não encontramos o texto deste documento.');
  const r: Paragrafo[] = [];
  for (const p of Array.from(corpo.getElementsByTagNameNS(W, 'p'))) {
    // parágrafos dentro de caixas de texto aparecem duas vezes (versão nova e alternativa antiga): usa só a nova
    let dentroDeAlternativa = false;
    for (let a = p.parentElement; a; a = a.parentElement) if (a.localName === 'Fallback') { dentroDeAlternativa = true; break; }
    if (dentroDeAlternativa) continue;
    const texto = textoDoParagrafo(p);
    const pPr = filho(p, 'pPr');
    const ind = filho(pPr, 'ind');
    const proprio = attr(ind, 'left') ?? attr(ind, 'start');
    const estilo = attr(filho(pPr, 'pStyle'), 'val');
    const twips = proprio !== null ? Number(proprio) : estilo ? estilos.get(estilo) : estilos.get('Normal');
    r.push({ texto, recuoCm: twips && !Number.isNaN(twips) ? Math.round((twips / TWIPS_POR_CM) * 100) / 100 : undefined });
  }
  return r;
}

// ---------------------------------------------------------------------
// PDF: o texto vem em pedaços com posição; montamos linhas e parágrafos
// ---------------------------------------------------------------------

interface Linha { x: number; y: number; texto: string; fimX?: number }

export function montarParagrafos(paginas: Linha[][]): Paragrafo[] {
  const r: Paragrafo[] = [];
  for (const linhas of paginas) {
    const uteis = linhas.filter((l) => l.texto.trim() && !/^\d{1,4}$/.test(l.texto.trim()));
    if (!uteis.length) continue;
    // margem esquerda: a posição mais comum do começo das linhas
    const freq = new Map<number, number>();
    for (const l of uteis) freq.set(Math.round(l.x), (freq.get(Math.round(l.x)) ?? 0) + 1);
    const margem = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    const gaps = uteis.slice(1).map((l, i) => uteis[i].y - l.y).filter((g) => g > 0).sort((a, b) => a - b);
    const gapNormal = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 14;
    let atual: { linhas: Linha[]; recuo: number } | null = null;
    const fechar = () => {
      if (!atual) return;
      let texto = '';
      for (const l of atual.linhas) {
        const t = l.texto.trim();
        if (/[A-Za-zÀ-ÿ]-$/.test(texto) && /^\p{Ll}/u.test(t)) texto = texto.slice(0, -1) + t;
        else texto += (texto ? ' ' : '') + t;
      }
      r.push({ texto: texto.replace(/\s+/g, ' ').trim(), recuoCm: Math.round((atual.recuo / PONTOS_POR_CM) * 100) / 100 });
      atual = null;
    };
    let anterior: Linha | null = null;
    for (const l of uteis) {
      const recuo = Math.max(0, l.x - margem);
      const recuada = recuo >= 3 * PONTOS_POR_CM;
      const gap = anterior ? anterior.y - l.y : 0;
      const novo =
        !atual ||
        gap > gapNormal * 1.45 ||
        gap < 0 ||
        recuada !== atual.recuo >= 3 * PONTOS_POR_CM ||
        (!recuada && recuo > 0.6 * PONTOS_POR_CM && (anterior ? anterior.x - margem : 0) < 0.6 * PONTOS_POR_CM);
      if (novo) {
        fechar();
        atual = { linhas: [], recuo: recuada ? recuo : 0 };
      }
      atual!.linhas.push(l);
      if (recuada) atual!.recuo = Math.min(atual!.recuo, recuo);
      anterior = l;
    }
    fechar();
  }
  return r;
}

async function lerPdfDoTcc(dados: Uint8Array): Promise<Paragrafo[]> {
  const pdfjs = await carregarModulo(() => import('pdfjs-dist/legacy/build/pdf.mjs'));
  const { default: workerUrl } = await carregarModulo(() => import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'));
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const tarefa = pdfjs.getDocument({ data: dados });
  let doc;
  try {
    doc = await tarefa.promise;
  } catch {
    throw new Error('Não foi possível abrir este PDF. Ele pode estar protegido ou danificado.');
  }
  try {
    const paginas: Linha[][] = [];
    for (let n = 1; n <= Math.min(doc.numPages, 600); n++) {
      const conteudo = await (await doc.getPage(n)).getTextContent();
      const linhas: Linha[] = [];
      let atual: Linha | null = null;
      for (const it of conteudo.items) {
        if (!('str' in it)) continue;
        const x = it.transform[4];
        const y = it.transform[5];
        if (atual && Math.abs(atual.y - y) < 2) {
          const separado = atual.fimX !== undefined && x - atual.fimX > 1;
          atual.texto += (separado && !/\s$/.test(atual.texto) && !/^\s/.test(it.str) ? ' ' : '') + it.str;
          atual.fimX = x + it.width;
        } else if (it.str.trim()) {
          atual = { x, y, texto: it.str, fimX: x + it.width };
          linhas.push(atual);
        }
        if (it.hasEOL) atual = null;
      }
      paginas.push(linhas);
    }
    const ps = montarParagrafos(paginas);
    if (ps.reduce((s, p) => s + p.texto.length, 0) < 200) throw new Error('Não encontramos texto neste PDF. Se ele for escaneado (foto das páginas), envie o arquivo do Word.');
    return ps;
  } finally {
    void tarefa.destroy();
  }
}
