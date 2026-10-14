import { createContext, useContext, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Projeto } from '../data/db.ts';
import { obterProjetoAtivo } from '../data/projetos.ts';

interface EstadoProjeto {
  carregando: boolean;
  projeto: Projeto | null;
  projetos: Projeto[];
}

const Contexto = createContext<EstadoProjeto>({ carregando: true, projeto: null, projetos: [] });

export function ProvedorProjeto({ children }: { children: ReactNode }) {
  // useLiveQuery: sempre que os dados mudarem no banco, a tela se atualiza sozinha.
  const dados = useLiveQuery(async () => {
    const [projeto, projetos] = await Promise.all([obterProjetoAtivo(), db.projetos.orderBy('nome').toArray()]);
    return { projeto, projetos };
  }, []);
  const valor: EstadoProjeto = dados ? { carregando: false, ...dados } : { carregando: true, projeto: null, projetos: [] };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useProjeto = () => useContext(Contexto);

/** Para páginas que só existem com um projeto aberto. */
export function useProjetoObrigatorio(): Projeto {
  const { projeto } = useProjeto();
  if (!projeto) throw new Error('Nenhum projeto ativo.');
  return projeto;
}
