import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookMarked } from 'lucide-react';
import { Botao, Campo, Entrada, AreaTexto, Cartao, CabecalhoPagina, BotaoLink } from '../componentes/base.tsx';
import { Confirmacao, useAvisos } from '../componentes/dialogos.tsx';
import { criarProjeto, atualizarProjeto, excluirProjeto, validarProjeto, type DadosProjeto } from '../../data/projetos.ts';
import { useProjeto } from '../projetoAtivo.tsx';
import type { Projeto } from '../../data/db.ts';

function FormularioProjeto({ inicial, textoBotao, aoSalvar }: { inicial?: Projeto | null; textoBotao: string; aoSalvar: (d: DadosProjeto) => Promise<void> }) {
  const [d, setD] = useState<DadosProjeto>({
    nome: inicial?.nome ?? '',
    tema: inicial?.tema ?? '',
    objetivoGeral: inicial?.objetivoGeral ?? '',
    dataInicio: inicial?.dataInicio ?? '',
    prazoFinal: inicial?.prazoFinal ?? '',
    etAlNasReferencias: inicial?.etAlNasReferencias ?? false,
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const mudar = (k: keyof DadosProjeto) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const problema = validarProjeto(d);
    setErro(problema);
    if (problema) return;
    setSalvando(true);
    try {
      await aoSalvar(d);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const erroNome = erro?.includes('nome') ? erro : undefined;
  const erroPrazo = erro?.includes('prazo') ? erro : undefined;

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <Campo rotulo="Nome do projeto" id="nome" obrigatorio erro={erroNome} dica="Ex.: TCC – Pós em Radioterapia">
        <Entrada id="nome" value={d.nome} onChange={mudar('nome')} aria-invalid={!!erroNome} autoFocus={!inicial} maxLength={120} />
      </Campo>
      <Campo rotulo="Tema" id="tema">
        <Entrada id="tema" value={d.tema} onChange={mudar('tema')} placeholder="Opcional" maxLength={300} />
      </Campo>
      <Campo rotulo="Objetivo geral" id="objetivo" dica="Pode deixar em branco se ainda não estiver definido.">
        <AreaTexto id="objetivo" value={d.objetivoGeral} onChange={mudar('objetivoGeral')} rows={3} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Data de início" id="inicio">
          <Entrada id="inicio" type="date" value={d.dataInicio} onChange={mudar('dataInicio')} />
        </Campo>
        <Campo rotulo="Prazo final de entrega" id="prazo" erro={erroPrazo}>
          <Entrada id="prazo" type="date" value={d.prazoFinal} onChange={mudar('prazoFinal')} aria-invalid={!!erroPrazo} />
        </Campo>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-marinho-700">
        <input type="checkbox" className="mt-0.5 size-4 accent-acao-600" checked={!!d.etAlNasReferencias} onChange={(e) => setD({ ...d, etAlNasReferencias: e.target.checked })} />
        <span>
          Nas referências, com 4 ou mais autores, indicar só o primeiro seguido de <em>et al.</em>
          <span className="block text-xs text-cinza-500">A NBR 6023 recomenda listar todos, mas permite o et al. Siga o que sua instituição pede.</span>
        </span>
      </label>
      {erro && !erroNome && !erroPrazo && <p role="alert" className="text-sm text-perigo-700">{erro}</p>}
      <div>
        <Botao type="submit" variante="primario" disabled={salvando}>{textoBotao}</Botao>
      </div>
    </form>
  );
}

/** Tela inicial quando ainda não existe nenhum projeto. */
export function BoasVindas() {
  const avisar = useAvisos();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-fundo px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2 text-marinho-900">
          <BookMarked size={22} className="text-acao-600" />
          <span className="text-lg font-semibold tracking-tight">Organizador de TCC</span>
        </div>
        <Cartao className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">Vamos começar pelo seu projeto</h1>
          <p className="mb-6 mt-1.5 text-sm leading-relaxed text-cinza-600">
            Tudo o que você cadastrar fica guardado <strong className="font-medium text-marinho-700">só neste navegador</strong>, neste computador. Nada é enviado para a internet. Por isso, faça backups de vez em quando (o app vai lembrar você).
          </p>
          <FormularioProjeto textoBotao="Criar projeto" aoSalvar={async (d) => { await criarProjeto(d); avisar('sucesso', 'Projeto criado.'); }} />
        </Cartao>
        <Cartao className="mt-4 p-6 sm:p-8">
          <h2 className="text-sm font-semibold">O que você pode fazer aqui</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-marinho-700">
            <li><strong className="font-medium">Biblioteca:</strong> guardar artigos, livros e teses, com a referência ABNT gerada automaticamente.</li>
            <li><strong className="font-medium">Fichamentos:</strong> anotar trechos, ideias e dados de cada leitura, com a página e o capítulo do TCC.</li>
            <li><strong className="font-medium">Visão geral:</strong> acompanhar quantas fontes já leu e quanto falta para a entrega.</li>
            <li><strong className="font-medium">Planejamento:</strong> organizar etapas, tarefas e prazos, com cronograma e alertas de atraso.</li>
            <li><strong className="font-medium">Em breve:</strong> registro das orientações e checklist de entrega.</li>
          </ul>
        </Cartao>
      </div>
    </div>
  );
}

export function NovoProjeto() {
  const navegar = useNavigate();
  const avisar = useAvisos();
  return (
    <div className="max-w-2xl">
      <CabecalhoPagina titulo="Novo projeto" descricao="Cada projeto tem sua própria biblioteca, fichamentos e planejamento." voltar={<BotaoLink para="/" variante="fantasma" className="-ml-2"><ArrowLeft size={16} /> Voltar</BotaoLink>} />
      <Cartao className="p-6">
        <FormularioProjeto textoBotao="Criar projeto" aoSalvar={async (d) => { await criarProjeto(d); avisar('sucesso', 'Projeto criado e aberto.'); navegar('/'); }} />
      </Cartao>
    </div>
  );
}

export function EditarProjeto() {
  const { projeto } = useProjeto();
  const avisar = useAvisos();
  const navegar = useNavigate();
  const [confirmando, setConfirmando] = useState(false);
  if (!projeto) return null;
  return (
    <div className="max-w-2xl">
      <CabecalhoPagina titulo="Dados do projeto" voltar={<BotaoLink para="/" variante="fantasma" className="-ml-2"><ArrowLeft size={16} /> Voltar</BotaoLink>} />
      <Cartao className="p-6">
        <FormularioProjeto key={projeto.id} inicial={projeto} textoBotao="Salvar alterações" aoSalvar={async (d) => { await atualizarProjeto(projeto.id, d); avisar('sucesso', 'Projeto atualizado.'); }} />
      </Cartao>
      <Cartao className="mt-6 border-perigo-700/20 p-6">
        <h2 className="text-sm font-semibold">Excluir projeto</h2>
        <p className="mb-4 mt-1 text-sm text-cinza-600">Apaga o projeto e todas as fontes, fichamentos, tarefas e orientações dele. Não dá para desfazer (a não ser restaurando um backup).</p>
        <Botao variante="perigo" onClick={() => setConfirmando(true)}>Excluir este projeto</Botao>
      </Cartao>
      <Confirmacao
        aberto={confirmando}
        titulo="Excluir projeto?"
        textoConfirmar="Excluir definitivamente"
        perigoso
        aoCancelar={() => setConfirmando(false)}
        aoConfirmar={async () => {
          setConfirmando(false);
          await excluirProjeto(projeto.id);
          avisar('sucesso', 'Projeto excluído.');
          navegar('/');
        }}
      >
        <p>O projeto <strong>{projeto.nome}</strong> e tudo o que pertence a ele serão apagados deste navegador.</p>
      </Confirmacao>
    </div>
  );
}
