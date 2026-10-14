import { useState } from 'react';
import { X } from 'lucide-react';
import { Botao, Entrada } from './base.tsx';

/** Campo para adicionar e remover tags (temas). As tags novas são criadas ao salvar. */
export function EditorTags({ tags, aoMudar, sugestoes, id = 'tags' }: { tags: string[]; aoMudar: (t: string[]) => void; sugestoes: string[]; id?: string }) {
  const [texto, setTexto] = useState('');
  const adicionar = () => {
    const t = texto.replace(/\s+/g, ' ').trim();
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) aoMudar([...tags, t]);
    setTexto('');
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Entrada
          id={id}
          list={`sugestoes-${id}`}
          placeholder="Digite e tecle Enter (ex.: Humanização)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              adicionar();
            }
          }}
        />
        <Botao onClick={adicionar} disabled={!texto.trim()}>Adicionar</Botao>
        <datalist id={`sugestoes-${id}`}>{sugestoes.filter((s) => !tags.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded bg-cinza-100 py-0.5 pl-2 pr-1 text-xs font-medium text-marinho-700">
              {t}
              <button type="button" onClick={() => aoMudar(tags.filter((x) => x !== t))} className="rounded p-0.5 hover:bg-borda-forte/50" aria-label={`Remover ${t}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

