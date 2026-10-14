import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ListChecks, Plus, Pencil, Trash2, Sparkles, AlertCircle, CheckCircle2, CircleDashed } from 'lucide-react';
import { db, type ChecklistItem } from '../../data/db.ts';
import { aplicarChecklistSugerido, alternarItem, criarItem, editarItem, excluirItem, renomearCategoria } from '../../data/checklist.ts';
import { gerarReferencia } from '../../domain/abnt/referencia.ts';
import { useProjetoObrigatorio } from '../projetoAtivo.tsx';
import { Botao, CabecalhoPagina, Cartao, Entrada, EstadoVazio, cx } from '../componentes/base.tsx';
import { useAvisos } from '../componentes/dialogos.tsx';
import { AjudaSecao } from '../ajuda/AjudaSecao.tsx';
import { plural } from '../util.ts';

function FormLinha({ placeholder, rotulo, aoEnviar, aoCancelar, inicial = '', textoBotao = 'Adicionar' }: { placeholder: string; rotulo: string; aoEnviar: (t: string) => Promise<void>; aoCancelar?: () => void; inicial?: string; textoBotao?: string }) {
  const [texto, setTexto] = useState(inicial);
  const avisar = useAvisos();
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      await aoEnviar(texto);
      setTexto('');
    } catch (err) {
      avisar('erro', (err as Error).message);
    }
  }
  return (
    <form onSubmit={enviar} className="flex gap-2">
      <Entrada aria-label={rotulo} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={placeholder} autoFocus={!!aoCancelar} onKeyDown={(e) => e.key === 'Escape' && aoCancelar?.()} />
      <Botao type="submit" disabled={!texto.trim()}>{textoBotao}</Botao>
      {aoCancelar && <Botao variante="fantasma" onClick={aoCancelar}>Cancelar</Botao>}
    </form>
  );
}

function Item({ item }: { item: ChecklistItem }) {
  const [editando, setEditando] = useState(false);
  // Marca na hora (sem esperar o banco); o componente é recriado quando o valor salvo muda.
  const [marcado, setMarcado] = useState(item.concluido);
  if (editando) {
    return (
      <li className="px-4 py-2.5">
        <FormLinha rotulo="Editar item" placeholder="Texto do item" inicial={item.texto} textoBotao="Salvar" aoEnviar={async (t) => { await editarItem(item.id, t); setEditando(false); }} aoCancelar={() => setEditando(false)} />
      </li>
    );
  }
  return (
    <li className="group flex items-start gap-3 px-4 py-2.5">
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-sucesso-700" checked={marcado} onChange={(e) => { setMarcado(e.target.checked); void alternarItem(item.id, e.target.checked); }} aria-label={item.texto} />
      <span className={cx('flex-1 text-sm', marcado && 'text-cinza-500 line-through')}>{item.texto}</span>
      <span className="flex shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button onClick={() => setEditando(true)} aria-label={`Editar: ${item.texto}`} className="rounded p-1 text-cinza-500 hover:bg-cinza-100 hover:text-marinho-900"><Pencil size={14} /></button>
        <button onClick={() => excluirItem(item.id)} aria-label={`Excluir: ${item.texto}`} className="rounded p-1 text-cinza-500 hover:bg-perigo-50 hover:text-perigo-700"><Trash2 size={14} /></button>
      </span>
    </li>
  );
}

