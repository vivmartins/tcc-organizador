import { db, novoId, agora, type ChecklistItem } from './db.ts';

/** Checklist sugerido (as categorias vêm do documento do projeto). Tudo é editável. */
export const CHECKLIST_SUGERIDO: [string, string[]][] = [
  ['Dados bibliográficos', ['Conferir os dados de todas as fontes com as publicações originais', 'Preencher os dados obrigatórios que estão faltando', 'Conferir datas de acesso dos documentos online']],
  ['Lista de referências', ['Conferir se toda fonte citada no texto está na lista de referências', 'Conferir se toda referência da lista foi citada no texto', 'Conferir a ordem alfabética e a versão da norma adotada pela instituição']],
  ['Organização dos capítulos', ['Conferir a sequência: introdução, desenvolvimento e considerações finais', 'Conferir se o objetivo geral é respondido nas considerações finais', 'Conferir a numeração das seções e o sumário']],
  ['Orientações pendentes', ['Aplicar todas as orientações recebidas', 'Enviar a versão final para o orientador']],
  ['Formatação da instituição', ['Conferir margens, fonte, espaçamento e paginação', 'Conferir o formato das citações diretas longas (recuo)', 'Conferir o modelo/manual exigido pela instituição']],
  ['Elementos do documento final', ['Capa e folha de rosto', 'Resumo e palavras-chave (e abstract, se exigido)', 'Sumário', 'Referências', 'Apêndices e anexos, se houver']],
  ['Arquivos para entrega', ['Gerar o PDF final e conferir a abertura do arquivo', 'Conferir nome do arquivo e formato exigidos', 'Guardar uma cópia de segurança do arquivo final']],
];

export async function aplicarChecklistSugerido(projetoId: string): Promise<void> {
  await db.transaction('rw', db.checklist, async () => {
    if (await db.checklist.where('projetoId').equals(projetoId).count()) throw new Error('Este projeto já tem um checklist.');
    const t = agora();
    let ordem = 0;
    const itens: ChecklistItem[] = [];
    for (const [categoria, textos] of CHECKLIST_SUGERIDO) {
      for (const texto of textos) itens.push({ id: novoId(), projetoId, categoria, texto, concluido: false, ordem: ordem++, criadoEm: t, atualizadoEm: t });
    }
    await db.checklist.bulkAdd(itens);
  });
}

export async function criarItem(projetoId: string, categoria: string, texto: string): Promise<void> {
  const c = categoria.replace(/\s+/g, ' ').trim();
  const tx = texto.replace(/\s+/g, ' ').trim();
  if (!c) throw new Error('Informe a categoria.');
  if (!tx) throw new Error('Escreva o item.');
  const ultimos = await db.checklist.where('projetoId').equals(projetoId).toArray();
  const t = agora();
  await db.checklist.add({ id: novoId(), projetoId, categoria: c, texto: tx, concluido: false, ordem: ultimos.reduce((m, i) => Math.max(m, i.ordem + 1), 0), criadoEm: t, atualizadoEm: t });
}

export async function editarItem(id: string, texto: string): Promise<void> {
  const tx = texto.replace(/\s+/g, ' ').trim();
  if (!tx) throw new Error('O item não pode ficar vazio.');
  await db.checklist.update(id, { texto: tx, atualizadoEm: agora() });
}

export async function alternarItem(id: string, concluido: boolean): Promise<void> {
  await db.checklist.update(id, { concluido, atualizadoEm: agora() });
}

export async function excluirItem(id: string): Promise<void> {
  await db.checklist.delete(id);
}

export async function renomearCategoria(projetoId: string, de: string, para: string): Promise<void> {
  const p = para.replace(/\s+/g, ' ').trim();
  if (!p) throw new Error('Informe o nome da categoria.');
  await db.checklist.where('projetoId').equals(projetoId).filter((i) => i.categoria === de).modify({ categoria: p });
}
