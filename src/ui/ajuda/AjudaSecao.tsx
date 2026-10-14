import { useLiveQuery } from 'dexie-react-hooks';
import { CircleHelp, Lightbulb, X } from 'lucide-react';
import { db } from '../../data/db.ts';
import { AJUDA, type Secao } from './textos.ts';

const chave = (s: Secao) => `ajuda:${s}`;

/** Quadro "para que serve esta seção". Aberto na primeira visita; depois de
 *  “Entendi”, vira um botão discreto que reabre a explicação. */
export function AjudaSecao({ secao }: { secao: Secao }) {
  const estado = useLiveQuery(async () => (await db.config.get(chave(secao)))?.valor ?? 'aberta', [secao]);
  if (estado === undefined) return null;
  const t = AJUDA[secao];
  const definir = (valor: 'aberta' | 'fechada') => db.config.put({ chave: chave(secao), valor });

  if (estado === 'fechada') {
    return (
      <button onClick={() => definir('aberta')} className="mb-4 inline-flex items-center gap-1.5 text-xs text-cinza-500 hover:text-acao-700">
        <CircleHelp size={14} /> Como usar esta seção
      </button>
    );
  }

  return (
    <aside aria-label={t.titulo} className="relative mb-5 rounded-lg border border-acao-100 bg-acao-50/60 px-4 py-4 sm:px-5">
      <button onClick={() => definir('fechada')} aria-label="Fechar explicação" className="absolute right-2.5 top-2.5 rounded p-1 text-cinza-500 hover:bg-acao-100 hover:text-marinho-900">
        <X size={16} />
      </button>
      <h2 className="flex items-center gap-2 pr-8 text-sm font-semibold text-marinho-900">
        <Lightbulb size={16} className="shrink-0 text-acao-600" /> {t.titulo}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-marinho-700">{t.paraQue}</p>
      <ul className="mt-2.5 flex flex-col gap-1 text-sm text-marinho-700">
        {t.passos.map((p) => (
          <li key={p} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-acao-600" />{p}</li>
        ))}
      </ul>
      {t.exemplo && <p className="mt-2.5 text-xs italic text-cinza-600">{t.exemplo}</p>}
      <button onClick={() => definir('fechada')} className="mt-3 text-xs font-medium text-acao-700 hover:underline">Entendi</button>
    </aside>
  );
}
