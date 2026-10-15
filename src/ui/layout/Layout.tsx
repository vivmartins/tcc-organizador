import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Library, NotebookPen, CalendarCheck, MessagesSquare, ListChecks,
  ChevronsUpDown, Check, Plus, Settings2, HardDriveDownload, Menu, X, BookMarked, CircleHelp, FileSearch,
} from 'lucide-react';
import { cx } from '../componentes/base.tsx';
import { useProjeto } from '../projetoAtivo.tsx';
import { definirProjetoAtivo } from '../../data/projetos.ts';
import { AvisoBackup } from './AvisoBackup.tsx';

const SECOES = [
  { para: '/', rotulo: 'Visão geral', icone: LayoutDashboard },
  { para: '/biblioteca', rotulo: 'Biblioteca', icone: Library },
  { para: '/fichamentos', rotulo: 'Fichamentos', icone: NotebookPen },
  { para: '/planejamento', rotulo: 'Planejamento', icone: CalendarCheck },
  { para: '/orientacoes', rotulo: 'Orientações', icone: MessagesSquare },
  { para: '/auditoria', rotulo: 'Auditoria do TCC', icone: FileSearch },
  { para: '/conferencia', rotulo: 'Conferência final', icone: ListChecks },
];

function SeletorProjeto({ aoNavegar }: { aoNavegar?: () => void }) {
  const { projeto, projetos } = useProjeto();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navegar = useNavigate();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="flex w-full items-center gap-2.5 rounded-md border border-borda bg-superficie px-2.5 py-2 text-left hover:border-borda-forte"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded bg-marinho-900 text-xs font-semibold text-white">
          {projeto?.nome.trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] uppercase tracking-wide text-cinza-500">Projeto</span>
          <span className="block truncate text-sm font-medium">{projeto?.nome}</span>
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-cinza-500" />
      </button>
      {aberto && (
        <div role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-borda bg-superficie py-1 shadow-lg">
          {projetos.map((p) => (
            <button
              key={p.id}
              role="option"
              aria-selected={p.id === projeto?.id}
              onClick={async () => {
                await definirProjetoAtivo(p.id);
                setAberto(false);
                aoNavegar?.();
                navegar('/');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cinza-100"
            >
              <span className="flex-1 truncate">{p.nome}</span>
              {p.id === projeto?.id && <Check size={15} className="text-acao-600" />}
            </button>
          ))}
          <div className="my-1 border-t border-borda" />
          <button onClick={() => { setAberto(false); aoNavegar?.(); navegar('/projeto'); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-cinza-600 hover:bg-cinza-100 hover:text-marinho-900">
            <Settings2 size={15} /> Dados do projeto atual
          </button>
          <button onClick={() => { setAberto(false); aoNavegar?.(); navegar('/projeto/novo'); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-cinza-600 hover:bg-cinza-100 hover:text-marinho-900">
            <Plus size={15} /> Novo projeto
          </button>
        </div>
      )}
    </div>
  );
}

function Navegacao({ aoNavegar }: { aoNavegar?: () => void }) {
  const item = ({ isActive }: { isActive: boolean }) =>
    cx(
      'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
      isActive ? 'bg-acao-50 font-medium text-acao-700' : 'text-marinho-700 hover:bg-cinza-100 hover:text-marinho-900',
    );
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <div className="flex items-center gap-2 px-1 text-marinho-900">
        <BookMarked size={20} className="text-acao-600" />
        <span className="text-[15px] font-semibold tracking-tight">Organizador de TCC</span>
      </div>
      <SeletorProjeto aoNavegar={aoNavegar} />
      <nav aria-label="Seções" className="flex flex-col gap-0.5">
        {SECOES.map(({ para, rotulo, icone: Icone }) => (
          <NavLink key={para} to={para} end={para === '/'} className={item} onClick={aoNavegar}>
            <Icone size={17} strokeWidth={1.8} />
            {rotulo}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-2">
        <AvisoBackup />
        <NavLink to="/como-funciona" className={item} onClick={aoNavegar}>
          <CircleHelp size={17} strokeWidth={1.8} />
          Como funciona
        </NavLink>
        <NavLink to="/dados" className={item} onClick={aoNavegar}>
          <HardDriveDownload size={17} strokeWidth={1.8} />
          Backup e dados
        </NavLink>
      </div>
    </div>
  );
}

export function Layout() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop: menu lateral fixo */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-borda bg-fundo lg:block">
        <Navegacao />
      </aside>

      {/* Celular: barra superior + gaveta */}
      <div className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-borda bg-superficie/95 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setMenuAberto(true)} className="-ml-1.5 rounded p-1.5 hover:bg-cinza-100" aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <BookMarked size={18} className="text-acao-600" /> Organizador de TCC
        </span>
      </div>
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-marinho-900/30" onClick={() => setMenuAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto bg-fundo shadow-xl">
            <button onClick={() => setMenuAberto(false)} className="absolute right-3 top-3.5 rounded p-1.5 hover:bg-cinza-100" aria-label="Fechar menu">
              <X size={18} />
            </button>
            <Navegacao aoNavegar={() => setMenuAberto(false)} />
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
