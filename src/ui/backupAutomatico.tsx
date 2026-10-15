// Liga o backup automático ao app: observa as alterações e grava no arquivo escolhido
// (com uma pequena espera, para juntar várias alterações seguidas numa gravação só).

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Dexie from 'dexie';
import {
  ativar, backupAutomaticoSuportado, desativar, escolherArquivo, gravar, lerBackupExistente, mudouDados,
  obterArquivo, obterUltimoAutomatico, pedirPermissao, permissao, type ArquivoDeBackup,
} from '../data/backupAutomatico.ts';
import { lerArquivoDeBackup, restaurarBackup, type ResumoBackup } from '../data/backup.ts';

export const ESPERA_MS = 2000;

type Situacao = 'carregando' | 'nao_suportado' | 'inativo' | 'ativo' | 'precisa_reautorizar' | 'erro';

interface EstadoBackupAuto {
  situacao: Situacao;
  nomeArquivo: string | null;
  ultimo: string | null;
  erro: string | null;
  /** Arquivo escolhido que já tinha um backup: a pessoa decide entre restaurar ou substituir. */
  conflito: { resumo: ResumoBackup } | null;
  escolher: () => Promise<void>;
  resolverConflito: (decisao: 'restaurar' | 'substituir' | 'cancelar') => Promise<void>;
  reativar: () => Promise<void>;
  salvarAgora: () => Promise<void>;
  desativar: () => Promise<void>;
}

const Contexto = createContext<EstadoBackupAuto | null>(null);
export const useBackupAutomatico = () => useContext(Contexto)!;

export function ProvedorBackupAutomatico({ children }: { children: ReactNode }) {
  const [situacao, setSituacao] = useState<Situacao>('carregando');
  const [arquivo, setArquivo] = useState<ArquivoDeBackup | null>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<{ resumo: ResumoBackup; texto: string; arquivo: ArquivoDeBackup } | null>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executarGravacao = useCallback(async (a: ArquivoDeBackup, forcar = false) => {
    try {
      if (forcar) await ativar(a);
      else await gravar(a);
      setUltimo(await obterUltimoAutomatico());
      setErro(null);
      setSituacao('ativo');
    } catch (e) {
      const nome = (e as DOMException)?.name;
      if (nome === 'NotAllowedError' || nome === 'SecurityError') setSituacao('precisa_reautorizar');
      else {
        setErro(nome === 'NotFoundError' ? 'O arquivo de backup não foi encontrado (foi movido ou apagado?). Escolha o arquivo de novo.' : `Não foi possível gravar o backup: ${(e as Error).message}`);
        setSituacao('erro');
      }
    }
  }, []);

  // Situação inicial
  useEffect(() => {
    void (async () => {
      if (!backupAutomaticoSuportado()) return setSituacao('nao_suportado');
      const a = await obterArquivo();
      setUltimo(await obterUltimoAutomatico());
      if (!a) return setSituacao('inativo');
      setArquivo(a);
      setSituacao((await permissao(a)) === 'granted' ? 'ativo' : 'precisa_reautorizar');
    })();
  }, []);

  // Grava a cada alteração dos dados (com espera)
  useEffect(() => {
    if (situacao !== 'ativo' || !arquivo) return;
    const aoMudar = (partes: Record<string, unknown>) => {
      if (!mudouDados(partes)) return;
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => void executarGravacao(arquivo), ESPERA_MS);
    };
    // Evento global do Dexie: avisa qualquer gravação no banco (inclusive feita em outra aba).
    Dexie.on('storagemutated', aoMudar);
    return () => {
      Dexie.on.storagemutated.unsubscribe(aoMudar);
      if (espera.current) clearTimeout(espera.current);
    };
  }, [situacao, arquivo, executarGravacao]);

  const valor: EstadoBackupAuto = {
    situacao,
    nomeArquivo: arquivo?.name ?? null,
    ultimo,
    erro,
    conflito: conflito ? { resumo: conflito.resumo } : null,
    escolher: async () => {
      setErro(null);
      try {
        const a = await escolherArquivo();
        if (!a) return;
        const existente = await lerBackupExistente(a);
        if (existente) return setConflito({ ...existente, arquivo: a });
        setArquivo(a);
        await executarGravacao(a, true);
      } catch (e) {
        setErro((e as Error).message);
      }
    },
    resolverConflito: async (decisao) => {
      const c = conflito;
      setConflito(null);
      if (!c || decisao === 'cancelar') return;
      if (decisao === 'restaurar') await restaurarBackup(lerArquivoDeBackup(c.texto).arquivo);
      setArquivo(c.arquivo);
      await executarGravacao(c.arquivo, true);
    },
    reativar: async () => {
      if (!arquivo) return;
      if (await pedirPermissao(arquivo)) await executarGravacao(arquivo);
      else setSituacao('precisa_reautorizar');
    },
    salvarAgora: async () => {
      if (arquivo) await executarGravacao(arquivo, true);
    },
    desativar: async () => {
      await desativar();
      setArquivo(null);
      setUltimo(null);
      setErro(null);
      setSituacao('inativo');
    },
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
