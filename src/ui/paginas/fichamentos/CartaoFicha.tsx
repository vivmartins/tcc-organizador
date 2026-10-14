import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import type { Fichamento, Fonte } from '../../../data/db.ts';
import { excluirFicha } from '../../../data/fichamentos.ts';
import { ROTULO_TIPO_FICHAMENTO, textoDaFicha, type TipoFichamento } from '../../../domain/fichamento.ts';
import { gerarCitacao } from '../../../domain/abnt/citacao.ts';
import { Selo } from '../../componentes/base.tsx';
import { Confirmacao, useAvisos } from '../../componentes/dialogos.tsx';
import { copiar, dataCurta } from '../../util.ts';
import { autoresCurtos } from '../biblioteca/rotulos.ts';

const TOM: Record<TipoFichamento, 'acao' | 'neutro' | 'sucesso' | 'alerta'> = {
  citacao_direta: 'acao',
  citacao_indireta: 'acao',
  resumo: 'neutro',
  ideia: 'alerta',
  dado_relevante: 'sucesso',
};

function BotaoIcone({ rotulo, onClick, perigo, children }: { rotulo: string; onClick: () => void; perigo?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={rotulo} title={rotulo} className={`rounded p-1.5 text-cinza-500 transition-colors ${perigo ? 'hover:bg-perigo-50 hover:text-perigo-700' : 'hover:bg-cinza-100 hover:text-marinho-900'}`}>
      {children}
    </button>
  );
}

export function CartaoFicha({ ficha, fonte, nomesTags, mostrarFonte, etAl, aoEditar }: { ficha: Fichamento; fonte?: Fonte; nomesTags: Map<string, string>; mostrarFonte?: boolean; etAl?: boolean; aoEditar: () => void }) {
  const avisar = useAvisos();
  const [excluindo, setExcluindo] = useState(false);

  async function copiarFicha() {
    if (!fonte) return;
    try {
      await copiar(textoDaFicha(ficha, fonte, { etAlAPartirDe4: etAl }));
      avisar('sucesso', 'Ficha completa copiada, com a identificação da fonte.');
    } catch {
      avisar('erro', 'Não foi possível copiar. Verifique a permissão de área de transferência do navegador.');
    }
  }

  return (
    <article className="rounded-lg border border-borda bg-superficie p-4 sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Selo tom={TOM[ficha.tipo]}>{ROTULO_TIPO_FICHAMENTO[ficha.tipo]}</Selo>
          {ficha.pagina && <span className="text-xs text-cinza-500">p. {ficha.pagina.replace(/^p\.?\s*/i, '')}</span>}
          {ficha.tema && <span className="text-xs text-cinza-600">· {ficha.tema}</span>}
        </div>
        <div className="-mr-1.5 -mt-1 flex shrink-0">
          <BotaoIcone rotulo="Copiar ficha completa" onClick={copiarFicha}><Copy size={15} /></BotaoIcone>
          <BotaoIcone rotulo="Editar ficha" onClick={aoEditar}><Pencil size={15} /></BotaoIcone>
          <BotaoIcone rotulo="Excluir ficha" onClick={() => setExcluindo(true)} perigo><Trash2 size={15} /></BotaoIcone>
        </div>
      </header>

      {ficha.trechoOriginal && (
        <blockquote className="mt-3 whitespace-pre-wrap border-l-2 border-acao-100 pl-3 font-serif text-[15px] leading-relaxed text-marinho-900">
          “{ficha.trechoOriginal}”
          {fonte && <span className="whitespace-nowrap font-sans text-xs text-cinza-500"> {gerarCitacao(fonte, { pagina: ficha.pagina })}</span>}
        </blockquote>
      )}
      {ficha.parafrase && (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-cinza-500">Resumo ou paráfrase</h4>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{ficha.parafrase}</p>
        </div>
      )}
      {ficha.interpretacao && (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-cinza-500">Minha interpretação</h4>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{ficha.interpretacao}</p>
        </div>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-cinza-500">
        {ficha.capituloSecao && <span>Uso no TCC: <span className="text-marinho-700">{ficha.capituloSecao}</span></span>}
        {ficha.tagIds.map((id) => nomesTags.has(id) && <Selo key={id}>{nomesTags.get(id)}</Selo>)}
        <span className="ml-auto">{ficha.atualizadoEm !== ficha.criadoEm ? `editada em ${dataCurta(ficha.atualizadoEm)}` : `criada em ${dataCurta(ficha.criadoEm)}`}</span>
      </footer>
      {mostrarFonte && fonte && (
        <Link to={`/biblioteca/${fonte.id}`} className="mt-3 block truncate border-t border-borda pt-2.5 text-xs text-acao-700 hover:underline">
          {fonte.titulo} — {[autoresCurtos(fonte.autores), fonte.ano].filter(Boolean).join(', ')}
        </Link>
      )}

      <Confirmacao
        aberto={excluindo}
        titulo="Excluir ficha?"
        textoConfirmar="Excluir"
        perigoso
        aoCancelar={() => setExcluindo(false)}
        aoConfirmar={async () => {
          setExcluindo(false);
          await excluirFicha(ficha.id);
          avisar('sucesso', 'Ficha excluída.');
        }}
      >
        <p>Esta ficha será apagada. Não dá para desfazer.</p>
      </Confirmacao>
    </article>
  );
}
