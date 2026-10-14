// Regras do planejamento: progresso, situação dos prazos e planejamento sugerido.
// Datas no formato AAAA-MM-DD (sem horário, para não sofrer com fuso).

export type StatusTarefa = 'a_fazer' | 'em_andamento' | 'concluida';
export type Prioridade = 'baixa' | 'media' | 'alta';

export interface TarefaBase {
  id?: string;
  etapaId?: string;
  titulo: string;
  prazo?: string;
  prioridade: Prioridade;
  status: StatusTarefa;
}

export interface EtapaBase {
  id?: string;
  nome: string;
  ordem: number;
  dataInicio?: string;
  dataFim?: string;
}

export const ROTULO_STATUS_TAREFA: Record<StatusTarefa, string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
};
export const ROTULO_PRIORIDADE: Record<Prioridade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

// ---------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------
const DIA = 86_400_000;
const paraUtc = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
export const paraIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const diasEntre = (de: string, ate: string) => Math.round((paraUtc(ate) - paraUtc(de)) / DIA);
export const somarDias = (iso: string, n: number) => paraIso(paraUtc(iso) + n * DIA);

// ---------------------------------------------------------------------
// Situação e progresso
// ---------------------------------------------------------------------
export type Situacao = 'concluida' | 'atrasada' | 'vence_em_breve' | 'no_prazo' | 'sem_prazo';
export const DIAS_PARA_ALERTA = 7;

export function situacaoTarefa(t: TarefaBase, hoje: string): Situacao {
  if (t.status === 'concluida') return 'concluida';
  if (!t.prazo) return 'sem_prazo';
  const d = diasEntre(hoje, t.prazo);
  if (d < 0) return 'atrasada';
  if (d <= DIAS_PARA_ALERTA) return 'vence_em_breve';
  return 'no_prazo';
}

export interface Progresso {
  total: number;
  concluidas: number;
  /** 0 a 100, arredondado. null quando não há tarefas (não dá para medir). */
  percentual: number | null;
}

export function progresso(tarefas: TarefaBase[]): Progresso {
  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => t.status === 'concluida').length;
  return { total, concluidas, percentual: total ? Math.round((concluidas / total) * 100) : null };
}

export function progressoPorEtapa<E extends EtapaBase & { id: string }>(etapas: E[], tarefas: TarefaBase[]) {
  return [...etapas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((e) => ({ etapa: e, ...progresso(tarefas.filter((t) => t.etapaId === e.id)) }));
}

/** Etapa em andamento hoje; se nenhuma cobrir a data, a primeira com tarefas pendentes. */
export function etapaAtual<E extends EtapaBase & { id: string }>(etapas: E[], tarefas: TarefaBase[], hoje: string): E | null {
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const pelaData = ordenadas.find((e) => e.dataInicio && e.dataFim && e.dataInicio <= hoje && hoje <= e.dataFim);
  if (pelaData) return pelaData;
  return ordenadas.find((e) => tarefas.some((t) => t.etapaId === e.id && t.status !== 'concluida')) ?? null;
}

/** Ordena para a lista: pendentes primeiro (atrasadas, depois por prazo e prioridade), concluídas no fim. */
export function ordenarTarefas<T extends TarefaBase>(tarefas: T[]): T[] {
  const peso: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };
  return [...tarefas].sort((a, b) => {
    const ca = a.status === 'concluida' ? 1 : 0;
    const cb = b.status === 'concluida' ? 1 : 0;
    if (ca !== cb) return ca - cb;
    const pa = a.prazo ?? '9999-12-31';
    const pb = b.prazo ?? '9999-12-31';
    if (pa !== pb) return pa.localeCompare(pb);
    if (peso[a.prioridade] !== peso[b.prioridade]) return peso[a.prioridade] - peso[b.prioridade];
    return a.titulo.localeCompare(b.titulo, 'pt-BR');
  });
}

export function validarEtapa(e: EtapaBase): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!e.nome.trim()) erros.nome = 'Informe o nome da etapa.';
  if (e.dataInicio && e.dataFim && e.dataFim < e.dataInicio) erros.dataFim = 'A data final não pode ser anterior à inicial.';
  return erros;
}

export function validarTarefa(t: TarefaBase): Record<string, string> {
  return t.titulo.trim() ? {} : { titulo: 'Informe o título da tarefa.' };
}

