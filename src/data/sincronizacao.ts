// Sincronização entre aparelhos (pelo Google Drive da própria pessoa).
//
// Como funciona:
//  * Toda gravação no banco ganha a marca "alteradoEm" (ver os ganchos abaixo).
//  * Toda exclusão deixa um registro em "excluidos" (para o outro aparelho também excluir).
//  * Ao sincronizar, juntamos o que está aqui com o arquivo do Drive, registro a registro:
//    vale a versão alterada por último; uma exclusão mais nova que a última alteração apaga.
//  * O projeto de exemplo nunca é sincronizado (ele é só para conhecer a plataforma).

import { db, agora } from './db.ts';

export const TABELAS_SINCRONIZADAS = ['projetos', 'fontes', 'tags', 'fichamentos', 'etapas', 'tarefas', 'orientacoes', 'checklist', 'textos'] as const;
export type TabelaSincronizada = (typeof TABELAS_SINCRONIZADAS)[number];

export const FORMATO_SINCRONIZACAO = 'tcc-organizador-sincronizacao';
export const VERSAO_SINCRONIZACAO = 1;
/** Exclusões mais antigas que isso são esquecidas (os aparelhos já tiveram tempo de sincronizar). */
export const DIAS_PARA_ESQUECER_EXCLUSAO = 180;

type Registro = Record<string, unknown> & { id: string };
export type Exclusoes = Partial<Record<TabelaSincronizada, Record<string, string>>>;

export interface ArquivoSincronizacao {
  formato: typeof FORMATO_SINCRONIZACAO;
  versao: number;
  atualizadoEm: string;
  dados: Record<TabelaSincronizada, Registro[]>;
  excluidos: Exclusoes;
}

export interface Retrato {
  dados: Record<TabelaSincronizada, Registro[]>;
  excluidos: Exclusoes;
}

/** Momento da última alteração de um registro (registros antigos não têm "alteradoEm"). */
export const momento = (r: Record<string, unknown>) => String(r.alteradoEm ?? r.atualizadoEm ?? r.criadoEm ?? '');

// ---------------------------------------------------------------------
// Junção (função pura, testada à parte)
// ---------------------------------------------------------------------

export interface ResultadoJuncao {
  retrato: Retrato;
  /** Quantos registros mudaram NESTE aparelho (vindos do outro). */
  recebidos: number;
  /** Quantos registros deste aparelho o outro ainda não tinha. */
  enviados: number;
}

export function juntar(local: Retrato, remoto: Retrato, hoje = new Date()): ResultadoJuncao {
  const limite = new Date(hoje.getTime() - DIAS_PARA_ESQUECER_EXCLUSAO * 86_400_000).toISOString();
  const dados = {} as Retrato['dados'];
  const excluidos: Exclusoes = {};
  let recebidos = 0;
  let enviados = 0;
  for (const t of TABELAS_SINCRONIZADAS) {
    const l = new Map((local.dados[t] ?? []).map((r) => [r.id, r]));
    const r = new Map((remoto.dados[t] ?? []).map((x) => [x.id, x]));
    const exL = local.excluidos[t] ?? {};
    const exR = remoto.excluidos[t] ?? {};
    const ex: Record<string, string> = {};
    for (const [id, em] of [...Object.entries(exL), ...Object.entries(exR)]) if (em >= limite && (!ex[id] || em > ex[id])) ex[id] = em;
    const lista: Registro[] = [];
    for (const id of new Set([...l.keys(), ...r.keys()])) {
      const a = l.get(id);
      const b = r.get(id);
      const melhor = !a ? b! : !b ? a : momento(b) > momento(a) ? b : a;
      const excluidoEm = ex[id];
      if (excluidoEm && excluidoEm >= momento(melhor)) {
        if (a) recebidos++; // estava aqui e foi excluído no outro aparelho
        else if (b) enviados++; // exclusão daqui vai para o Drive
        continue;
      }
      if (excluidoEm) delete ex[id]; // alterado depois de excluído: volta a existir
      lista.push(melhor);
      if (melhor !== a && (!a || JSON.stringify(a) !== JSON.stringify(melhor))) recebidos++;
      if (melhor !== b && (!b || JSON.stringify(b) !== JSON.stringify(melhor))) enviados++;
    }
    dados[t] = lista;
    if (Object.keys(ex).length) excluidos[t] = ex;
  }
  return { retrato: { dados, excluidos }, recebidos, enviados };
}

