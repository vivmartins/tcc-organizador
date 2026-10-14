import { Link } from 'react-router-dom';
import { LayoutDashboard, Library, NotebookPen, CalendarCheck, MessagesSquare, ListChecks, HardDriveDownload, ShieldCheck } from 'lucide-react';
import { CabecalhoPagina, Cartao, Selo } from '../componentes/base.tsx';

const SECOES = [
  { icone: LayoutDashboard, nome: 'Visão geral', para: '/', texto: 'O painel do TCC: números reais, prazo de entrega e o que você fez por último.', pronta: true },
  { icone: Library, nome: 'Biblioteca', para: '/biblioteca', texto: 'Cadastre artigos, livros e outros textos. Cada fonte gera a referência ABNT e mostra o que falta conferir.', pronta: true },
  { icone: NotebookPen, nome: 'Fichamentos', para: '/fichamentos', texto: 'Suas anotações de leitura: citações com página, resumos, ideias e dados, ligados à fonte e ao capítulo do TCC.', pronta: true },
  { icone: CalendarCheck, nome: 'Planejamento', para: '/planejamento', texto: 'Etapas, tarefas e prazos, com cronograma e o progresso calculado pelo que você concluiu.', pronta: true },
  { icone: MessagesSquare, nome: 'Orientações', para: '/orientacoes', texto: 'O que o orientador pediu, com prazos, status e vínculo com as tarefas do planejamento.', pronta: true },
  { icone: ListChecks, nome: 'Conferência final', para: '/conferencia', texto: 'Checklist editável para preparar a entrega, com a situação atual dos seus cadastros.', pronta: true },
  { icone: HardDriveDownload, nome: 'Backup e dados', para: '/dados', texto: 'Baixe uma cópia de segurança dos seus dados ou recupere um backup.', pronta: true },
];

const PASSOS = [
  ['Cadastre suas fontes', 'Na Biblioteca, registre os textos que vai usar. Preencha o que souber.'],
  ['Confira os dados e gere as referências', 'Cada fonte mostra a referência ABNT e aponta o que está faltando ou precisa ser conferido.'],
  ['Fiche enquanto lê', 'Registre trechos, ideias e dados com a página e o capítulo onde vai usá-los.'],
  ['Escreva com tudo à mão', 'Filtre as fichas pelo capítulo e copie os trechos já com a citação no formato ABNT.'],
  ['Faça backup', 'Seus dados ficam só neste navegador. Guarde uma cópia toda semana.'],
];

export function ComoFunciona() {
  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo="Como funciona" descricao="O Organizador de TCC centraliza suas fontes, anotações e prazos. Ele não escreve o TCC por você: ele organiza o caminho." />

      <Cartao className="p-5 sm:p-6">
        <h2 className="text-sm font-semibold">O caminho sugerido</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {PASSOS.map(([t, d], i) => (
            <li key={t} className="flex gap-3 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-acao-50 text-xs font-semibold text-acao-700">{i + 1}</span>
              <span><span className="font-medium">{t}</span><span className="block text-cinza-600">{d}</span></span>
            </li>
          ))}
        </ol>
      </Cartao>

      <h2 className="mb-3 mt-8 text-sm font-semibold">O que cada seção faz</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {SECOES.map(({ icone: Icone, nome, para, texto, pronta }) => (
          <Link key={nome} to={para} className="rounded-lg border border-borda bg-superficie p-4 hover:border-borda-forte">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icone size={16} className="text-acao-600" /> {nome}
              {!pronta && <Selo className="ml-auto">em breve</Selo>}
            </span>
            <span className="mt-1.5 block text-sm leading-relaxed text-cinza-600">{texto}</span>
          </Link>
        ))}
      </div>

      <Cartao className="mt-8 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-sucesso-700" /> Onde ficam os seus dados</h2>
        <p className="mt-2 text-sm leading-relaxed text-marinho-700">
          Tudo o que você cadastra fica guardado <strong className="font-medium">só no navegador deste computador</strong>. Nada é enviado para servidores, e ninguém além de você tem acesso. Isso também significa que:
        </p>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-marinho-700">
          <li>Use sempre o mesmo navegador e o mesmo endereço do app.</li>
          <li>Limpar os dados de navegação ou usar janela anônima apaga ou não guarda o que você fizer.</li>
          <li>Para não perder nada, faça <Link to="/dados" className="text-acao-700 hover:underline">backup</Link> com frequência. É ele que leva seus dados para outro computador.</li>
        </ul>
      </Cartao>

      <p className="mt-6 text-xs leading-relaxed text-cinza-500">
        As referências seguem a ABNT NBR 6023:2018 e as citações, a NBR 10520:2023. Uma referência formatada não é automaticamente correta: confira sempre os dados com a publicação original e com as normas da sua instituição.
      </p>
    </div>
  );
}