// ---------------------------------------------------------------------
// Planejamento sugerido (revisão de literatura). Tudo pode ser editado depois.
// ---------------------------------------------------------------------
interface ModeloEtapa {
  nome: string;
  peso: number; // fração do tempo total
  tarefas: [string, Prioridade][];
}

export const MODELO_REVISAO: ModeloEtapa[] = [
  { nome: 'Definição do tema e do problema', peso: 0.1, tarefas: [['Definir o tema e a pergunta de pesquisa', 'alta'], ['Escrever o objetivo geral e os específicos', 'alta'], ['Validar o recorte com o orientador', 'media']] },
  { nome: 'Levantamento bibliográfico', peso: 0.2, tarefas: [['Definir descritores e bases de dados (ex.: SciELO, LILACS, PubMed)', 'alta'], ['Buscar e selecionar as publicações', 'alta'], ['Cadastrar as fontes na Biblioteca', 'media']] },
  { nome: 'Leitura e fichamento', peso: 0.25, tarefas: [['Ler as fontes selecionadas', 'alta'], ['Registrar fichamentos com página e capítulo', 'media'], ['Conferir os dados bibliográficos', 'media']] },
  { nome: 'Redação', peso: 0.3, tarefas: [['Escrever a introdução', 'alta'], ['Escrever o desenvolvimento (revisão de literatura)', 'alta'], ['Escrever as considerações finais', 'alta']] },
  { nome: 'Revisão e ajustes', peso: 0.1, tarefas: [['Aplicar as orientações recebidas', 'alta'], ['Revisar a lista de referências', 'media'], ['Revisar a formatação exigida pela instituição', 'media']] },
  { nome: 'Entrega final', peso: 0.05, tarefas: [['Gerar o arquivo final', 'alta'], ['Entregar o TCC', 'alta']] },
];

export interface EtapaSugerida {
  nome: string;
  ordem: number;
  dataInicio: string;
  dataFim: string;
  tarefas: { titulo: string; prioridade: Prioridade; prazo: string }[];
}

/** Distribui as etapas do modelo entre a data de início e o prazo final. */
export function sugerirPlanejamento(inicio: string, fim: string, modelo = MODELO_REVISAO): EtapaSugerida[] {
  const totalDias = diasEntre(inicio, fim);
  if (totalDias < modelo.length) throw new Error(`O intervalo entre o início e a entrega precisa ter pelo menos ${modelo.length} dias.`);
  const somaPesos = modelo.reduce((s, e) => s + e.peso, 0);
  let cursor = 0;
  let acumulado = 0;
  return modelo.map((m, i) => {
    acumulado += m.peso / somaPesos;
    const ultimo = i === modelo.length - 1;
    const fimEtapa = ultimo ? totalDias : Math.max(cursor, Math.round(acumulado * totalDias) - 1);
    const etapa: EtapaSugerida = {
      nome: m.nome,
      ordem: i,
      dataInicio: somarDias(inicio, cursor),
      dataFim: somarDias(inicio, fimEtapa),
      tarefas: m.tarefas.map(([titulo, prioridade]) => ({ titulo, prioridade, prazo: somarDias(inicio, fimEtapa) })),
    };
    cursor = fimEtapa + 1;
    return etapa;
  });
}

// ---------------------------------------------------------------------
// Cronograma: posição de cada barra entre o início e o fim do período (0–100%)
// ---------------------------------------------------------------------
export function periodoDoCronograma(datas: (string | undefined)[], inicioProjeto?: string, fimProjeto?: string): { inicio: string; fim: string } | null {
  const todas = [inicioProjeto, fimProjeto, ...datas].filter((d): d is string => !!d).sort();
  if (todas.length === 0) return null;
  let inicio = inicioProjeto ?? todas[0];
  let fim = fimProjeto ?? todas[todas.length - 1];
  if (todas[0] < inicio) inicio = todas[0];
  if (todas[todas.length - 1] > fim) fim = todas[todas.length - 1];
  if (inicio === fim) fim = somarDias(fim, 1);
  return { inicio, fim };
}

export function posicaoNoPeriodo(data: string, periodo: { inicio: string; fim: string }): number {
  const total = diasEntre(periodo.inicio, periodo.fim);
  return Math.min(100, Math.max(0, (diasEntre(periodo.inicio, data) / total) * 100));
}
