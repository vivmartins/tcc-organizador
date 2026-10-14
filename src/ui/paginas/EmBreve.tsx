import { Hammer } from 'lucide-react';
import { CabecalhoPagina, Cartao, EstadoVazio } from '../componentes/base.tsx';

/** Seções ainda não construídas: mostram claramente que chegam numa próxima etapa (nada simulado). */
export function EmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <>
      <CabecalhoPagina titulo={titulo} />
      <Cartao>
        <EstadoVazio icone={<Hammer size={20} />} titulo="Em construção">
          {descricao}
        </EstadoVazio>
      </Cartao>
    </>
  );
}
