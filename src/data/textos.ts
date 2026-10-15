import { db, agora, type TextoFonte } from './db.ts';

export const contarPalavras = (t: string) => (t.match(/\p{L}[\p{L}\p{N}'’-]*/gu) ?? []).length;

/** Guarda (ou substitui) o texto de uma fonte para a auditoria. */
export async function salvarTexto(fonteId: string, d: { origem: TextoFonte['origem']; texto: string; nomeArquivo?: string; paginas?: number }): Promise<TextoFonte> {
  const fonte = await db.fontes.get(fonteId);
  if (!fonte) throw new Error('Fonte não encontrada.');
  const texto = d.texto.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const palavras = contarPalavras(texto);
  if (palavras < 20) throw new Error('Não encontramos texto suficiente. Se o PDF for escaneado (uma foto das páginas), não há texto para ler.');
  const registro: TextoFonte = { id: fonteId, projetoId: fonte.projetoId, origem: d.origem, texto, palavras, criadoEm: agora() };
  if (d.nomeArquivo) registro.nomeArquivo = d.nomeArquivo;
  if (d.paginas) registro.paginas = d.paginas;
  await db.textos.put(registro);
  return registro;
}

export async function removerTexto(fonteId: string): Promise<void> {
  await db.textos.delete(fonteId);
}
