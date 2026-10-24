// Projeto de exemplo, para conhecer o app antes de começar o próprio TCC.
// Autores, títulos e números são fictícios: servem só para mostrar como cada seção funciona.

import { db, novoId, agora, type Projeto, type Fonte, type Fichamento, type Etapa, type Tarefa, type Orientacao, type Tag, type TextoFonte } from './db.ts';
import { definirProjetoAtivo } from './projetos.ts';
import { contarPalavras } from './textos.ts';

export const NOME_EXEMPLO = 'Exemplo: IGRT na radioterapia de próstata';

/** Data AAAA-MM-DD a tantos dias de hoje (para os prazos do exemplo fazerem sentido em qualquer dia). */
function dia(deslocamento: number): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocamento);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const TEXTO_SILVA =
  'A verificação diária com cone beam CT reduziu os erros sistemáticos de posicionamento para menos de dois milímetros em todas as direções. ' +
  'O deslocamento da próstata em relação às estruturas ósseas ocorre principalmente no sentido anteroposterior e está relacionado ao enchimento ' +
  'do reto e da bexiga. Com a correção antes de cada fração, as margens do PTV puderam ser reduzidas sem perda de cobertura do volume alvo.';

export async function criarProjetoExemplo(): Promise<Projeto> {
  const t = agora();
  const projeto: Projeto = {
    id: novoId(), nome: NOME_EXEMPLO, exemplo: true,
    tema: 'Erros de posicionamento e margens de PTV com cone beam CT',
    objetivoGeral: 'Comparar os erros de posicionamento com imagem diária e semanal no tratamento de próstata.',
    dataInicio: dia(-75), prazoFinal: dia(150), criadoEm: t, atualizadoEm: t,
  };
  const P = projeto.id;
  const datas = { criadoEm: t, atualizadoEm: t };

  const tag = (nome: string): Tag => ({ id: novoId(), projetoId: P, nome, criadoEm: t });
  const [tPos, tPtv, tDose] = [tag('Posicionamento'), tag('Margens de PTV'), tag('Dose de imagem')];

  const fonte = (f: Partial<Fonte> & Pick<Fonte, 'tipo' | 'titulo' | 'statusLeitura'>, autores: [string, string][]): Fonte => ({
    id: novoId(), projetoId: P, palavrasChave: [], tagIds: [], resumo: {}, origemMetadados: 'manual', statusCampos: {},
    autores: autores.map(([sobrenome, prenomes]) => ({ tipo: 'pessoa' as const, sobrenome, prenomes })), ...datas, ...f,
  });
  const fSilva = fonte({ tipo: 'artigo_periodico', prioridade: 'alta', acesso: 'gratuito', titulo: 'Erros de posicionamento na radioterapia de próstata guiada por cone beam CT', ano: 2021, veiculo: 'Revista Brasileira de Física Médica', volume: '15', numero: '2', paginas: '45-58', localPublicacao: 'São Paulo', statusLeitura: 'lido', tagIds: [tPos.id], palavrasChave: ['IGRT', 'cone beam CT', 'próstata'] }, [['Silva', 'Maria Clara'], ['Souza', 'João']]);
  const fLima = fonte({ tipo: 'livro', prioridade: 'media', acesso: 'pago', titulo: 'Física da radioterapia guiada por imagem', ano: 2019, edicao: '2', localPublicacao: 'Rio de Janeiro', editora: 'Editora Científica', statusLeitura: 'revisado', tagIds: [tPtv.id], palavrasChave: ['IGRT'] }, [['Lima', 'Ana Paula']]);
  const fCosta = fonte({ tipo: 'artigo_periodico', prioridade: 'alta', acesso: 'gratuito', titulo: 'Margens de PTV com imagem diária e semanal no tratamento de próstata', ano: 2022, veiculo: 'Revista Brasileira de Cancerologia', volume: '68', numero: '1', statusLeitura: 'lendo', tagIds: [tPtv.id], palavrasChave: ['margens', 'PTV'] }, [['Costa', 'Rafael'], ['Nunes', 'Beatriz'], ['Pereira', 'Lucas']]);
  const fFerreira = fonte({ tipo: 'artigo_periodico', prioridade: 'media', acesso: 'pago', titulo: 'Dose de imagem do cone beam CT em protocolos de próstata', ano: 2020, veiculo: 'Cadernos de Física Médica', statusLeitura: 'nao_iniciado', tagIds: [tDose.id] }, [['Ferreira', 'Juliana']]);
  const fAlmeida = fonte({ tipo: 'livro', prioridade: 'baixa', titulo: 'Protocolos de verificação de posicionamento em radioterapia', ano: 2018, localPublicacao: 'São Paulo', editora: 'Atlas', statusLeitura: 'lido', tagIds: [tPos.id], palavrasChave: ['protocolos'] }, [['Almeida', 'Carlos']]);

  const ficha = (f: Partial<Fichamento> & Pick<Fichamento, 'fonteId' | 'tipo'>): Fichamento => ({ id: novoId(), projetoId: P, tagIds: [], ...datas, ...f });
  const fichas = [
    ficha({ fonteId: fSilva.id, tipo: 'citacao_direta', trechoOriginal: 'A verificação diária com cone beam CT reduziu os erros sistemáticos de posicionamento para menos de dois milímetros em todas as direções.', pagina: '47', interpretacao: 'Usar para justificar a imagem diária no capítulo de discussão.', tema: 'Posicionamento', capituloSecao: '2 Referencial teórico', tagIds: [tPos.id] }),
    ficha({ fonteId: fLima.id, tipo: 'citacao_indireta', parafrase: 'As margens do PTV podem ser reduzidas quando a correção de posicionamento é feita antes de cada fração.', pagina: '112', tema: 'Margens de PTV', capituloSecao: '2 Referencial teórico', tagIds: [tPtv.id] }),
    ficha({ fonteId: fCosta.id, tipo: 'dado_relevante', trechoOriginal: 'Com imagem semanal, 30% das frações apresentaram deslocamento anteroposterior maior que 5 mm.', pagina: '6', tema: 'Margens de PTV', capituloSecao: '1 Introdução', tagIds: [tPtv.id] }),
    ficha({ fonteId: fAlmeida.id, tipo: 'ideia', interpretacao: 'Comparar o protocolo do serviço com o protocolo de ação proposto pelo autor.', tema: 'Método', capituloSecao: '3 Metodologia', tagIds: [tPos.id] }),
  ];

  const etapa = (nome: string, ordem: number, ini: number, fim: number): Etapa => ({ id: novoId(), projetoId: P, nome, ordem, dataInicio: dia(ini), dataFim: dia(fim), ...datas });
  const etapas = [
    etapa('Projeto de pesquisa', 0, -75, -30), etapa('Revisão de literatura', 1, -40, 15),
    etapa('Coleta dos dados de posicionamento', 2, 16, 60), etapa('Análise e escrita', 3, 50, 140),
  ];
  const tarefa = (etapaIdx: number, titulo: string, prazo: number, status: Tarefa['status'], prioridade: Tarefa['prioridade'] = 'media'): Tarefa => ({
    id: novoId(), projetoId: P, etapaId: etapas[etapaIdx].id, titulo, prazo: dia(prazo), prioridade, status, ...datas,
    ...(status === 'concluida' ? { concluidaEm: t } : {}),
  });
  const tarefas = [
    tarefa(0, 'Definir a pergunta de pesquisa', -60, 'concluida'),
    tarefa(0, 'Entregar o projeto ao orientador', -30, 'concluida', 'alta'),
    tarefa(1, 'Fichar os artigos sobre erros de posicionamento', 5, 'em_andamento', 'alta'),
    tarefa(1, 'Comparar protocolos de imagem diária e semanal', 15, 'a_fazer', 'alta'),
    tarefa(2, 'Submeter ao Comitê de Ética', 20, 'a_fazer', 'alta'),
    tarefa(2, 'Levantar os deslocamentos registrados no sistema', 55, 'a_fazer'),
    tarefa(3, 'Calcular as margens pela fórmula de van Herk', 100, 'a_fazer'),
  ];
  const orientacoes: Orientacao[] = [
    { id: novoId(), projetoId: P, titulo: 'Incluir a dose de imagem do CBCT na discussão', descricao: 'Comparar o ganho em precisão com a dose adicional.', dataFeedback: dia(-7), origem: 'reuniao', capituloSecao: '4 Discussão', prioridade: 'alta', prazo: dia(10), status: 'em_andamento', tarefaId: tarefas[3].id, ...datas },
    { id: novoId(), projetoId: P, titulo: 'Ajustar o objetivo geral', dataFeedback: dia(-25), origem: 'email', capituloSecao: '1 Introdução', prioridade: 'media', status: 'concluida', ...datas },
  ];
  const texto: TextoFonte = { id: fSilva.id, projetoId: P, origem: 'pdf', texto: TEXTO_SILVA, nomeArquivo: 'exemplo.pdf', paginas: 14, palavras: contarPalavras(TEXTO_SILVA), criadoEm: t };

  await db.transaction('rw', [db.projetos, db.tags, db.fontes, db.fichamentos, db.etapas, db.tarefas, db.orientacoes, db.textos], async () => {
    await db.projetos.add(projeto);
    await db.tags.bulkAdd([tPos, tPtv, tDose]);
    await db.fontes.bulkAdd([fSilva, fLima, fCosta, fFerreira, fAlmeida]);
    await db.fichamentos.bulkAdd(fichas);
    await db.etapas.bulkAdd(etapas);
    await db.tarefas.bulkAdd(tarefas);
    await db.orientacoes.bulkAdd(orientacoes);
    await db.textos.add(texto);
  });
  await definirProjetoAtivo(projeto.id);
  return projeto;
}
