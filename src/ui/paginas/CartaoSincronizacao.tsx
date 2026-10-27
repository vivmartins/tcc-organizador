import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Info } from 'lucide-react';
import { Botao, Cartao, Selo } from '../componentes/base.tsx';
import { useSincronizacaoDrive } from '../sincronizacaoDrive.tsx';
import { dataCurta } from '../util.ts';

export function dataHora(iso: string | null) {
  if (!iso) return 'ainda não';
  const d = new Date(iso);
  return `${dataCurta(iso)} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function CartaoSincronizacao() {
  const s = useSincronizacaoDrive();
  if (s.situacao === 'carregando') return null;
  return (
    <Cartao className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Cloud size={16} className="text-acao-600" /> Usar no computador e no celular</h2>
        {s.situacao === 'em_dia' && <Selo tom="sucesso"><CheckCircle2 size={12} /> Sincronizado</Selo>}
        {s.situacao === 'sincronizando' && <Selo tom="acao"><Loader2 size={12} className="animate-spin" /> Sincronizando</Selo>}
        {(s.situacao === 'precisa_entrar' || s.situacao === 'erro') && <Selo tom="alerta"><AlertTriangle size={12} /> Pausada</Selo>}
      </div>

      {s.situacao === 'nao_configurado' && (
        <p className="mt-1.5 flex gap-2 text-sm leading-relaxed text-cinza-600"><Info size={16} className="mt-0.5 shrink-0" /> A sincronização com o Google Drive ainda não está disponível nesta plataforma. Por enquanto, use o backup abaixo para passar os dados de um aparelho para outro.</p>
      )}

      {s.situacao === 'desligado' && (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-cinza-600">
            Entre com a sua conta Google aqui e no outro aparelho: seus projetos, fontes, fichamentos e tarefas ficam iguais nos dois. Os dados vão para um espaço reservado <strong className="font-medium text-marinho-700">no seu próprio Google Drive</strong>, que só esta plataforma enxerga. Ela não tem acesso aos seus outros arquivos, e nenhum servidor nosso guarda nada.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-cinza-500">Se os dois aparelhos já tiverem dados, eles são juntados (nada é apagado). O projeto de exemplo não é sincronizado.</p>
          <Botao variante="primario" className="mt-4" onClick={s.conectar}><GoogleG /> Entrar com o Google</Botao>
        </>
      )}

      {(s.situacao === 'em_dia' || s.situacao === 'sincronizando' || s.situacao === 'precisa_entrar' || s.situacao === 'erro') && (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-cinza-600">
            Conta: <strong className="font-medium text-marinho-700">{s.email ?? 'Google'}</strong>. As alterações vão para o Drive alguns segundos depois de feitas, e as do outro aparelho chegam quando você abre ou volta para a plataforma.
          </p>
          <p className="mt-1 text-sm">Última sincronização: <strong className="font-medium">{dataHora(s.ultima)}</strong>
            {s.situacao === 'em_dia' && s.ultimoResultado && s.ultimoResultado.recebidos > 0 && <span className="text-cinza-600"> · {s.ultimoResultado.recebidos === 1 ? '1 item recebido' : `${s.ultimoResultado.recebidos} itens recebidos`} do outro aparelho</span>}
          </p>
          {s.situacao === 'precisa_entrar' && (
            <p className="mt-2 text-sm leading-relaxed text-alerta-700">Por segurança, o Google pede para confirmar o acesso a cada sessão (mais ou menos a cada hora). Toque em “Sincronizar agora”: a janelinha do Google abre e fecha sozinha.</p>
          )}
          {s.erro && <p role="alert" className="mt-2 text-sm text-perigo-700">{s.erro}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao variante={s.situacao === 'precisa_entrar' ? 'primario' : 'secundario'} onClick={s.sincronizarAgora} disabled={s.situacao === 'sincronizando'}><RefreshCw size={14} /> Sincronizar agora</Botao>
            <Botao variante="fantasma" onClick={s.desconectar}><CloudOff size={14} /> Desconectar</Botao>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-cinza-500">Desconectar não apaga nada: os dados continuam neste aparelho e no seu Drive.</p>
        </>
      )}
      {s.situacao === 'desligado' && s.erro && <p role="alert" className="mt-2 text-sm text-perigo-700">{s.erro}</p>}
    </Cartao>
  );
}

/** Aviso no topo das páginas quando a sincronização precisa de um toque para continuar. */
export function AvisoSincronizacao() {
  const s = useSincronizacaoDrive();
  if (s.situacao !== 'precisa_entrar') return null;
  return (
    <div role="status" className="mb-5 flex flex-col gap-3 rounded-lg border border-acao-600/25 bg-acao-50 px-4 py-3 text-sm text-marinho-700 sm:flex-row sm:items-center">
      <span className="flex flex-1 items-center gap-2"><Cloud size={16} className="shrink-0 text-acao-600" /> Toque para sincronizar com o Google Drive e trazer o que você fez no outro aparelho.</span>
      <Botao variante="primario" tamanho="p" onClick={s.sincronizarAgora} className="shrink-0"><RefreshCw size={14} /> Sincronizar</Botao>
    </div>
  );
}

/** Linha discreta no menu lateral. */
export function StatusSincronizacao() {
  const s = useSincronizacaoDrive();
  if (s.situacao === 'em_dia' || s.situacao === 'sincronizando')
    return (
      <p className="flex items-center gap-1.5 px-2.5 text-xs text-cinza-500">
        {s.situacao === 'sincronizando' ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
        {s.situacao === 'sincronizando' ? 'Sincronizando…' : `Drive: sincronizado ${s.ultima ? `às ${new Date(s.ultima).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
      </p>
    );
  if (s.situacao === 'erro') return <p className="flex items-center gap-1.5 px-2.5 text-xs text-alerta-700"><AlertTriangle size={12} /> Sincronização com problema</p>;
  return null;
}
