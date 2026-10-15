// Backup: exporta TODOS os dados para um arquivo e os recupera depois.
//
// O arquivo é JSON (texto legível), então mesmo sem o app dá para abrir
// e ver as informações. Os PDFs ficarão fora deste arquivo (etapa futura).

import { db, agora } from './db.ts';

export const FORMATO_BACKUP = 'tcc-organizador-backup';
export const VERSAO_BACKUP = 1;

const TABELAS = ['projetos', 'fontes', 'tags', 'fichamentos', 'etapas', 'tarefas', 'orientacoes', 'checklist'] as const;
type NomeTabela = (typeof TABELAS)[number];

export interface ArquivoBackup {
  formato: typeof FORMATO_BACKUP;
  versao: number;
  exportadoEm: string;
  dados: Record<NomeTabela, Record<string, unknown>[]>;
}

export interface ResumoBackup {
  exportadoEm: string;
  projetos: string[];
  contagens: Record<NomeTabela, number>;
}

const SINGULAR: Record<NomeTabela, string> = {
  projetos: 'projeto', fontes: 'fonte', tags: 'tag', fichamentos: 'fichamento', etapas: 'etapa',
  tarefas: 'tarefa', orientacoes: 'orientação', checklist: 'item de checklist',
};

/** "1 projeto", "2 projetos"… */
export function rotuloContagem(t: NomeTabela, n: number): string {
  return n === 1 ? SINGULAR[t] : ROTULO_TABELA[t];
}

export const ROTULO_TABELA: Record<NomeTabela, string> = {
  projetos: 'projetos',
  fontes: 'fontes',
  tags: 'tags',
  fichamentos: 'fichamentos',
  etapas: 'etapas',
  tarefas: 'tarefas',
  orientacoes: 'orientações',
  checklist: 'itens de checklist',
};

export async function gerarBackup(): Promise<ArquivoBackup> {
  const dados = {} as ArquivoBackup['dados'];
  await db.transaction('r', TABELAS.map((t) => db.table(t)), async () => {
    for (const t of TABELAS) dados[t] = await db.table(t).toArray();
  });
  return { formato: FORMATO_BACKUP, versao: VERSAO_BACKUP, exportadoEm: agora(), dados };
}

export function nomeDoArquivoDeBackup(data = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `backup-tcc-${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}.json`;
}

export async function registrarBackupFeito(): Promise<void> {
  await db.config.put({ chave: 'ultimoBackupEm', valor: agora() });
}

export async function obterUltimoBackup(): Promise<string | null> {
  const c = await db.config.get('ultimoBackupEm');
  return typeof c?.valor === 'string' ? c.valor : null;
}

/** Lê e confere o arquivo. Lança erro com mensagem amigável se não for um backup válido. */
export function lerArquivoDeBackup(texto: string): { arquivo: ArquivoBackup; resumo: ResumoBackup } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error('Este arquivo não é um backup do Organizador de TCC (formato inválido).');
  }
  const a = bruto as Partial<ArquivoBackup>;
  if (a?.formato !== FORMATO_BACKUP || typeof a.dados !== 'object' || a.dados === null) {
    throw new Error('Este arquivo não é um backup do Organizador de TCC.');
  }
  if (typeof a.versao !== 'number' || a.versao > VERSAO_BACKUP) {
    throw new Error('Este backup foi criado por uma versão mais nova do app. Atualize a página e tente novamente.');
  }
  for (const t of TABELAS) {
    const lista = (a.dados as Record<string, unknown>)[t] ?? [];
    if (!Array.isArray(lista) || lista.some((r) => typeof r !== 'object' || r === null || typeof (r as { id?: unknown }).id !== 'string')) {
      throw new Error(`O backup está danificado (parte "${ROTULO_TABELA[t]}").`);
    }
    (a.dados as Record<string, unknown>)[t] = lista;
  }
  const arquivo = a as ArquivoBackup;
  const contagens = Object.fromEntries(TABELAS.map((t) => [t, arquivo.dados[t].length])) as ResumoBackup['contagens'];
  return {
    arquivo,
    resumo: {
      exportadoEm: arquivo.exportadoEm,
      projetos: arquivo.dados.projetos.map((p) => String((p as { nome?: unknown }).nome ?? 'Sem nome')),
      contagens,
    },
  };
}

/** Substitui TODOS os dados atuais pelos do backup. */
export async function restaurarBackup(arquivo: ArquivoBackup): Promise<void> {
  const tabelas = TABELAS.map((t) => db.table(t));
  await db.transaction('rw', [...tabelas, db.config], async () => {
    for (const t of TABELAS) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(arquivo.dados[t]);
    }
    const primeiro = arquivo.dados.projetos[0] as { id?: string } | undefined;
    await db.config.put({ chave: 'projetoAtivoId', valor: primeiro?.id ?? null });
  });
}

/** Pede ao navegador para não apagar os dados automaticamente quando faltar espaço. */
export async function pedirArmazenamentoPersistente(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
