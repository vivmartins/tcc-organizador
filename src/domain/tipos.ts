// Tipos centrais do domínio (independentes de banco ou interface).

export type TipoPublicacao =
  | 'artigo_periodico'
  | 'livro'
  | 'capitulo_livro'
  | 'tese'
  | 'dissertacao'
  | 'tcc_monografia'
  | 'trabalho_evento'
  | 'documento_institucional'
  | 'legislacao'
  | 'pagina_web'
  | 'outro';

export const ROTULO_TIPO: Record<TipoPublicacao, string> = {
  artigo_periodico: 'Artigo de periódico',
  livro: 'Livro',
  capitulo_livro: 'Capítulo de livro',
  tese: 'Tese',
  dissertacao: 'Dissertação',
  tcc_monografia: 'TCC / Monografia',
  trabalho_evento: 'Trabalho em evento',
  documento_institucional: 'Documento institucional',
  legislacao: 'Legislação',
  pagina_web: 'Página da web',
  outro: 'Outro',
};

/** Situação de um dado bibliográfico. */
export type StatusCampo = 'importado' | 'manual_nao_conferido' | 'verificado';

export interface Autor {
  tipo: 'pessoa' | 'entidade';
  /** Para pessoa: sobrenome de entrada (ex.: "Silva", "Silva Filho").
   *  Para entidade: nome completo (ex.: "Brasil. Ministério da Saúde"). */
  sobrenome: string;
  prenomes?: string;
}

export interface DadosBibliograficos {
  tipo: TipoPublicacao;
  titulo: string;
  subtitulo?: string;
  autores: Autor[];
  /** Organizadores/editores do livro (capítulo de livro). */
  organizadores?: Autor[];
  papelOrganizadores?: 'org.' | 'coord.' | 'ed.';
  ano?: number;
  /** Periódico, livro (no caso de capítulo), evento, instituição ou site. */
  veiculo?: string;
  edicao?: string;
  localPublicacao?: string;
  editora?: string;
  volume?: string;
  numero?: string;
  paginas?: string;
  numeroArtigo?: string;
  doi?: string;
  url?: string;
  /** Data de acesso no formato AAAA-MM-DD. */
  dataAcesso?: string;
  /** Teses, dissertações e TCCs: ex. "Dissertação (Mestrado em Enfermagem)". */
  tipoTrabalho?: string;
  /** Trabalhos em evento. */
  numeroEvento?: string;
  anoEvento?: number;
  localEvento?: string;
  tituloAnais?: string;
  statusCampos?: Partial<Record<CampoBibliografico, StatusCampo>>;
}

export type CampoBibliografico = Exclude<
  keyof DadosBibliograficos,
  'tipo' | 'statusCampos' | 'papelOrganizadores'
>;

export const ROTULO_CAMPO: Record<CampoBibliografico, string> = {
  titulo: 'título',
  subtitulo: 'subtítulo',
  autores: 'autoria',
  organizadores: 'organizadores do livro',
  ano: 'ano',
  veiculo: 'periódico / livro / evento / instituição',
  edicao: 'edição',
  localPublicacao: 'local de publicação',
  editora: 'editora',
  volume: 'volume',
  numero: 'número',
  paginas: 'páginas',
  numeroArtigo: 'número do artigo',
  doi: 'DOI',
  url: 'URL',
  dataAcesso: 'data de acesso',
  tipoTrabalho: 'tipo do trabalho (grau e curso)',
  numeroEvento: 'número do evento',
  anoEvento: 'ano do evento',
  localEvento: 'local do evento',
  tituloAnais: 'título dos anais',
};