// ---------------------------------------------------------------------
// Marcas de alteração e de exclusão (ganchos do banco)
// ---------------------------------------------------------------------

let aplicandoSincronizacao = false;
const CHAVE_EXCLUIDOS = 'sincronizacao.excluidos';
const CHAVE_SUBSTITUIR = 'sincronizacao.substituirNoDrive';

let exclusoesPendentes: Exclusoes = {};
let gravarExclusoes: ReturnType<typeof setTimeout> | null = null;

async function salvarExclusoesPendentes() {
  const novas = exclusoesPendentes;
  exclusoesPendentes = {};
  if (!Object.keys(novas).length) return;
  const atual = ((await db.config.get(CHAVE_EXCLUIDOS))?.valor ?? {}) as Exclusoes;
  for (const [t, ids] of Object.entries(novas) as [TabelaSincronizada, Record<string, string>][]) atual[t] = { ...(atual[t] ?? {}), ...ids };
  await db.config.put({ chave: CHAVE_EXCLUIDOS, valor: atual });
}

/** Garante que exclusões recém-feitas já foram anotadas (chamar antes de sincronizar). */
export async function concluirAnotacoes(): Promise<void> {
  if (gravarExclusoes) clearTimeout(gravarExclusoes);
  gravarExclusoes = null;
  await salvarExclusoesPendentes();
}

let ganchosInstalados = false;
/** Liga as marcas de alteração/exclusão. Chamado uma vez ao abrir a plataforma. */
export function instalarGanchos(): void {
  if (ganchosInstalados) return;
  ganchosInstalados = true;
  for (const t of TABELAS_SINCRONIZADAS) {
    const tabela = db.table(t);
    tabela.hook('creating', (_pk, obj: Record<string, unknown>) => {
      if (!aplicandoSincronizacao) obj.alteradoEm = agora();
    });
    tabela.hook('updating', () => (aplicandoSincronizacao ? undefined : { alteradoEm: agora() }));
    tabela.hook('deleting', (pk) => {
      if (aplicandoSincronizacao) return;
      (exclusoesPendentes[t] ??= {})[String(pk)] = agora();
      if (gravarExclusoes) clearTimeout(gravarExclusoes);
      // fora da transação atual (a tabela "config" pode não fazer parte dela)
      gravarExclusoes = setTimeout(() => void salvarExclusoesPendentes(), 0);
    });
  }
}

// ---------------------------------------------------------------------
// Ler e gravar o retrato local
// ---------------------------------------------------------------------

async function idsDeExemplo(): Promise<Set<string>> {
  return new Set((await db.projetos.toArray()).filter((p) => p.exemplo).map((p) => p.id));
}

const doExemplo = (t: TabelaSincronizada, r: Registro, exemplo: Set<string>) => (t === 'projetos' ? exemplo.has(r.id) : exemplo.has(String(r.projetoId)));

export async function retratoLocal(): Promise<Retrato> {
  await concluirAnotacoes();
  const exemplo = await idsDeExemplo();
  const dados = {} as Retrato['dados'];
  await db.transaction('r', TABELAS_SINCRONIZADAS.map((t) => db.table(t)), async () => {
    for (const t of TABELAS_SINCRONIZADAS) dados[t] = ((await db.table(t).toArray()) as Registro[]).filter((r) => !doExemplo(t, r, exemplo));
  });
  const excluidos = ((await db.config.get(CHAVE_EXCLUIDOS))?.valor ?? {}) as Exclusoes;
  return { dados, excluidos };
}

