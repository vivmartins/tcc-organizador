import { Hammer } from 'lucide-react';
import { CabecalhoPagina, Cartao, EstadoVazio } from '../componentes/base.tsx';
import { AjudaSecao } from '../ajuda/AjudaSecao.tsx';
import type { Secao } from '../ajuda/textos.ts';

/** Seções ainda não construídas: mostram claramente que chegam numa próxima etapa (nada simulado). */
export function EmBreve({ titulo, descricao, secao }: { titulo: string; descricao: string; secao: Secao }) {
  return (
    <>
      <CabecalhoPagina titulo={titulo} />
      <AjudaSecao secao={secao} />
      <Cartao>
        <EstadoVazio icone={<Hammer size={20} />} titulo="Em construção">
          {descricao}
        </EstadoVazio>
      </Cartao>
    </>
  );
}
