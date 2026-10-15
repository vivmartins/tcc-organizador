import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Loader2, Trash2, BookOpenText } from 'lucide-react';
import { db, type Fonte } from '../../../data/db.ts';
import { removerTexto, salvarTexto } from '../../../data/textos.ts';
import { lerPdf } from '../../../integrations/pdf.ts';
import { buscarPorDoi, ErroDeImportacao } from '../../../integrations/metadados.ts';
import { Botao, Selo, cx } from '../../componentes/base.tsx';
import { useAvisos } from '../../componentes/dialogos.tsx';
import { dataCurta } from '../../util.ts';

/** Situação e ações do texto de uma fonte usado na auditoria (anexar PDF, buscar resumo, remover). */
export function TextoDaFonte({ fonte, compacto = false }: { fonte: Fonte; compacto?: boolean }) {
  const avisar = useAvisos();
  const texto = useLiveQuery(() => db.textos.get(fonte.id), [fonte.id]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  async function anexar(arquivo?: File) {
    if (!arquivo) return;
    setOcupado('Lendo o PDF…');
    try {
      const l = await lerPdf(arquivo);
      await salvarTexto(fonte.id, { origem: 'pdf', texto: l.texto, nomeArquivo: arquivo.name, paginas: l.paginas });
      avisar('sucesso', 'Texto do PDF guardado para a auditoria.');
    } catch (e) {
      avisar('erro', (e as Error).message);
    } finally {
      setOcupado(null);
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function buscarResumo() {
    if (!fonte.doi) return;
    setOcupado('Buscando o resumo…');
    try {
      const r = await buscarPorDoi(fonte.doi);
      if (!r.resumo) {
        avisar('erro', 'O OpenAlex não tem o resumo deste artigo. Anexe o PDF.');
        return;
      }
      await salvarTexto(fonte.id, { origem: 'resumo', texto: r.resumo });
      avisar('sucesso', 'Resumo guardado para a auditoria.');
    } catch (e) {
      avisar('erro', e instanceof ErroDeImportacao ? e.message : (e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  const acoes = (
    <div className="flex flex-wrap gap-2">
      <input ref={entrada} type="file" accept="application/pdf,.pdf" className="hidden" aria-label={`PDF de ${fonte.titulo}`} onChange={(e) => anexar(e.target.files?.[0])} />
      <Botao tamanho="p" onClick={() => entrada.current?.click()} disabled={!!ocupado}><FileText size={14} /> {texto?.origem === 'pdf' ? 'Trocar PDF' : 'Anexar PDF'}</Botao>
      {!texto && fonte.doi && <Botao tamanho="p" variante="fantasma" onClick={buscarResumo} disabled={!!ocupado}><BookOpenText size={14} /> Buscar resumo</Botao>}
      {texto && <Botao tamanho="p" variante="fantasma" onClick={async () => { await removerTexto(fonte.id); avisar('sucesso', 'Texto removido.'); }} disabled={!!ocupado} aria-label={`Remover texto de ${fonte.titulo}`}><Trash2 size={14} /> Remover</Botao>}
    </div>
  );

  return (
    <div className={cx(!compacto && 'rounded-lg border border-borda bg-superficie p-5')}>
      {!compacto && <h3 className="text-sm font-semibold">Texto para a auditoria</h3>}
      <div className={cx('flex flex-col gap-2', !compacto && 'mt-1.5')}>
        {ocupado ? (
          <p className="flex items-center gap-2 text-sm text-cinza-600"><Loader2 size={14} className="animate-spin" /> {ocupado}</p>
        ) : texto ? (
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-cinza-600">
            <Selo tom="sucesso">{texto.origem === 'pdf' ? 'Texto completo' : 'Só o resumo'}</Selo>
            {texto.origem === 'pdf' ? `${texto.nomeArquivo ?? 'PDF'}${texto.paginas ? `, ${texto.paginas} pág.` : ''}` : 'do OpenAlex'} · {texto.palavras.toLocaleString('pt-BR')} palavras · {dataCurta(texto.criadoEm)}
          </p>
        ) : (
          !compacto && <p className="text-sm text-cinza-600">Sem texto. Anexe o PDF para que a auditoria possa comparar o seu TCC com esta fonte. O texto fica só no seu navegador; o arquivo não é guardado.</p>
        )}
        {acoes}
      </div>
    </div>
  );
}
