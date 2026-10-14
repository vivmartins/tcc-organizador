import { db, novoId, agora, type Fonte, type ResumoEstudo } from './db.ts';
import type { CampoBibliografico, StatusCampo } from '../domain/tipos.ts';
import { validarDadosBibliograficos } from '../domain/validacao.ts';
import { encontrarDuplicatas, type PossivelDuplicata } from '../domain/duplicatas.ts';

/** O que o formulário envia (sem identificadores nem datas). */
export type DadosFonte = Omit<Fonte, 'id' | 'projetoId' | 'criadoEm' | 'atualizadoEm' | 'statusCampos' | 'resumo'> & {
  resumo?: ResumoEstudo;
  statusCampos?: Fonte['statusCampos'];
};

export class ErroDeValidacao extends Error {
  erros: Record<string, string>;
  constructor(erros: Record<string, string>) {
    super('Há campos com problemas. Revise o formulário.');
    this.erros = erros;
  }
}

const CAMPOS_TEXTO: CampoBibliografico[] = [
  'titulo', 'subtitulo', 'veiculo', 'edicao', 'localPublicacao', 'editora', 'volume', 'numero',
  'paginas', 'numeroArtigo', 'doi', 'url', 'dataAcesso', 'tipoTrabalho', 'numeroEvento', 'localEvento', 'tituloAnais',
];

/** Remove espaços sobrando, transforma campos vazios em "não informado" e descarta autores em branco. */
export function normalizarDadosFonte(d: DadosFonte): DadosFonte {
  const r: DadosFonte = { ...d };
  for (const c of CAMPOS_TEXTO) {
    const v = r[c];
    if (typeof v === 'string') {
      const t = v.replace(/\s+/g, ' ').trim();
      (r as unknown as Record<string, unknown>)[c] = t === '' ? undefined : t;
    }
  }
  const limparAutores = (lista?: Fonte['autores']) =>
    (lista ?? [])
      .map((a) => ({ tipo: a.tipo, sobrenome: a.sobrenome.trim(), prenomes: a.prenomes?.trim() || undefined }))
      .filter((a) => a.sobrenome);
  r.autores = limparAutores(r.autores);
  r.organizadores = limparAutores(r.organizadores);
  r.palavrasChave = [...new Set((r.palavrasChave ?? []).map((p) => p.trim()).filter(Boolean))];
  r.tagIds = [...new Set(r.tagIds ?? [])];
  if (typeof r.ano === 'number' && Number.isNaN(r.ano)) r.ano = undefined;
  if (typeof r.anoEvento === 'number' && Number.isNaN(r.anoEvento)) r.anoEvento = undefined;
  if (r.observacoes !== undefined) r.observacoes = r.observacoes.trim() || undefined;
  return r;
}

function validar(d: DadosFonte) {
  const erros = validarDadosBibliograficos(d);
  if (Object.keys(erros).length) throw new ErroDeValidacao(erros as Record<string, string>);
}

export async function verificarDuplicatas(projetoId: string, d: DadosFonte, idAtual?: string): Promise<{ duplicata: PossivelDuplicata; fonte: Fonte }[]> {
  const existentes = await db.fontes.where('projetoId').equals(projetoId).toArray();
  const achados = encontrarDuplicatas({ ...d, id: idAtual }, existentes);
  return achados.map((a) => ({ duplicata: a, fonte: existentes.find((f) => f.id === a.id)! }));
}

export async function criarFonte(projetoId: string, dados: DadosFonte): Promise<Fonte> {
  const d = normalizarDadosFonte(dados);
  validar(d);
  const t = agora();
  const fonte: Fonte = {
    ...d,
    id: novoId(),
    projetoId,
    resumo: d.resumo ?? {},
    statusCampos: d.statusCampos ?? {},
    criadoEm: t,
    atualizadoEm: t,
  };
  await db.fontes.add(fonte);
  return fonte;
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Atualiza a fonte. Campos cujo valor mudou voltam a "não conferido". */
export async function atualizarFonte(id: string, dados: DadosFonte): Promise<void> {
  const atual = await db.fontes.get(id);
  if (!atual) throw new Error('Fonte não encontrada.');
  const d = normalizarDadosFonte(dados);
  validar(d);
  const status = { ...atual.statusCampos };
  for (const campo of Object.keys(status) as CampoBibliografico[]) {
    if (!igual(atual[campo], d[campo])) delete status[campo];
  }
  // Remove do objeto salvo os campos que ficaram vazios
  const novo: Fonte = { ...atual, ...d, statusCampos: status, resumo: d.resumo ?? atual.resumo, atualizadoEm: agora() };
  for (const k of Object.keys(novo) as (keyof Fonte)[]) if (novo[k] === undefined) delete novo[k];
  await db.fontes.put(novo);
}

export async function marcarCampos(id: string, campos: CampoBibliografico[], status: StatusCampo): Promise<void> {
  await db.fontes
    .where('id')
    .equals(id)
    .modify((f) => {
      for (const c of campos) f.statusCampos[c] = status;
    });
}

export async function atualizarResumo(id: string, resumo: ResumoEstudo): Promise<void> {
  const limpo: ResumoEstudo = {};
  for (const [k, v] of Object.entries(resumo)) {
    const t = (v ?? '').trim();
    if (t) limpo[k as keyof ResumoEstudo] = t;
  }
  await db.fontes.update(id, { resumo: limpo, atualizadoEm: agora() });
}

export async function atualizarStatusLeitura(id: string, statusLeitura: Fonte['statusLeitura']): Promise<void> {
  await db.fontes.update(id, { statusLeitura, atualizadoEm: agora() });
}

/** Exclui a fonte e os fichamentos ligados a ela. */
export async function excluirFonte(id: string): Promise<void> {
  await db.transaction('rw', db.fontes, db.fichamentos, async () => {
    await db.fichamentos.where('fonteId').equals(id).delete();
    await db.fontes.delete(id);
  });
}
