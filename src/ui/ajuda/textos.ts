// Textos de ajuda de cada seção. Ficam todos aqui para facilitar a revisão.

export type Secao = 'visao' | 'biblioteca' | 'fichamentos' | 'planejamento' | 'orientacoes' | 'conferencia' | 'auditoria' | 'dados';

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
      'Clique em “Cadastrar fonte”. Se tiver o DOI, o link do artigo ou o PDF, use “Preencher automaticamente”; senão, preencha o que souber.',
      'PDF sem DOI: a plataforma lê da primeira página o título, a autoria, o ano e, quando estiverem escritos, o periódico, volume e páginas (em teses e TCCs, também a instituição, o local e o tipo do trabalho). Depois procura o mesmo título no Crossref e no OpenAlex; se achar, você decide se usa os dados do DOI. Confira cada campo antes de salvar.',
      'Dados importados vêm marcados como “a conferir”: compare com a publicação antes de usar a referência.',
      'Abra uma fonte para ver a referência ABNT pronta, conferir os dados e registrar o resumo do estudo.',
      'Use tags (temas) para agrupar fontes por assunto e o status para controlar o que já leu. O app sugere temas seus que combinam com cada fonte; é só clicar para adicionar.',
      'Palavras-chave: ao importar um PDF, a plataforma usa as palavras-chave dos autores em português. Termos em outro idioma (do PDF ou do OpenAlex) são traduzidos pelo tradutor do próprio Chrome/Edge ou, se ele não estiver disponível, pelo serviço gratuito MyMemory (que recebe só esses termos curtos). Sem tradução, eles não são usados.',
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
    paraQue: 'Registra o que o seu orientador pediu, em reuniões, e-mails ou comentários nos documentos, e acompanha o que já foi ajustado.',
    passos: [
      'Depois de cada orientação, registre o assunto, o que foi pedido, o capítulo e o prazo.',
      'Marque “criar uma tarefa no Planejamento” ou vincule a uma tarefa existente, para não registrar a mesma coisa duas vezes.',
      'Ao ajustar, anote “o que você alterou”: é ótimo para mostrar na próxima reunião.',
      'Use as abas Pendentes, Prazo próximo e Concluídas para acompanhar as revisões.',
    ],
    exemplo: 'Ex.: “Reorganizar o capítulo 2” · reunião em 10/10 · prazo 24/10 · alterado: “juntei as seções 2.2 e 2.3”.',
  },
  conferencia: {
    titulo: 'Para que serve a Conferência final',
    paraQue: 'Um checklist para preparar a entrega: dados das fontes, referências, capítulos, orientações, formatação e arquivos.',
    passos: [
      'Comece pelo checklist sugerido ou crie o seu. Adapte os itens às exigências da sua instituição.',
      'Use a “Situação atual do projeto” para saber o que ainda falta: fontes com dados faltando, dados não conferidos e tarefas pendentes.',
      'Marque cada item quando concluir. “Mostrar só pendentes” ajuda a focar no que falta.',
      'Os itens são marcados por você. Para conferir citações e referências no arquivo do TCC, use a Auditoria do TCC.',
    ],
  },
  auditoria: {
    titulo: 'Para que serve a Auditoria do TCC',
    paraQue: 'Você envia o arquivo do TCC (Word ou PDF) e o app aponta pontos para conferir: citações sem referência, citações diretas diferentes do original e trechos parecidos demais com as suas fontes.',
    passos: [
      'Anexe o PDF de cada fonte (na página da fonte ou no quadro “Material das suas fontes”). O texto fica só no seu navegador; o arquivo não é guardado. Os trechos originais dos seus fichamentos também entram na comparação.',
      'Envie o arquivo do TCC. Ele é lido aqui mesmo e não é guardado: ao fechar a aba, o resultado some.',
      '“Citações e referências”: obras citadas sem referência, anos diferentes, referências nunca citadas e citações diretas sem página.',
      '“Citações diretas”: compara cada trecho entre aspas (ou recuado) com o seu fichamento e com o texto da fonte, palavra por palavra e pela página.',
      '“Semelhança com as fontes”: trechos iguais a uma fonte sem aspas e paráfrases muito próximas do original.',
      'É uma ajuda para revisar, não um veredito: a leitura automática pode errar, e a comparação é só com as fontes que você cadastrou (não com a internet).',
    ],
    exemplo: 'O app encontrou “(Silva, 2021)” no texto, mas a referência diz 2020: você confere qual é o ano certo e corrige no Word.',
  },
  dados: {
    titulo: 'Por que fazer backup',
    paraQue: 'Seus dados ficam guardados só neste navegador, neste computador. Nada vai para a internet. Por isso, o backup é a sua cópia de segurança.',
    passos: [
      'Clique em “Baixar backup agora” e guarde o arquivo no Google Drive, num pendrive ou no seu e-mail.',
      'Faça backup com frequência, por exemplo uma vez por semana. O app avisa quando estiver atrasado.',
      'Para usar em outro computador, abra o app lá e use “Restaurar backup” com o arquivo.',
      'No Chrome ou no Edge do computador, ligue o “Backup automático” e salve o arquivo na pasta do Google Drive: o app atualiza a cópia sozinho a cada alteração.',
    ],
  },
};
