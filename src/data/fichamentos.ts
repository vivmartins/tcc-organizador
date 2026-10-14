import { db, novoId, agora, type Fichamento } from './db.ts';
import { validarFicha, type ConteudoFicha } from '../domain/fichamento.ts';
import { ErroDeValidacao } from './fontes.ts';

export type DadosFicha = ConteudoFicha & { tagIds: string[] };

/** Limpa espaços nas pontas dos campos curtos. O trecho original é guardado
 *  exatamente como digitado (só se descarta se estiver totalmente em branco). */
function normalizar(d: DadosFicha): DadosFicha {
  const curto = (s?: string) => (s?.trim() ? s.trim() : undefined);
  const longo = (s?: string) => (s?.trim() ? s : undefined);
  return {
    tipo: d.tipo,
    trechoOriginal: longo(d.trechoOriginal),
    pagina: curto(d.pagina),
    parafrase: longo(d.parafrase)?.trim(),
    interpretacao: longo(d.interpretacao)?.trim(),
    tema: curto(d.tema),
    capituloSecao: curto(d.capituloSecao),
    tagIds: [...new Set(d.tagIds ?? [])],
  };
}

function validar(d: DadosFicha) {
  const erros = validarFicha(d);
  if (Object.keys(erros).length) throw new ErroDeValidacao(erros);
}

export async function criarFicha(fonteId: string, dados: DadosFicha): Promise<Fichamento> {
  const fonte = await db.fontes.get(fonteId);
  if (!fonte) throw new Error('Fonte não encontrada.');
  const d = normalizar(dados);
  validar(d);
  const t = agora();
  const ficha: Fichamento = { ...d, id: novoId(), fonteId, projetoId: fonte.projetoId, criadoEm: t, atualizadoEm: t };
  await db.fichamentos.add(ficha);
  return ficha;
}

export async function atualizarFicha(id: string, dados: DadosFicha): Promise<void> {
  const atual = await db.fichamentos.get(id);
  if (!atual) throw new Error('Fichamento não encontrado.');
  const d = normalizar(dados);
  validar(d);
  const novo: Fichamento = { ...atual, ...d, atualizadoEm: agora() };
  for (const k of Object.keys(novo) as (keyof Fichamento)[]) if (novo[k] === undefined) delete novo[k];
  await db.fichamentos.put(novo);
}

export async function excluirFicha(id: string): Promise<void> {
  await db.fichamentos.delete(id);
}
