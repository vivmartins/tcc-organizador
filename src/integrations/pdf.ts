// Procura o DOI dentro de um PDF, lido inteiramente no navegador (o arquivo não é enviado a lugar nenhum).
// A biblioteca pdf.js só é carregada quando alguém importa um PDF, para não pesar o app.

import { carregarModulo } from './versao.ts';
import { extrairDoi } from '../domain/duplicatas.ts';
import { extrairPalavrasChave, type PalavrasEncontradas } from '../domain/palavrasChave.ts';
import { lerCapa, montarLinhas, type LeituraDaCapa, type LinhaPdf } from '../domain/capaPdf.ts';

export interface LeituraPdf {
  doi: string | null;
  /** Palavras-chave escritas pelos autores (linha "Palavras-chave:", "Descritores:" ou "Keywords:"), com o idioma. */
  palavrasChave: PalavrasEncontradas | null;
  /** Texto de todas as páginas (para a auditoria) e o número de páginas lidas. */
  texto: string;
  paginas: number;
  /** Título, autoria, ano etc. lidos das primeiras páginas (para PDFs sem DOI). */
  capa: LeituraDaCapa;
}

export const MAX_PAGINAS = 400;

export const TAMANHO_MAXIMO_PDF = 50 * 1024 * 1024;

export async function lerPdf(arquivo: File, paginasParaDoi = 3): Promise<LeituraPdf> {
  if (arquivo.type && arquivo.type !== 'application/pdf') throw new Error('Escolha um arquivo PDF.');
  if (arquivo.size > TAMANHO_MAXIMO_PDF) throw new Error('O PDF é grande demais (limite de 50 MB).');
  // Versão "legacy": inclui adaptações para navegadores que ainda não têm os recursos mais novos de JavaScript.
  const pdfjs = await carregarModulo(() => import('pdfjs-dist/legacy/build/pdf.mjs'));
  const { default: workerUrl } = await carregarModulo(() => import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'));
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  let doc;
  try {
    doc = await tarefa.promise;
  } catch {
    throw new Error('Não foi possível abrir este PDF. Ele pode estar protegido ou danificado.');
  }
  try {
    let doi: string | null = null;
    let palavrasChave: PalavrasEncontradas | null = null;
    // 1) Metadados do arquivo (algumas editoras gravam o DOI e as palavras-chave ali)
    const info = (await doc.getMetadata().catch(() => null))?.info as Record<string, unknown> | undefined;
    for (const v of Object.values(info ?? {})) if (typeof v === 'string') doi ??= extrairDoi(v);
    // 2) Texto de todas as páginas (com as quebras de linha, que ajudam a separar as seções).
    //    DOI e palavras-chave são procurados só no começo do artigo.
    const total = Math.min(MAX_PAGINAS, doc.numPages);
    const paginasTexto: string[] = [];
    const linhasIniciais: LinhaPdf[][] = [];
    for (let n = 1; n <= total; n++) {
      const pagina = await doc.getPage(n);
      const conteudo = await pagina.getTextContent();
      const texto = conteudo.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : '') : '')).join(' ').replace(/ +\n/g, '\n');
      paginasTexto.push(texto);
      if (n <= 3) {
        linhasIniciais.push(montarLinhas(conteudo.items.filter((i) => 'str' in i).map((i) => {
          const t = (i as { transform: number[] }).transform;
          return { str: (i as { str: string }).str, x: t[4], y: t[5], altura: Math.hypot(t[2], t[3]) || (i as { height: number }).height, largura: (i as { width: number }).width };
        })));
      }
      if (n <= paginasParaDoi) {
        // junta quebras dentro do DOI ("10.1590/ s0034...") que a diagramação às vezes cria
        doi ??= extrairDoi(texto) ?? extrairDoi(texto.replace(/(10\.\d{4,9}\/)\s+/g, '$1'));
        palavrasChave ??= extrairPalavrasChave(texto);
      }
    }
    let capa: LeituraDaCapa = { dados: {}, avisos: [] };
    try {
      capa = lerCapa(linhasIniciais, info);
    } catch {
      // leitura da capa é um extra: se falhar, segue só com o DOI e o texto
    }
    return { doi, palavrasChave, texto: paginasTexto.join('\n\n'), paginas: total, capa };
  } finally {
    void tarefa.destroy();
  }
}
