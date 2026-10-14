import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { NotebookPen, Plus, Search, Library } from 'lucide-react';
import { db, type Fichamento } from '../../../data/db.ts';
import { useProjetoObrigatorio } from '../../projetoAtivo.tsx';
import { Botao, BotaoLink, CabecalhoPagina, Cartao, Entrada, EstadoVazio, Selecao } from '../../componentes/base.tsx';
import { corresponde, termosDaConsulta } from '../../../domain/busca.ts';
import { ORDEM_TIPOS_FICHAMENTO, ROTULO_TIPO_FICHAMENTO, type TipoFichamento } from '../../../domain/fichamento.ts';
import { plural } from '../../util.ts';
import { CartaoFicha } from './CartaoFicha.tsx';
import { FormularioFicha } from './FormularioFicha.tsx';
import { AjudaSecao } from '../../ajuda/AjudaSecao.tsx';

const comparar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

/** Lista de fichas reutilizada na página de Fichamentos e na página de cada fonte. */
export function ListaDeFichas({ fonteId }: { fonteId?: string }) {
  const projeto = useProjetoObrigatorio();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<TipoFichamento | ''>('');
  const [tagId, setTagId] = useState('');
  const [capitulo, setCapitulo] = useState('');
  const [fonteFiltro, setFonteFiltro] = useState('');
  const [editando, setEditando] = useState<Fichamento | 'nova' | null>(null);

  const dados = useLiveQuery(async () => {
    const [fichas, fontes, tags] = await Promise.all([
      fonteId ? db.fichamentos.where('fonteId').equals(fonteId).toArray() : db.fichamentos.where('projetoId').equals(projeto.id).toArray(),
      db.fontes.where('projetoId').equals(projeto.id).toArray(),
      db.tags.where('projetoId').equals(projeto.id).toArray(),
    ]);
    return { fichas, fontes, tags };
  }, [projeto.id, fonteId]);

  const fontesPorId = useMemo(() => new Map((dados?.fontes ?? []).map((f) => [f.id, f])), [dados?.fontes]);
  const nomesTags = useMemo(() => new Map((dados?.tags ?? []).map((t) => [t.id, t.nome])), [dados?.tags]);
  const capitulos = useMemo(() => [...new Set((dados?.fichas ?? []).map((f) => f.capituloSecao).filter((c): c is string => !!c))].sort(comparar), [dados?.fichas]);

  const filtradas = useMemo(() => {
    if (!dados) return [];
    const termos = termosDaConsulta(busca);
    return dados.fichas
      .filter((f) => {
        if (tipo && f.tipo !== tipo) return false;
        if (tagId && !f.tagIds.includes(tagId)) return false;
        if (capitulo && f.capituloSecao !== capitulo) return false;
        if (fonteFiltro && f.fonteId !== fonteFiltro) return false;
        const fonte = fontesPorId.get(f.fonteId);
        return corresponde(termos, [
          f.trechoOriginal, f.parafrase, f.interpretacao, f.tema, f.capituloSecao,
          ...f.tagIds.map((id) => nomesTags.get(id)),
          fonteId ? undefined : fonte?.titulo,
          ...(fonteId ? [] : (fonte?.autores ?? []).map((a) => a.sobrenome)),
        ]);
      })
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }, [dados, busca, tipo, tagId, capitulo, fonteFiltro, fontesPorId, nomesTags, fonteId]);

  if (!dados) return null;
  const filtrosAtivos = !!(busca || tipo || tagId || capitulo || fonteFiltro);
  const semFontes = !fonteId && dados.fontes.length === 0;

  return (
    <>
      {dados.fichas.length === 0 ? (
        <Cartao>
          {semFontes ? (
            <EstadoVazio icone={<Library size={20} />} titulo="Cadastre uma fonte primeiro" acao={<BotaoLink para="/biblioteca/nova" variante="primario">Cadastrar fonte</BotaoLink>}>
              Cada ficha fica ligada a uma fonte da sua biblioteca, para que a citação e a referência saiam certas.
            </EstadoVazio>
          ) : (
            <EstadoVazio icone={<NotebookPen size={20} />} titulo="Nenhuma ficha registrada" acao={<Botao variante="primario" onClick={() => setEditando('nova')}><Plus size={16} /> Nova ficha</Botao>}>
              Registre citações diretas e indiretas, resumos, ideias e dados relevantes, com a página e o capítulo do TCC em que podem ser usados.
            </EstadoVazio>
          )}
        </Cartao>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cinza-500" />
                <Entrada type="search" aria-label="Pesquisar nas fichas" placeholder="Pesquisar no trecho, paráfrase, interpretação, tema…" value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
              </div>
              <Botao variante="primario" onClick={() => setEditando('nova')} className="shrink-0"><Plus size={16} /> <span className="hidden sm:inline">Nova ficha</span></Botao>
            </div>
            <div className={`grid grid-cols-2 gap-2 ${fonteId ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
              <Selecao aria-label="Tipo de registro" value={tipo} onChange={(e) => setTipo(e.target.value as TipoFichamento | '')}>
                <option value="">Todos os tipos</option>
                {ORDEM_TIPOS_FICHAMENTO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_FICHAMENTO[t]}</option>)}
              </Selecao>
              <Selecao aria-label="Tag" value={tagId} onChange={(e) => setTagId(e.target.value)} disabled={!dados.tags.length}>
                <option value="">{dados.tags.length ? 'Todas as tags' : 'Sem tags'}</option>
                {[...dados.tags].sort((a, b) => comparar(a.nome, b.nome)).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </Selecao>
              <Selecao aria-label="Capítulo ou seção" value={capitulo} onChange={(e) => setCapitulo(e.target.value)} disabled={!capitulos.length}>
                <option value="">{capitulos.length ? 'Todos os capítulos' : 'Sem capítulos'}</option>
                {capitulos.map((c) => <option key={c} value={c}>{c}</option>)}
              </Selecao>
              {!fonteId && (
                <Selecao aria-label="Fonte" value={fonteFiltro} onChange={(e) => setFonteFiltro(e.target.value)}>
                  <option value="">Todas as fontes</option>
                  {[...dados.fontes].sort((a, b) => comparar(a.titulo, b.titulo)).map((f) => <option key={f.id} value={f.id}>{f.titulo}</option>)}
                </Selecao>
              )}
            </div>
          </div>
          <p className="mb-3 flex items-center gap-3 text-xs text-cinza-500">
            {filtrosAtivos ? `${plural(filtradas.length, 'ficha encontrada', 'fichas encontradas')} de ${dados.fichas.length}` : plural(dados.fichas.length, 'ficha', 'fichas')}
            {filtrosAtivos && <button className="text-acao-700 hover:underline" onClick={() => { setBusca(''); setTipo(''); setTagId(''); setCapitulo(''); setFonteFiltro(''); }}>Limpar filtros</button>}
          </p>
          {filtradas.length === 0 ? (
            <Cartao><p className="px-4 py-10 text-center text-sm text-cinza-500">Nenhuma ficha encontrada com esses filtros.</p></Cartao>
          ) : (
            <div className="flex flex-col gap-3">
              {filtradas.map((f) => (
                <CartaoFicha key={f.id} ficha={f} fonte={fontesPorId.get(f.fonteId)} nomesTags={nomesTags} mostrarFonte={!fonteId} etAl={projeto.etAlNasReferencias} aoEditar={() => setEditando(f)} />
              ))}
            </div>
          )}
        </>
      )}
      {editando && (
        <FormularioFicha
          key={editando === 'nova' ? 'nova' : editando.id}
          projetoId={projeto.id}
          fonteId={fonteId}
          ficha={editando === 'nova' ? undefined : editando}
          aoFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}

export function Fichamentos() {
  return (
    <>
      <CabecalhoPagina titulo="Fichamentos" descricao="Citações, resumos e ideias de todas as suas fontes." />
      <AjudaSecao secao="fichamentos" />
      <ListaDeFichas />
    </>
  );
}
