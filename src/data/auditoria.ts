import { db } from './db.ts';
import { prepararFonte, type FonteAuditoria } from '../domain/auditoria/biblioteca.ts';

/** Fontes do projeto com o texto guardado e os trechos originais das fichas, prontas para a auditoria. */
export async function carregarFontesParaAuditoria(projetoId: string): Promise<FonteAuditoria[]> {
  const [fontes, textos, fichas] = await Promise.all([
    db.fontes.where('projetoId').equals(projetoId).toArray(),
    db.textos.where('projetoId').equals(projetoId).toArray(),
    db.fichamentos.where('projetoId').equals(projetoId).toArray(),
  ]);
  const textoDe = new Map(textos.map((t) => [t.id, t]));
  return fontes.map((f) => {
    const t = textoDe.get(f.id);
    return prepararFonte(
      { id: f.id, titulo: f.titulo ?? '', ano: f.ano, autores: f.autores ?? [] },
      t ? { texto: t.texto, origem: t.origem } : undefined,
      fichas.filter((x) => x.fonteId === f.id),
    );
  });
}
