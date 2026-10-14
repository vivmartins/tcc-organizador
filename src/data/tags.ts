import { db, novoId, agora, type Tag } from './db.ts';
import { normalizarParaBusca } from '../domain/busca.ts';

/** Cria a tag ou devolve a existente com o mesmo nome (ignorando acentos e maiúsculas). */
export async function obterOuCriarTag(projetoId: string, nome: string): Promise<Tag> {
  const limpo = nome.replace(/\s+/g, ' ').trim();
  if (!limpo) throw new Error('Informe o nome da tag.');
  const chave = normalizarParaBusca(limpo);
  const existentes = await db.tags.where('projetoId').equals(projetoId).toArray();
  const igual = existentes.find((t) => normalizarParaBusca(t.nome) === chave);
  if (igual) return igual;
  const tag: Tag = { id: novoId(), projetoId, nome: limpo, criadoEm: agora() };
  await db.tags.add(tag);
  return tag;
}

export async function renomearTag(id: string, nome: string): Promise<void> {
  const limpo = nome.replace(/\s+/g, ' ').trim();
  if (!limpo) throw new Error('Informe o nome da tag.');
  await db.tags.update(id, { nome: limpo });
}

/** Exclui a tag e a remove de fontes e fichamentos. */
export async function excluirTag(id: string): Promise<void> {
  await db.transaction('rw', db.tags, db.fontes, db.fichamentos, async () => {
    await db.fontes.where('tagIds').equals(id).modify((f) => {
      f.tagIds = f.tagIds.filter((t) => t !== id);
    });
    await db.fichamentos.where('tagIds').equals(id).modify((f) => {
      f.tagIds = f.tagIds.filter((t) => t !== id);
    });
    await db.tags.delete(id);
  });
}