function Categoria({ projetoId, nome, itens, soPendentes }: { projetoId: string; nome: string; itens: ChecklistItem[]; soPendentes: boolean }) {
  const [adicionando, setAdicionando] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const feitos = itens.filter((i) => i.concluido).length;
  const visiveis = soPendentes ? itens.filter((i) => !i.concluido) : itens;
  if (soPendentes && visiveis.length === 0) return null;
  return (
    <Cartao className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-borda bg-fundo/60 px-4 py-2.5">
        {renomeando ? (
          <div className="flex-1"><FormLinha rotulo="Nome da categoria" placeholder="Nome da categoria" inicial={nome} textoBotao="Salvar" aoEnviar={async (t) => { await renomearCategoria(projetoId, nome, t); setRenomeando(false); }} aoCancelar={() => setRenomeando(false)} /></div>
        ) : (
          <>
            <h2 className="flex-1 text-sm font-semibold">{nome}</h2>
            <span className={cx('text-xs', feitos === itens.length ? 'font-medium text-sucesso-700' : 'text-cinza-500')}>{feitos}/{itens.length}</span>
            <button onClick={() => setRenomeando(true)} aria-label={`Renomear categoria ${nome}`} className="rounded p-1 text-cinza-500 hover:bg-cinza-100 hover:text-marinho-900"><Pencil size={14} /></button>
          </>
        )}
      </div>
      <ul className="divide-y divide-borda">{visiveis.map((i) => <Item key={`${i.id}-${i.concluido}`} item={i} />)}</ul>
      <div className="border-t border-borda px-4 py-2">
        {adicionando ? (
          <FormLinha rotulo={`Novo item em ${nome}`} placeholder="Novo item" aoEnviar={(t) => criarItem(projetoId, nome, t)} aoCancelar={() => setAdicionando(false)} />
        ) : (
          <button onClick={() => setAdicionando(true)} className="flex items-center gap-1.5 py-1 text-xs text-cinza-500 hover:text-acao-700"><Plus size={14} /> Adicionar item</button>
        )}
      </div>
    </Cartao>
  );
}

function NovaCategoria({ projetoId, aoFechar }: { projetoId: string; aoFechar: () => void }) {
  const [categoria, setCategoria] = useState('');
  const [item, setItem] = useState('');
  const avisar = useAvisos();
  return (
    <Cartao className="p-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={async (e) => {
          e.preventDefault();
          try { await criarItem(projetoId, categoria, item); aoFechar(); } catch (err) { avisar('erro', (err as Error).message); }
        }}
      >
        <Entrada aria-label="Nome da nova categoria" placeholder="Categoria (ex.: Exigências do curso)" value={categoria} onChange={(e) => setCategoria(e.target.value)} autoFocus />
        <Entrada aria-label="Primeiro item da categoria" placeholder="Primeiro item" value={item} onChange={(e) => setItem(e.target.value)} />
        <Botao type="submit" variante="primario" disabled={!categoria.trim() || !item.trim()}>Criar</Botao>
        <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
      </form>
    </Cartao>
  );
}

function Situacao({ projetoId }: { projetoId: string }) {
  const s = useLiveQuery(async () => {
    const [fontes, tarefas, orientacoes] = await Promise.all([
      db.fontes.where('projetoId').equals(projetoId).toArray(),
      db.tarefas.where('projetoId').equals(projetoId).toArray(),
      db.orientacoes.where('projetoId').equals(projetoId).toArray(),
    ]);
    const refs = fontes.map((f) => gerarReferencia(f));
    return {
      fontes: fontes.length,
      incompletas: refs.filter((r) => !r.completa).length,
      naoConferidas: refs.filter((r) => r.pendencias.some((p) => p.nivel === 'conferir')).length,
      tarefasPendentes: tarefas.filter((t) => t.status !== 'concluida').length,
      orientacoesPendentes: orientacoes.filter((o) => o.status !== 'concluida').length,
    };
  }, [projetoId]);
  if (!s) return null;
  const linha = (ok: boolean, texto: string, link?: { para: string; rotulo: string }) => (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-sucesso-700" /> : <AlertCircle size={16} className="mt-0.5 shrink-0 text-alerta-700" />}
      <span>{texto}{link && <> · <Link to={link.para} className="text-acao-700 hover:underline">{link.rotulo}</Link></>}</span>
    </li>
  );
  return (
    <Cartao className="mb-5 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><CircleDashed size={16} className="text-acao-600" /> Situação atual do projeto</h2>
      <p className="mt-1 text-xs text-cinza-500">Calculada a partir dos seus cadastros, para ajudar a marcar o checklist com segurança.</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {s.fontes === 0
          ? linha(false, 'Nenhuma fonte cadastrada ainda.', { para: '/biblioteca', rotulo: 'Biblioteca' })
          : <>
              {linha(s.incompletas === 0, s.incompletas ? `${plural(s.incompletas, 'fonte com dados obrigatórios faltando', 'fontes com dados obrigatórios faltando')}` : `Todas as ${s.fontes} fontes têm os dados obrigatórios.`, s.incompletas ? { para: '/biblioteca', rotulo: 'ver na Biblioteca' } : undefined)}
              {linha(s.naoConferidas === 0, s.naoConferidas ? `${plural(s.naoConferidas, 'fonte com dados ainda não conferidos', 'fontes com dados ainda não conferidos')}` : 'Todos os dados das fontes foram conferidos.', s.naoConferidas ? { para: '/biblioteca', rotulo: 'conferir' } : undefined)}
            </>}
        {linha(s.tarefasPendentes === 0, s.tarefasPendentes ? `${plural(s.tarefasPendentes, 'tarefa pendente', 'tarefas pendentes')} no planejamento` : 'Nenhuma tarefa pendente no planejamento.', s.tarefasPendentes ? { para: '/planejamento', rotulo: 'Planejamento' } : undefined)}
        {linha(s.orientacoesPendentes === 0, s.orientacoesPendentes ? `${plural(s.orientacoesPendentes, 'orientação pendente', 'orientações pendentes')}` : 'Nenhuma orientação pendente.', s.orientacoesPendentes ? { para: '/orientacoes', rotulo: 'Orientações' } : undefined)}
      </ul>
    </Cartao>
  );
}

