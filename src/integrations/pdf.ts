// Procura o DOI dentro de um PDF, lido inteiramente no navegador (o arquivo não é enviado a lugar nenhum).
// A biblioteca pdf.js só é carregada quando alguém importa um PDF, para não pesar o app.

import { extrairDoi } from '../domain/duplicatas.ts';

export const TAMANHO_MAXIMO_PDF = 50 * 1024 * 1024;

export async function encontrarDoiNoPdf(arquivo: File, paginas = 3): Promise<string | null> {
  if (arquivo.type && arquivo.type !== 'application/pdf') throw new Error('Escolha um arquivo PDF.');
  if (arquivo.size > TAMANHO_MAXIMO_PDF) throw new Error('O PDF é grande demais (limite de 50 MB).');
  // Versão "legacy": inclui adaptações para navegadores que ainda não têm os recursos mais novos de JavaScript.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  let doc;
  try {
    doc = await tarefa.promise;
  } catch {
    throw new Error('Não foi possível abrir este PDF. Ele pode estar protegido ou danificado.');
  }
  try {
    // 1) Metadados do arquivo (algumas editoras gravam o DOI ali)
    const info = (await doc.getMetadata().catch(() => null))?.info as Record<string, unknown> | undefined;
    for (const v of Object.values(info ?? {})) {
      if (typeof v === 'string') {
        const doi = extrairDoi(v);
        if (doi) return doi;
      }
    }
    // 2) Texto das primeiras páginas
    for (let n = 1; n <= Math.min(paginas, doc.numPages); n++) {
      const pagina = await doc.getPage(n);
      const conteudo = await pagina.getTextContent();
      const texto = conteudo.items.map((i) => ('str' in i ? i.str : '')).join(' ');
      // junta quebras dentro do DOI ("10.1590/ s0034...") que a diagramação às vezes cria
      const doi = extrairDoi(texto) ?? extrairDoi(texto.replace(/(10\.\d{4,9}\/)\s+/g, '$1'));
      if (doi) return doi;
    }
    return null;
  } finally {
    void tarefa.destroy();
  }
}
