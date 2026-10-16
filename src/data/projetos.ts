import { db, novoId, agora, TABELAS_DO_PROJETO, type Projeto } from './db.ts';

export type DadosProjeto = Pick<Projeto, 'nome' | 'tema' | 'objetivoGeral' | 'dataInicio' | 'prazoFinal' | 'etAlNasReferencias' | 'citacaoMaiusculas' | 'normaReferencias' | 'chamadaVancouver'>;

const CHAVE_ATIVO = 'projetoAtivoId';

function limparOpcionais<T extends object>(o: T): T {
  const r = { ...o } as Record<string, unknown>;
  for (const k of Object.keys(r)) {
    if (typeof r[k] === 'string') {
      const t = (r[k] as string).trim();
      r[k] = t === '' ? undefined : t;
    }
  }
  return r as T;
}

export function validarProjeto(d: DadosProjeto): string | null {
  if (!d.nome?.trim()) return 'Informe o nome do projeto.';
  if (d.dataInicio && d.prazoFinal && d.prazoFinal < d.dataInicio) {
    return 'O prazo final não pode ser anterior à data de início.';
  }
  return null;
}

export async function criarProjeto(dados: DadosProjeto): Promise<Projeto> {
  const erro = validarProjeto(dados);
  if (erro) throw new Error(erro);
  const t = agora();
  const projeto: Projeto = { ...limparOpcionais(dados), id: novoId(), criadoEm: t, atualizadoEm: t };
  await db.transaction('rw', db.projetos, db.config, async () => {
    await db.projetos.add(projeto);
    await db.config.put({ chave: CHAVE_ATIVO, valor: projeto.id });
  });
  return projeto;
}

export async function atualizarProjeto(id: string, dados: DadosProjeto): Promise<void> {
  const erro = validarProjeto(dados);
  if (erro) throw new Error(erro);
  await db.projetos.update(id, { ...limparOpcionais(dados), atualizadoEm: agora() });
}

/** Exclui o projeto e TUDO o que pertence a ele. */
export async function excluirProjeto(id: string): Promise<void> {
  const tabelas = TABELAS_DO_PROJETO.map((t) => db.table(t));
  await db.transaction('rw', [db.projetos, db.config, ...tabelas], async () => {
    for (const t of tabelas) await t.where('projetoId').equals(id).delete();
    await db.projetos.delete(id);
    const ativo = await db.config.get(CHAVE_ATIVO);
    if (ativo?.valor === id) {
      const outro = await db.projetos.orderBy('atualizadoEm').last();
      await db.config.put({ chave: CHAVE_ATIVO, valor: outro?.id ?? null });
    }
  });
}

export async function definirProjetoAtivo(id: string): Promise<void> {
  await db.config.put({ chave: CHAVE_ATIVO, valor: id });
}

/** Projeto ativo; se o salvo não existir mais, usa o mais recente. */
export async function obterProjetoAtivo(): Promise<Projeto | null> {
  const cfg = await db.config.get(CHAVE_ATIVO);
  if (typeof cfg?.valor === 'string') {
    const p = await db.projetos.get(cfg.valor);
    if (p) return p;
  }
  return (await db.projetos.orderBy('atualizadoEm').last()) ?? null;
}