export function Conferencia() {
  const projeto = useProjetoObrigatorio();
  const avisar = useAvisos();
  const [soPendentes, setSoPendentes] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState(false);
  const itens = useLiveQuery(() => db.checklist.where('projetoId').equals(projeto.id).sortBy('ordem'), [projeto.id]);
  if (!itens) return null;

  const categorias: { nome: string; itens: ChecklistItem[] }[] = [];
  for (const i of itens) {
    const c = categorias.find((x) => x.nome === i.categoria);
    if (c) c.itens.push(i);
    else categorias.push({ nome: i.categoria, itens: [i] });
  }
  const feitos = itens.filter((i) => i.concluido).length;
  const pct = itens.length ? Math.round((feitos / itens.length) * 100) : 0;

  return (
    <div className="max-w-4xl">
      <CabecalhoPagina titulo="Conferência final" descricao="Checklist para preparar a entrega do TCC. Adapte os itens às exigências da sua instituição." />
      <AjudaSecao secao="conferencia" />
      <Situacao projetoId={projeto.id} />

      {itens.length === 0 && !novaCategoria ? (
        <Cartao>
          <EstadoVazio icone={<ListChecks size={20} />} titulo="Monte o seu checklist de entrega" acao={<div className="flex flex-wrap justify-center gap-2"><Botao variante="primario" onClick={async () => { try { await aplicarChecklistSugerido(projeto.id); avisar('sucesso', 'Checklist criado. Adapte os itens à sua instituição.'); } catch (e) { avisar('erro', (e as Error).message); } }}><Sparkles size={15} /> Usar checklist sugerido</Botao><Botao onClick={() => setNovaCategoria(true)}>Começar do zero</Botao></div>}>
            O checklist sugerido cobre dados bibliográficos, referências, capítulos, orientações, formatação, elementos obrigatórios e arquivos de entrega. Você pode editar, excluir e criar itens.
          </EstadoVazio>
        </Cartao>
      ) : (
        <>
          {itens.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div className="min-w-48 flex-1">
                <div className="flex justify-between text-sm"><span className="font-medium">{feitos === itens.length ? 'Tudo conferido! 🎉' : `${feitos} de ${plural(itens.length, 'item concluído', 'itens concluídos')}`}</span><span className="text-cinza-500">{pct}%</span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cinza-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-sucesso-700 transition-all" style={{ width: `${pct}%` }} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-marinho-700"><input type="checkbox" className="size-4 accent-acao-600" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} /> Mostrar só pendentes</label>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {categorias.map((c) => <Categoria key={c.nome} projetoId={projeto.id} nome={c.nome} itens={c.itens} soPendentes={soPendentes} />)}
            {soPendentes && itens.length > 0 && feitos === itens.length && <p className="text-center text-sm text-sucesso-700">Nenhum item pendente.</p>}
            {novaCategoria ? <NovaCategoria projetoId={projeto.id} aoFechar={() => setNovaCategoria(false)} /> : <div><Botao onClick={() => setNovaCategoria(true)}><Plus size={15} /> Nova categoria</Botao></div>}
          </div>
        </>
      )}
    </div>
  );
}
