// Backup automático: o app grava uma cópia de todos os dados num arquivo do computador
// (por exemplo, dentro da pasta do Google Drive para computador), a cada alteração.
//
// Usa a "File System Access API", disponível no Chrome e no Edge para computador.
// O arquivo fica no computador da pessoa; nada passa por servidores do app.

import { db, agora } from './db.ts';
import { gerarBackup, lerArquivoDeBackup, registrarBackupFeito, type ResumoBackup } from './backup.ts';

// Tipos que ainda não estão no TypeScript padrão
type Permissao = 'granted' | 'denied' | 'prompt';
export interface ArquivoDeBackup {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(dados: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<Permissao>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<Permissao>;
}
type Seletor = (o: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<ArquivoDeBackup>;

const CHAVE_ARQUIVO = 'backupAutoArquivo';
const CHAVE_ULTIMO = 'backupAutoUltimo';
export const NOME_SUGERIDO = 'backup-organizador-tcc.json';
export const TABELAS_OBSERVADAS = ['projetos', 'fontes', 'tags', 'fichamentos', 'etapas', 'tarefas', 'orientacoes', 'checklist', 'textos'];

const seletor = () => (globalThis as unknown as { showSaveFilePicker?: Seletor }).showSaveFilePicker;
export const backupAutomaticoSuportado = () => typeof seletor() === 'function';

// O "endereço" do arquivo também fica em memória, caso o navegador não consiga guardá-lo no banco.
let emMemoria: ArquivoDeBackup | null = null;

export async function obterArquivo(): Promise<ArquivoDeBackup | null> {
  if (emMemoria) return emMemoria;
  const c = await db.config.get(CHAVE_ARQUIVO);
  emMemoria = (c?.valor as ArquivoDeBackup | undefined) ?? null;
  return emMemoria;
}

async function guardarArquivo(a: ArquivoDeBackup | null): Promise<void> {
  emMemoria = a;
  try {
    if (a) await db.config.put({ chave: CHAVE_ARQUIVO, valor: a });
    else await db.config.delete(CHAVE_ARQUIVO);
  } catch {
    /* alguns navegadores não deixam guardar o endereço: funciona só até fechar a aba */
  }
}

export async function obterUltimoAutomatico(): Promise<string | null> {
  const c = await db.config.get(CHAVE_ULTIMO);
  return typeof c?.valor === 'string' ? c.valor : null;
}

export async function permissao(a: ArquivoDeBackup): Promise<Permissao> {
  try {
    return (await a.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
  } catch {
    return 'prompt';
  }
}

/** Precisa ser chamada a partir de um clique (o navegador pergunta à pessoa). */
export async function pedirPermissao(a: ArquivoDeBackup): Promise<boolean> {
  try {
    return ((await a.requestPermission?.({ mode: 'readwrite' })) ?? 'granted') === 'granted';
  } catch {
    return false;
  }
}

/** Abre a janela para escolher onde salvar. Devolve null se a pessoa cancelar. */
export async function escolherArquivo(): Promise<ArquivoDeBackup | null> {
  const s = seletor();
  if (!s) throw new Error('Este navegador não permite backup automático. Use o Chrome ou o Edge no computador.');
  try {
    return await s({ suggestedName: NOME_SUGERIDO, types: [{ description: 'Backup do Organizador de TCC', accept: { 'application/json': ['.json'] } }] });
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return null;
    throw e;
  }
}

/** Se o arquivo escolhido já contém um backup, devolve o resumo dele (para a pessoa decidir). */
export async function lerBackupExistente(a: ArquivoDeBackup): Promise<{ resumo: ResumoBackup; texto: string } | null> {
  try {
    const texto = await (await a.getFile()).text();
    if (!texto.trim()) return null;
    const { resumo } = lerArquivoDeBackup(texto);
    const total = Object.values(resumo.contagens).reduce((s, n) => s + n, 0);
    return total > 0 ? { resumo, texto } : null;
  } catch {
    return null;
  }
}

export async function ativar(a: ArquivoDeBackup): Promise<void> {
  await guardarArquivo(a);
  await gravar(a, { forcar: true });
}

export async function desativar(): Promise<void> {
  await guardarArquivo(null);
  await db.config.delete(CHAVE_ULTIMO);
}

/**
 * Grava o backup no arquivo. Por segurança, não grava um banco vazio (sem projetos) por cima
 * de um arquivo, a não ser quando a pessoa acabou de escolher o arquivo (forcar).
 */
export async function gravar(a: ArquivoDeBackup, { forcar = false } = {}): Promise<'gravado' | 'vazio'> {
  if (!forcar && (await db.projetos.count()) === 0) return 'vazio';
  const conteudo = JSON.stringify(await gerarBackup(), null, 2);
  const w = await a.createWritable();
  await w.write(conteudo);
  await w.close();
  await db.config.put({ chave: CHAVE_ULTIMO, valor: agora() });
  await registrarBackupFeito();
  return 'gravado';
}

/** true se a alteração envolveu dados de verdade (e não só configurações do app). */
export function mudouDados(partes: Record<string, unknown>): boolean {
  return Object.keys(partes).some((p) => TABELAS_OBSERVADAS.some((t) => p.startsWith(`idb://${db.name}/${t}/`)));
}
