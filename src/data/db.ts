// Banco de dados no próprio navegador (IndexedDB, via Dexie).
//
// Tudo o que a estudante cadastra fica guardado AQUI, no computador dela.
// Nada é enviado para servidores. Para não perder dados, há o backup
// (ver backup.ts).

import Dexie, { type EntityTable } from 'dexie';
import type { DadosBibliograficos, StatusCampo, CampoBibliografico } from '../domain/tipos.ts';

export type StatusLeitura = 'nao_iniciado' | 'lendo' | 'lido' | 'revisado';
export type OrigemMetadados = 'manual' | 'crossref' | 'openalex' | 'url' | 'pdf';
export type TipoFichamento = 'citacao_direta' | 'citacao_indireta' | 'resumo' | 'ideia' | 'dado_relevante';
export type Prioridade = 'baixa' | 'media' | 'alta';
export type StatusTarefa = 'a_fazer' | 'em_andamento' | 'concluida';
export type StatusOrientacao = 'pendente' | 'em_andamento' | 'concluida';

interface Datas {
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
}

export interface Projeto extends Datas {
  id: string;
  nome: string;
  tema?: string;
  objetivoGeral?: string;
  dataInicio?: string; // AAAA-MM-DD
  prazoFinal?: string; // AAAA-MM-DD
  /** Com 4+ autores, usar "et al." nas referências. */
  etAlNasReferencias?: boolean;
  /** Sobrenome em MAIÚSCULAS na citação entre parênteses: (SILVA, 2021). Padrão anterior à NBR 10520:2023, ainda pedido por algumas instituições. */
  citacaoMaiusculas?: boolean;
  /** Norma das referências e citações: ABNT (padrão) ou Vancouver. */
  normaReferencias?: 'abnt' | 'vancouver';
  /** Vancouver: número sobrescrito (padrão), entre parênteses ou entre colchetes. */
  chamadaVancouver?: 'sobrescrito' | 'parenteses' | 'colchetes';
  /** Projeto de exemplo, criado para conhecer o app. */
  exemplo?: boolean;
}

export interface ResumoEstudo {
  objetivo?: string;
  conceitos?: string;
  metodo?: string;
  resultados?: string;
  conclusoes?: string;
}

export interface Fonte extends DadosBibliograficos, Datas {
  id: string;
  projetoId: string;
  palavrasChave: string[];
  tagIds: string[];
  statusLeitura: StatusLeitura;
  observacoes?: string;
  resumo: ResumoEstudo;
  origemMetadados: OrigemMetadados;
  statusCampos: Partial<Record<CampoBibliografico, StatusCampo>>;
  /** Vancouver: número da obra na lista (ordem da primeira citação no TCC). */
  numeroVancouver?: number;
}

export interface Tag {
  id: string;
  projetoId: string;
  nome: string;
  criadoEm: string;
}

export interface Fichamento extends Datas {
  id: string;
  projetoId: string;
  fonteId: string;
  tipo: TipoFichamento;
  trechoOriginal?: string;
  pagina?: string;
  parafrase?: string;
  interpretacao?: string;
  tema?: string;
  capituloSecao?: string;
  tagIds: string[];
}

export interface Etapa extends Datas {
  id: string;
  projetoId: string;
  nome: string;
  ordem: number;
  dataInicio?: string;
  dataFim?: string;
}

export interface Tarefa extends Datas {
  id: string;
  projetoId: string;
  etapaId?: string;
  titulo: string;
  descricao?: string;
  prazo?: string;
  prioridade: Prioridade;
  status: StatusTarefa;
  concluidaEm?: string;
}

export interface Orientacao extends Datas {
  id: string;
  projetoId: string;
  titulo: string;
  descricao?: string;
  dataFeedback?: string;
  origem: 'reuniao' | 'email' | 'comentario_documento' | 'outro';
  capituloSecao?: string;
  prioridade: Prioridade;
  prazo?: string;
  status: StatusOrientacao;
  observacoesAlteracao?: string;
  tarefaId?: string;
}

export interface ChecklistItem extends Datas {
  id: string;
  projetoId: string;
  categoria: string;
  texto: string;
  concluido: boolean;
  ordem: number;
}

/** Texto completo (ou resumo) de uma fonte, usado na auditoria do TCC. Fica só no navegador. */
export interface TextoFonte {
  id: string; // = id da fonte
  projetoId: string;
  origem: 'pdf' | 'resumo';
  texto: string;
  nomeArquivo?: string;
  paginas?: number;
  palavras: number;
  criadoEm: string;
}

export interface Config {
  chave: string;
  valor: unknown;
}

export type BancoTcc = Dexie & {
  projetos: EntityTable<Projeto, 'id'>;
  fontes: EntityTable<Fonte, 'id'>;
  tags: EntityTable<Tag, 'id'>;
  fichamentos: EntityTable<Fichamento, 'id'>;
  etapas: EntityTable<Etapa, 'id'>;
  tarefas: EntityTable<Tarefa, 'id'>;
  orientacoes: EntityTable<Orientacao, 'id'>;
  checklist: EntityTable<ChecklistItem, 'id'>;
  config: EntityTable<Config, 'chave'>;
  textos: EntityTable<TextoFonte, 'id'>;
};

export const TABELAS_DO_PROJETO = ['fontes', 'tags', 'fichamentos', 'etapas', 'tarefas', 'orientacoes', 'checklist', 'textos'] as const;

export const db = new Dexie('tcc-organizador') as BancoTcc;

// Versão 1 do esquema. Só os campos indexados aparecem aqui
// (os demais são guardados normalmente, apenas não servem de índice).
db.version(1).stores({
  projetos: 'id, nome, atualizadoEm',
  fontes: 'id, projetoId, criadoEm, ano, statusLeitura, *tagIds',
  tags: 'id, projetoId',
  fichamentos: 'id, projetoId, fonteId, criadoEm, *tagIds',
  etapas: 'id, projetoId, ordem',
  tarefas: 'id, projetoId, etapaId, status, prazo',
  orientacoes: 'id, projetoId, status, prazo, tarefaId',
  checklist: 'id, projetoId, ordem',
  config: 'chave',
});

// Versão 2: textos das fontes para a auditoria (as tabelas antigas continuam iguais).
db.version(2).stores({ textos: 'id, projetoId' });

export const novoId = () => crypto.randomUUID();
export const agora = () => new Date().toISOString();
