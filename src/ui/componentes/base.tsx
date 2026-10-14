// Componentes visuais reutilizáveis (botões, campos, selos, estados vazios).
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';
const ESTILO_BOTAO: Record<Variante, string> = {
  primario: 'bg-acao-600 text-white hover:bg-acao-700 shadow-sm',
  secundario: 'bg-superficie text-marinho-900 border border-borda-forte hover:bg-cinza-100',
  fantasma: 'text-cinza-600 hover:bg-cinza-100 hover:text-marinho-900',
  perigo: 'bg-superficie text-perigo-700 border border-borda-forte hover:bg-perigo-50',
};
const BASE_BOTAO =
  'inline-flex items-center justify-center gap-2 rounded-md px-3.5 h-9 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';

export const Botao = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: 'p' | 'm' }>(
  ({ variante = 'secundario', tamanho = 'm', className, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cx(BASE_BOTAO, ESTILO_BOTAO[variante], tamanho === 'p' && 'h-8 px-2.5 text-[13px]', className)} {...props} />
  ),
);

export function BotaoLink({ para, variante = 'secundario', children, className }: { para: string; variante?: Variante; children: ReactNode; className?: string }) {
  return (
    <Link to={para} className={cx(BASE_BOTAO, ESTILO_BOTAO[variante], className)}>
      {children}
    </Link>
  );
}

/** Largura total por padrão, a menos que uma largura sem prefixo (ex.: "w-28") seja passada. */
const largura = (c?: string) => (/(^|\s)w-/.test(c ?? '') ? '' : 'w-full');

const BASE_CAMPO =
  'rounded-md border border-borda-forte bg-superficie px-3 text-sm text-marinho-900 placeholder:text-cinza-500 transition-colors focus:border-acao-600 focus:outline-none focus:ring-3 focus:ring-acao-100 aria-[invalid=true]:border-perigo-700 aria-[invalid=true]:focus:ring-perigo-50';

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cx(BASE_CAMPO, largura(className), 'h-9', className)} {...p} />
));

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, rows = 3, ...p }, ref) => (
  <textarea ref={ref} rows={rows} className={cx(BASE_CAMPO, largura(className), 'py-2 leading-relaxed resize-y', className)} {...p} />
));

export const Selecao = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => (
  <select ref={ref} className={cx(BASE_CAMPO, largura(className), 'h-9 pr-8', className)} {...p} />
));

/** Rótulo + campo + dica + mensagem de erro. */
export function Campo({ rotulo, id, erro, dica, children, className, obrigatorio }: { rotulo: string; id: string; erro?: string; dica?: ReactNode; children: ReactNode; className?: string; obrigatorio?: boolean }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-marinho-700">
        {rotulo}
        {obrigatorio && <span className="text-perigo-700"> *</span>}
      </label>
      {children}
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="text-xs text-perigo-700">
          {erro}
        </p>
      ) : dica ? (
        <p className="text-xs text-cinza-500">{dica}</p>
      ) : null}
    </div>
  );
}

type Tom = 'neutro' | 'acao' | 'sucesso' | 'alerta' | 'perigo';
const ESTILO_SELO: Record<Tom, string> = {
  neutro: 'bg-cinza-100 text-cinza-600',
  acao: 'bg-acao-50 text-acao-700',
  sucesso: 'bg-sucesso-50 text-sucesso-700',
  alerta: 'bg-alerta-50 text-alerta-700',
  perigo: 'bg-perigo-50 text-perigo-700',
};
export function Selo({ tom = 'neutro', children, className }: { tom?: Tom; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium', ESTILO_SELO[tom], className)}>{children}</span>;
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-lg border border-borda bg-superficie', className)}>{children}</section>;
}

export function EstadoVazio({ icone, titulo, children, acao }: { icone: ReactNode; titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-acao-50 text-acao-600">{icone}</div>
      <h3 className="text-base font-semibold">{titulo}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm leading-relaxed text-cinza-600">{children}</div>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function CabecalhoPagina({ titulo, descricao, acoes, voltar }: { titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode; voltar?: ReactNode }) {
  return (
    <header className="mb-6">
      {voltar && <div className="mb-3">{voltar}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-marinho-900 sm:text-2xl">{titulo}</h1>
          {descricao && <p className="mt-1 text-sm text-cinza-600">{descricao}</p>}
        </div>
        {acoes && <div className="flex shrink-0 flex-wrap gap-2">{acoes}</div>}
      </div>
    </header>
  );
}
