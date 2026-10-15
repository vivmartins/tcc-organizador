// Entrada do app sem projeto: a pessoa conhece as seções antes de começar o próprio TCC.

import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Rocket, Sparkles, Library, NotebookPen, CalendarCheck, MessagesSquare, FileSearch, ListChecks, ShieldCheck, Upload, Lightbulb, X, Loader2 } from 'lucide-react';
import { Botao, BotaoLink, CabecalhoPagina, Cartao } from '../componentes/base.tsx';
import { useAvisos } from '../componentes/dialogos.tsx';
import { useProjeto } from '../projetoAtivo.tsx';
import { criarProjetoExemplo } from '../../data/exemplo.ts';
import { excluirProjeto } from '../../data/projetos.ts';
import { AJUDA, type Secao } from '../ajuda/textos.ts';

/** Botão que cria o projeto de exemplo e abre a Visão geral. */
function BotaoExemplo({ variante = 'secundario', children }: { variante?: 'primario' | 'secundario'; children?: ReactNode }) {
  const avisar = useAvisos();
  const navegar = useNavigate();
  const [criando, setCriando] = useState(false);
  return (
    <Botao
      variante={variante}
      disabled={criando}
      onClick={async () => {
        setCriando(true);
        try {
          await criarProjetoExemplo();
          avisar('sucesso', 'Projeto de exemplo aberto. Explore à vontade.');
          navegar('/');
        } catch (e) {
          avisar('erro', (e as Error).message);
        } finally {
          setCriando(false);
        }
      }}
    >
      {criando ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {children ?? 'Ver um projeto de exemplo'}
    </Botao>
  );
}

const SECOES = [
  { para: '/biblioteca', nome: 'Biblioteca', icone: Library, texto: 'Artigos e livros com a referência ABNT pronta.' },
  { para: '/fichamentos', nome: 'Fichamentos', icone: NotebookPen, texto: 'Trechos, ideias e dados com página e capítulo.' },
  { para: '/planejamento', nome: 'Planejamento', icone: CalendarCheck, texto: 'Etapas, tarefas, prazos e cronograma.' },
  { para: '/orientacoes', nome: 'Orientações', icone: MessagesSquare, texto: 'O que o orientador pediu, com prazo e status.' },
  { para: '/auditoria', nome: 'Auditoria do TCC', icone: FileSearch, texto: 'Confere citações e referências no arquivo do TCC.' },
  { para: '/conferencia', nome: 'Conferência final', icone: ListChecks, texto: 'Checklist para a entrega.' },
];

/** Visão geral quando ainda não há projeto. */
export function Inicio() {
  return (
    <div className="max-w-4xl">
      <p className="text-sm font-semibold text-acao-700">Gestão do trabalho de conclusão de curso</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-marinho-900 sm:text-4xl">Boas-vindas ao Organizador de TCC</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-cinza-600">
        Fontes, fichamentos, referências ABNT, prazos e orientações num só lugar. Dê uma olhada em cada seção e, quando quiser, comece o seu projeto.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Cartao className="flex flex-col p-6">
          <span className="flex size-10 items-center justify-center rounded-md bg-acao-600 text-white"><Rocket size={19} /></span>
          <h2 className="mt-4 text-lg font-bold">Iniciar meu projeto</h2>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-cinza-600">Coloque o nome do TCC e, se quiser, o tema e a data de entrega. O resto você preenche aos poucos.</p>
          <BotaoLink para="/projeto/novo" variante="primario" className="mt-5 self-start">Iniciar meu projeto</BotaoLink>
        </Cartao>
        <Cartao className="flex flex-col p-6">
          <span className="flex size-10 items-center justify-center rounded-md bg-acao-50 text-acao-700"><Sparkles size={19} /></span>
          <h2 className="mt-4 text-lg font-bold">Ver um projeto de exemplo</h2>
          <p className="mt-1 flex-1 text-sm leading-relaxed text-cinza-600">Abre um TCC fictício já preenchido, com fontes, fichas, tarefas e orientações, para você ver tudo funcionando. Dá para apagar depois.</p>
          <div className="mt-5"><BotaoExemplo /></div>
        </Cartao>
      </div>

      <h2 className="mb-3 mt-10 text-sm font-semibold">Conheça cada seção</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECOES.map(({ para, nome, icone: Icone, texto }) => (
          <Link key={para} to={para} className="rounded-lg border border-borda bg-superficie p-4 hover:border-borda-forte">
            <span className="flex items-center gap-2 text-sm font-semibold"><Icone size={16} className="text-acao-600" /> {nome}</span>
            <span className="mt-1 block text-sm text-cinza-600">{texto}</span>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-3 text-sm text-cinza-600 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-sucesso-700" /> Tudo fica guardado só neste navegador. Sem conta, sem senha e sem custo.</p>
        <Link to="/dados" className="flex items-center gap-1.5 font-medium text-acao-700 hover:underline"><Upload size={15} /> Já tenho um backup</Link>
      </div>
    </div>
  );
}

/** No lugar de uma seção que precisa de projeto: explica a seção e oferece começar. */
export function SemProjeto({ secao, titulo }: { secao: Secao; titulo: string }) {
  const t = AJUDA[secao];
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo={titulo} />
      <Cartao className="p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Lightbulb size={16} className="text-acao-600" /> {t.titulo}</h2>
        <p className="mt-2 text-sm leading-relaxed text-marinho-700">{t.paraQue}</p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-marinho-700">
          {t.passos.map((p) => (
            <li key={p} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-acao-600" />{p}</li>
          ))}
        </ul>
        {t.exemplo && <p className="mt-3 text-xs italic text-cinza-600">{t.exemplo}</p>}
      </Cartao>
      <Cartao className="mt-4 p-6">
        <p className="text-sm font-semibold">Esta seção usa os dados do seu projeto.</p>
        <p className="mt-1 text-sm text-cinza-600">Comece o seu ou abra o exemplo para ver como ela fica preenchida.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <BotaoLink para="/projeto/novo" variante="primario"><Rocket size={15} /> Iniciar meu projeto</BotaoLink>
          <BotaoExemplo />
        </div>
      </Cartao>
    </div>
  );
}

/** Mostra a seção quando há projeto; senão, a explicação com os botões. */
export function ExigeProjeto({ secao, titulo, children }: { secao: Secao; titulo: string; children: ReactNode }) {
  const { projeto } = useProjeto();
  return projeto ? <>{children}</> : <SemProjeto secao={secao} titulo={titulo} />;
}

/** Faixa no topo enquanto o projeto aberto é o de exemplo. */
export function AvisoExemplo() {
  const { projeto } = useProjeto();
  const avisar = useAvisos();
  const navegar = useNavigate();
  if (!projeto?.exemplo) return null;
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-acao-100 bg-acao-50 px-4 py-3 text-sm sm:flex-row sm:items-center">
      <p className="flex flex-1 items-start gap-2 text-marinho-700">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-acao-600" />
        <span>Você está vendo um <strong className="font-semibold">projeto de exemplo</strong>, com dados fictícios. Mexa à vontade: nada aqui é seu.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <BotaoLink para="/projeto/novo" variante="primario"><Rocket size={14} /> Iniciar meu projeto</BotaoLink>
        <Botao
          variante="fantasma"
          onClick={async () => {
            await excluirProjeto(projeto.id);
            avisar('sucesso', 'Exemplo apagado.');
            navegar('/');
          }}
        >
          <X size={14} /> Apagar o exemplo
        </Botao>
      </div>
    </div>
  );
}
