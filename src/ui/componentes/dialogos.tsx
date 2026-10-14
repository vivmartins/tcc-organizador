// Modal, confirmação e avisos rápidos (toasts).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Botao, cx } from './base.tsx';

export function Modal({ aberto, aoFechar, titulo, children, rodape, largura = 'max-w-lg' }: { aberto: boolean; aoFechar: () => void; titulo: string; children: ReactNode; rodape?: ReactNode; largura?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal?.();
    if (!aberto && d.open) d.close?.();
  }, [aberto]);
  if (!aberto) return null;
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
      onClick={(e) => e.target === ref.current && aoFechar()}
      aria-labelledby="titulo-modal"
      className={cx('m-auto w-[calc(100%-2rem)] rounded-lg border border-borda bg-superficie p-0 text-marinho-900 shadow-xl backdrop:bg-marinho-900/30', largura)}
    >
      <div className="flex items-center justify-between border-b border-borda px-5 py-3.5">
        <h2 id="titulo-modal" className="text-base font-semibold">
          {titulo}
        </h2>
        <button onClick={aoFechar} className="rounded p-1 text-cinza-500 hover:bg-cinza-100 hover:text-marinho-900" aria-label="Fechar">
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm leading-relaxed">{children}</div>
      {rodape && <div className="flex justify-end gap-2 border-t border-borda px-5 py-3">{rodape}</div>}
    </dialog>
  );
}

export function Confirmacao({ aberto, titulo, children, textoConfirmar = 'Confirmar', perigoso, aoConfirmar, aoCancelar }: { aberto: boolean; titulo: string; children: ReactNode; textoConfirmar?: string; perigoso?: boolean; aoConfirmar: () => void; aoCancelar: () => void }) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoCancelar}
      titulo={titulo}
      largura="max-w-md"
      rodape={
        <>
          <Botao onClick={aoCancelar}>Cancelar</Botao>
          <Botao variante={perigoso ? 'perigo' : 'primario'} onClick={aoConfirmar} className={perigoso ? '!bg-perigo-700 !text-white hover:!bg-perigo-700/90 border-0' : ''}>
            {textoConfirmar}
          </Botao>
        </>
      }
    >
      {children}
    </Modal>
  );
}

// ---------------------------------------------------------------------
// Avisos rápidos
// ---------------------------------------------------------------------
type Aviso = { id: number; tipo: 'sucesso' | 'erro'; texto: string };
const ContextoAvisos = createContext<(tipo: Aviso['tipo'], texto: string) => void>(() => {});

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((tipo: Aviso['tipo'], texto: string) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, tipo, texto }].slice(-3));
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'erro' ? 6000 : 3000);
  }, []);
  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0">
        {avisos.map((a) => (
          <div key={a.id} role={a.tipo === 'erro' ? 'alert' : 'status'} className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-borda bg-superficie px-3.5 py-3 text-sm shadow-lg">
            {a.tipo === 'sucesso' ? <CheckCircle2 size={18} className="mt-px shrink-0 text-sucesso-700" /> : <AlertTriangle size={18} className="mt-px shrink-0 text-perigo-700" />}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}

export const useAvisos = () => useContext(ContextoAvisos);
