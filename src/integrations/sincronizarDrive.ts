// Uma rodada de sincronização: baixa o arquivo do Drive, junta com este aparelho e envia o resultado.

import { agora, db } from '../data/db.ts';
import {
  aplicarRetrato, juntar, lerArquivoSincronizacao, limparSubstituirNoDrive, paraArquivo, precisaSubstituirNoDrive, retratoLocal,
  TABELAS_SINCRONIZADAS, type Exclusoes, type Retrato,
} from '../data/sincronizacao.ts';
import { baixarArquivo, enviarArquivo, procurarArquivo } from './googleDrive.ts';

export interface ResultadoSincronizacao { recebidos: number; enviados: number; em: string; primeiraVez: boolean }

const CHAVE_ULTIMA = 'sincronizacao.ultima';
const CHAVE_CONTA = 'sincronizacao.conta';

export interface ContaConectada { email: string | null; conectadoEm: string }

export async function contaConectada(): Promise<ContaConectada | null> {
  return ((await db.config.get(CHAVE_CONTA))?.valor ?? null) as ContaConectada | null;
}
export async function guardarConta(email: string | null): Promise<void> {
  await db.config.put({ chave: CHAVE_CONTA, valor: { email, conectadoEm: agora() } satisfies ContaConectada });
}
export async function esquecerConta(): Promise<void> {
  await db.config.bulkDelete([CHAVE_CONTA, CHAVE_ULTIMA]);
}
export async function ultimaSincronizacao(): Promise<string | null> {
  return ((await db.config.get(CHAVE_ULTIMA))?.valor ?? null) as string | null;
}

const vazio = (): Retrato => ({ dados: Object.fromEntries(TABELAS_SINCRONIZADAS.map((t) => [t, []])) as unknown as Retrato['dados'], excluidos: {} });

/** O Drive passa a ser igual a este aparelho: o que só existe lá é marcado como excluído. */
function substituir(local: Retrato, remoto: Retrato): Retrato {
  const excluidos: Exclusoes = structuredClone(local.excluidos);
  const em = agora();
  for (const t of TABELAS_SINCRONIZADAS) {
    const aqui = new Set(local.dados[t].map((r) => r.id));
    for (const r of remoto.dados[t]) if (!aqui.has(r.id)) (excluidos[t] ??= {})[r.id] = em;
  }
  return { dados: local.dados, excluidos };
}

let emAndamento: Promise<ResultadoSincronizacao> | null = null;

export function sincronizar(buscar: typeof fetch = fetch): Promise<ResultadoSincronizacao> {
  emAndamento ??= (async () => {
    try {
      const local = await retratoLocal();
      const arquivo = await procurarArquivo(buscar);
      const remoto = arquivo ? lerArquivoSincronizacao(await baixarArquivo(arquivo.id, buscar)) : vazio();
      const forcar = await precisaSubstituirNoDrive();
      let recebidos = 0;
      let enviados = 0;
      let final: Retrato;
      if (forcar) {
        final = substituir(local, remoto);
        enviados = 1;
      } else {
        const j = juntar(local, remoto);
        final = j.retrato;
        recebidos = j.recebidos;
        enviados = j.enviados;
      }
      if (recebidos) await aplicarRetrato(final);
      if (enviados || !arquivo) await enviarArquivo(JSON.stringify(paraArquivo(final)), arquivo?.id ?? null, buscar);
      if (forcar) await limparSubstituirNoDrive();
      const em = agora();
      await db.config.put({ chave: CHAVE_ULTIMA, valor: em });
      return { recebidos, enviados, em, primeiraVez: !arquivo };
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}
