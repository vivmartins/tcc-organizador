import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { haVersaoNova } from '../../integrations/versao.ts';

const INTERVALO_MS = 10 * 60_000;

/** Aparece quando uma versão nova da plataforma foi publicada com esta página aberta. */
export function AvisoVersaoNova() {
  const [nova, setNova] = useState(false);
  useEffect(() => {
    if (nova) return;
    let ativo = true;
    const verificar = () => { if (document.visibilityState === 'visible') void haVersaoNova().then((v) => { if (ativo && v) setNova(true); }); };
    const t = setInterval(verificar, INTERVALO_MS);
    document.addEventListener('visibilitychange', verificar);
    window.addEventListener('focus', verificar);
    return () => { ativo = false; clearInterval(t); document.removeEventListener('visibilitychange', verificar); window.removeEventListener('focus', verificar); };
  }, [nova]);
  if (!nova) return null;
  return (
    <div role="status" className="mb-5 flex flex-col gap-3 rounded-lg border border-acao-600/25 bg-acao-50 px-4 py-3 text-sm text-marinho-700 sm:flex-row sm:items-center">
      <span className="flex-1">Há uma versão nova da plataforma. Recarregue a página para usá-la; seus dados continuam salvos. Se estiver no meio de um cadastro, salve antes.</span>
      <button onClick={() => location.reload()} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-acao-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-acao-700">
        <RefreshCw size={14} /> Recarregar
      </button>
    </div>
  );
}
