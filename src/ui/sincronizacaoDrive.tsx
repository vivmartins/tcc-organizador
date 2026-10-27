// Liga a sincronização com o Google Drive ao app: sincroniza ao abrir, depois de cada
// alteração (com uma pequena espera), ao voltar para a aba e a cada poucos minutos.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Dexie from 'dexie';
import { driveConfigurado, emailDaConta, entrar, ErroDrive, sair, tokenValido } from '../integrations/googleDrive.ts';
import { contaConectada, esquecerConta, guardarConta, sincronizar, ultimaSincronizacao, type ResultadoSincronizacao } from '../integrations/sincronizarDrive.ts';
import { mudouDadosSincronizados } from '../data/sincronizacao.ts';

export const ESPERA_SINCRONIZACAO_MS = 4000;
const INTERVALO_MS = 3 * 60_000;

export type SituacaoDrive = 'carregando' | 'nao_configurado' | 'desligado' | 'sincronizando' | 'em_dia' | 'precisa_entrar' | 'erro';

interface EstadoDrive {
  situacao: SituacaoDrive;
  email: string | null;
  ultima: string | null;
  erro: string | null;
  ultimoResultado: ResultadoSincronizacao | null;
  /** Ações que abrem a janela do Google: chamar dentro de um clique. */
  conectar: () => Promise<void>;
  entrarDeNovo: () => Promise<void>;
  sincronizarAgora: () => Promise<void>;
  desconectar: () => Promise<void>;
}

const Contexto = createContext<EstadoDrive | null>(null);
export const useSincronizacaoDrive = () => useContext(Contexto)!;

export function ProvedorSincronizacaoDrive({ children }: { children: ReactNode }) {
  const [situacao, setSituacao] = useState<SituacaoDrive>('carregando');
  const [email, setEmail] = useState<string | null>(null);
  const [ultima, setUltima] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoSincronizacao | null>(null);
  const conectado = useRef(false);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rodar = useCallback(async () => {
    if (!conectado.current) return;
    if (!tokenValido()) return setSituacao('precisa_entrar');
    setSituacao('sincronizando');
    try {
      const r = await sincronizar();
      setUltimoResultado(r);
      setUltima(r.em);
      setErro(null);
      setSituacao('em_dia');
    } catch (e) {
      if (e instanceof ErroDrive && e.precisaEntrar) return setSituacao('precisa_entrar');
      setErro((e as Error).message);
      setSituacao('erro');
    }
  }, []);

  // Situação inicial
  useEffect(() => {
    void (async () => {
      if (!driveConfigurado()) return setSituacao('nao_configurado');
      const conta = await contaConectada();
      setUltima(await ultimaSincronizacao());
      if (!conta) return setSituacao('desligado');
      conectado.current = true;
      setEmail(conta.email);
      if (tokenValido()) await rodar();
      else setSituacao('precisa_entrar');
    })();
  }, [rodar]);

  // Depois de alterações, ao voltar para a aba e de tempos em tempos
  useEffect(() => {
    const aoMudar = (partes: Record<string, unknown>) => {
      if (!conectado.current || !mudouDadosSincronizados(partes)) return;
      if (espera.current) clearTimeout(espera.current);
      espera.current = setTimeout(() => void rodar(), ESPERA_SINCRONIZACAO_MS);
    };
    const aoVoltar = () => { if (document.visibilityState === 'visible' && conectado.current && tokenValido()) void rodar(); };
    Dexie.on('storagemutated', aoMudar);
    document.addEventListener('visibilitychange', aoVoltar);
    const t = setInterval(aoVoltar, INTERVALO_MS);
    return () => {
      Dexie.on.storagemutated.unsubscribe(aoMudar);
      document.removeEventListener('visibilitychange', aoVoltar);
      clearInterval(t);
      if (espera.current) clearTimeout(espera.current);
    };
  }, [rodar]);

  const comLogin = async (primeiraVez: boolean) => {
    setErro(null);
    try {
      await entrar({ primeiraVez, email });
      if (primeiraVez || !email) {
        const e = await emailDaConta();
        await guardarConta(e);
        setEmail(e);
      }
      conectado.current = true;
      await rodar();
    } catch (e) {
      setErro((e as Error).message);
      if (!conectado.current) setSituacao('desligado');
      else setSituacao('precisa_entrar');
    }
  };

  const valor: EstadoDrive = {
    situacao, email, ultima, erro, ultimoResultado,
    conectar: () => comLogin(true),
    entrarDeNovo: () => comLogin(false),
    sincronizarAgora: async () => { if (tokenValido()) await rodar(); else await comLogin(false); },
    desconectar: async () => {
      sair();
      await esquecerConta();
      conectado.current = false;
      setEmail(null);
      setUltima(null);
      setErro(null);
      setSituacao('desligado');
    },
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