/** Grava o resultado da junção neste aparelho (sem mexer no projeto de exemplo). */
export async function aplicarRetrato(r: Retrato): Promise<void> {
  const exemplo = await idsDeExemplo();
  aplicandoSincronizacao = true;
  try {
    await db.transaction('rw', [...TABELAS_SINCRONIZADAS.map((t) => db.table(t)), db.config], async () => {
      for (const t of TABELAS_SINCRONIZADAS) {
        const tabela = db.table(t);
        const atuais = ((await tabela.toArray()) as Registro[]).filter((x) => !doExemplo(t, x, exemplo));
        const novos = new Map(r.dados[t].map((x) => [x.id, x]));
        const sair = atuais.filter((x) => !novos.has(x.id)).map((x) => x.id);
        if (sair.length) await tabela.bulkDelete(sair);
        const mudou = r.dados[t].filter((x) => {
          const atual = atuais.find((a) => a.id === x.id);
          return !atual || JSON.stringify(atual) !== JSON.stringify(x);
        });
        if (mudou.length) await tabela.bulkPut(mudou);
      }
      await db.config.put({ chave: CHAVE_EXCLUIDOS, valor: r.excluidos });
      // projeto ativo: se sumiu, abre o primeiro que existir
      const ativo = (await db.config.get('projetoAtivoId'))?.valor as string | null | undefined;
      if (!ativo || !(await db.projetos.get(ativo))) {
        const primeiro = (await db.projetos.orderBy('atualizadoEm').reverse().toArray()).find((p) => !p.exemplo) ?? (await db.projetos.toCollection().first());
        await db.config.put({ chave: 'projetoAtivoId', valor: primeiro?.id ?? null });
      }
    });
  } finally {
    aplicandoSincronizacao = false;
  }
}

/** Depois de restaurar um backup: na próxima sincronização, o Drive passa a ser igual a este aparelho. */
export async function marcarSubstituirNoDrive(): Promise<void> {
  await db.config.put({ chave: CHAVE_SUBSTITUIR, valor: true });
}
export async function precisaSubstituirNoDrive(): Promise<boolean> {
  return (await db.config.get(CHAVE_SUBSTITUIR))?.valor === true;
}
export async function limparSubstituirNoDrive(): Promise<void> {
  await db.config.delete(CHAVE_SUBSTITUIR);
}

export function paraArquivo(r: Retrato): ArquivoSincronizacao {
  return { formato: FORMATO_SINCRONIZACAO, versao: VERSAO_SINCRONIZACAO, atualizadoEm: agora(), dados: r.dados, excluidos: r.excluidos };
}

export function lerArquivoSincronizacao(texto: string): Retrato {
  const a = JSON.parse(texto) as Partial<ArquivoSincronizacao>;
  if (a?.formato !== FORMATO_SINCRONIZACAO || typeof a.dados !== 'object' || !a.dados) throw new Error('O arquivo de sincronização no Drive não é válido.');
  if (typeof a.versao !== 'number' || a.versao > VERSAO_SINCRONIZACAO) throw new Error('O Drive tem dados de uma versão mais nova da plataforma. Recarregue a página (F5) e tente de novo.');
  const dados = {} as Retrato['dados'];
  for (const t of TABELAS_SINCRONIZADAS) {
    const l = (a.dados as Record<string, unknown>)[t] ?? [];
    if (!Array.isArray(l) || l.some((r) => typeof r !== 'object' || !r || typeof (r as Registro).id !== 'string')) throw new Error('O arquivo de sincronização no Drive está danificado.');
    dados[t] = l as Registro[];
  }
  return { dados, excluidos: (a.excluidos ?? {}) as Exclusoes };
}

/** true se a alteração do banco envolveu dados sincronizados (não só configurações). */
export function mudouDadosSincronizados(partes: Record<string, unknown>): boolean {
  return Object.keys(partes).some((p) => TABELAS_SINCRONIZADAS.some((t) => p.startsWith(`idb://${db.name}/${t}/`)));
}

