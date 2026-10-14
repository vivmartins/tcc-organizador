// Textos de ajuda de cada seção. Ficam todos aqui para facilitar a revisão.

export type Secao = 'visao' | 'biblioteca' | 'fichamentos' | 'planejamento' | 'orientacoes' | 'conferencia' | 'dados';

export interface TextoAjuda {
  titulo: string;
  paraQue: string;
  passos: string[];
  exemplo?: string;
}

export const AJUDA: Record<Secao, TextoAjuda> = {
  visao: {
    titulo: 'Para que serve a Visão geral',
    paraQue: 'É o painel do seu TCC: mostra, num relance, quantas fontes e fichas você já tem, quanto falta para a entrega e o que foi feito por último.',
    passos: [
      'Os números são calculados a partir do que você cadastrou. Nada aqui é estimado.',
      'Clique nos cartões para ir direto à seção correspondente.',
      'Use os botões de atalho para cadastrar uma fonte, anotar algo ou gerar referências.',
    ],
  },
  biblioteca: {
    titulo: 'Para que serve a Biblioteca',
    paraQue: 'É onde ficam todos os textos que você usa no TCC: artigos, livros, teses, documentos e sites. Cada fonte guarda os dados necessários para a referência ABNT.',
    passos: [
      'Clique em “Cadastrar fonte” e preencha o que souber. O que faltar será apontado depois.',
      'Abra uma fonte para ver a referência ABNT pronta, conferir os dados e registrar o resumo do estudo.',
      'Use tags (temas) para agrupar fontes por assunto e o status para controlar o que já leu.',
      'Marque várias fontes e clique em “Copiar referências” para colar a lista, em ordem alfabética, no seu documento.',
    ],
    exemplo: 'Ex.: cadastre o artigo “Humanização em radioterapia” com a tag “Humanização” e o status “Lendo”.',
  },
  fichamentos: {
    titulo: 'Para que serve a aba Fichamentos',
    paraQue: 'É o seu caderno de anotações sobre cada texto lido. Cada ficha guarda um trecho, ideia ou dado importante, ligado ao artigo de onde veio e à página, para você não precisar reler tudo na hora de escrever.',
    passos: [
      'Crie uma ficha pela página da fonte (aba Fichamentos) ou aqui, escolhendo a fonte.',
      'Na citação direta, cole o trecho exatamente como está no texto e informe a página.',
      'Anote sua interpretação e o capítulo do TCC em que pretende usar.',
      'Na hora de escrever, filtre pelo capítulo e use “copiar” para levar o trecho já com a citação ABNT.',
    ],
    exemplo: 'Ex.: “A comunicação clara reduz a ansiedade do paciente” (Silva, 2021, p. 47) → Capítulo 2.1 Humanização.',
  },
  planejamento: {
    titulo: 'Para que serve o Planejamento',
    paraQue: 'Organiza as etapas, tarefas e prazos do seu TCC e mostra o progresso com base nas tarefas que você concluiu.',
    passos: [
      'Comece pelo “planejamento sugerido” para revisão de literatura ou crie as suas etapas do zero. Tudo é editável.',
      'Etapas agrupam tarefas e marcam entregas intermediárias (ex.: versão para o orientador).',
      'Marque a caixinha da tarefa ao concluir. O progresso e os alertas de atraso se atualizam sozinhos.',
      'Use o Cronograma para ver as etapas no tempo, com o dia de hoje e a entrega final marcados.',
    ],
    exemplo: 'Ex.: etapa “Leitura e fichamento” de 01/11 a 15/12, com a tarefa “Ler os artigos sobre comunicação” para 20/11.',
  },
  orientacoes: {
    titulo: 'Para que serve a aba Orientações',
    paraQue: 'Registra o que o seu orientador pediu, em reuniões, e-mails ou comentários, e acompanha o que já foi ajustado.',
    passos: ['Esta seção chega numa próxima atualização.'],
  },
  conferencia: {
    titulo: 'Para que serve a Conferência final',
    paraQue: 'Um checklist para preparar a entrega: dados das fontes, referências, capítulos, orientações, formatação e arquivos.',
    passos: [
      'Comece pelo checklist sugerido ou crie o seu. Adapte os itens às exigências da sua instituição.',
      'Use a “Situação atual do projeto” para saber o que ainda falta: fontes com dados faltando, dados não conferidos e tarefas pendentes.',
      'Marque cada item quando concluir. “Mostrar só pendentes” ajuda a focar no que falta.',
      'O app não confere o documento do TCC automaticamente: os itens são marcados por você.',
    ],
  },
  dados: {
    titulo: 'Por que fazer backup',
    paraQue: 'Seus dados ficam guardados só neste navegador, neste computador. Nada vai para a internet. Por isso, o backup é a sua cópia de segurança.',
    passos: [
      'Clique em “Baixar backup agora” e guarde o arquivo no Google Drive, num pendrive ou no seu e-mail.',
      'Faça backup com frequência, por exemplo uma vez por semana. O app avisa quando estiver atrasado.',
      'Para usar em outro computador, abra o app lá e use “Restaurar backup” com o arquivo.',
    ],
  },
};
