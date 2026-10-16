// Gerador de referências — ABNT NBR 6023:2025 (DOI como endereço completo: https://doi.org/...).
//
// Ideia central: a referência é montada como uma lista de "segmentos"
// (trechos de texto, alguns em negrito). A partir dela geramos tanto o
// texto simples quanto o HTML (que mantém o negrito ao colar no Word).
//
// Nada é inventado: quando um dado obrigatório falta, aparece um marcador
// visível como [ANO?] e a referência é marcada como incompleta.

import type {
  Autor,
  CampoBibliografico,
  DadosBibliograficos,
  TipoPublicacao,
} from '../tipos.ts';
import { ROTULO_CAMPO } from '../tipos.ts';
import { entradaDoAutor } from './nomes.ts';

export interface Segmento {
  texto: string;
  negrito?: boolean;
}

export type NivelPendencia = 'obrigatorio' | 'recomendado' | 'conferir';

export interface Pendencia {
  campo: CampoBibliografico;
  nivel: NivelPendencia;
  mensagem: string;
}

export interface Referencia {
  segmentos: Segmento[];
  texto: string;
  html: string;
  pendencias: Pendencia[];
  /** true quando não há dado obrigatório faltando (pode ainda haver itens a conferir). */
  completa: boolean;
}

export interface OpcoesReferencia {
  /** Com 4 ou mais autores, indicar só o primeiro seguido de "et al." (padrão: listar todos). */
  etAlAPartirDe4?: boolean;
}

const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

const ARTIGOS_INICIAIS = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
  'the', 'an', 'el', 'la', 'los', 'las', 'le', 'les', 'il', 'lo', 'gli',
]);

// ---------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------

const limpo = (s?: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();
const tem = (s?: string | null): boolean => limpo(s).length > 0;

/** Junta trechos garantindo um único ponto final (não duplica "M.." ou "al..") */
function comPonto(s: string): string {
  const t = s.trimEnd();
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

export function maiusculas(s: string): string {
  return s.toLocaleUpperCase('pt-BR');
}

/** "15-16" → "p. 15-16"; "p. 15" permanece. */
export function formatarPaginas(p: string): string {
  const t = limpo(p);
  if (/^p\.?\s/i.test(t)) return t.replace(/^p\.?\s*/i, 'p. ');
  return `p. ${t.replace(/\s*[-–—]\s*/g, '-')}`;
}

/** "2026-10-14" → "14 out. 2026". Retorna null se a data for inválida. */
export function formatarDataAcesso(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpo(iso));
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${dia} ${MESES[mes - 1]} ${ano}`;
}

/** Remove prefixos ("https://doi.org/", "doi:") mantendo o DOI como foi escrito. */
export function limparDoi(doi: string): string {
  return limpo(doi)
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '');
}

/** Forma usada só para comparar (DOIs não diferenciam maiúsculas). */
export function normalizarDoi(doi: string): string {
  return limparDoi(doi).toLowerCase();
}

// ---------------------------------------------------------------------
// Autoria
// ---------------------------------------------------------------------

/** Entidade: "Brasil. Ministério da Saúde" → "BRASIL. Ministério da Saúde";
 *  "Universidade de São Paulo" → "UNIVERSIDADE DE SÃO PAULO". */
function entidadeNaReferencia(nome: string): string {
  const n = limpo(nome);
  const i = n.indexOf('. ');
  if (i === -1) return maiusculas(n);
  return `${maiusculas(n.slice(0, i))}${n.slice(i)}`;
}

function autorNaReferencia(autor: Autor): string {
  if (autor.tipo === 'entidade') return entidadeNaReferencia(autor.sobrenome);
  const a = entradaDoAutor(autor);
  const sobrenome = maiusculas(limpo(a.sobrenome));
  return tem(a.prenomes) ? `${sobrenome}, ${limpo(a.prenomes)}` : sobrenome;
}

function listaDeAutores(autores: Autor[], opcoes: OpcoesReferencia): string {
  const validos = autores.filter((a) => tem(a.sobrenome));
  if (opcoes.etAlAPartirDe4 && validos.length >= 4) {
    return `${autorNaReferencia(validos[0])} et al.`;
  }
  return validos.map(autorNaReferencia).join('; ');
}

/** Entrada pelo título (sem autoria): primeira palavra em maiúsculas,
 *  e também a seguinte se a primeira for artigo. */
export function tituloComoEntrada(titulo: string): string {
  const palavras = limpo(titulo).split(' ');
  if (palavras.length === 0) return '';
  let n = 1;
  if (palavras.length > 1 && ARTIGOS_INICIAIS.has(palavras[0].toLowerCase())) n = 2;
  return [...palavras.slice(0, n).map(maiusculas), ...palavras.slice(n)].join(' ');
}

// ---------------------------------------------------------------------
// Requisitos por tipo
// ---------------------------------------------------------------------

const OBRIGATORIOS: Record<TipoPublicacao, CampoBibliografico[]> = {
  artigo_periodico: ['titulo', 'veiculo', 'ano'],
  livro: ['titulo', 'ano'],
  capitulo_livro: ['titulo', 'veiculo', 'ano', 'paginas'],
  tese: ['titulo', 'ano', 'tipoTrabalho', 'veiculo'],
  dissertacao: ['titulo', 'ano', 'tipoTrabalho', 'veiculo'],
  tcc_monografia: ['titulo', 'ano', 'tipoTrabalho', 'veiculo'],
  trabalho_evento: ['titulo', 'veiculo', 'ano'],
  documento_institucional: ['titulo', 'ano'],
  legislacao: ['titulo', 'ano'],
  pagina_web: ['titulo', 'url'],
  outro: ['titulo', 'ano'],
};

const RECOMENDADOS: Record<TipoPublicacao, CampoBibliografico[]> = {
  artigo_periodico: ['autores', 'volume', 'paginas', 'localPublicacao'],
  livro: ['autores', 'localPublicacao', 'editora'],
  capitulo_livro: ['autores', 'organizadores', 'localPublicacao', 'editora'],
  tese: ['autores', 'localPublicacao'],
  dissertacao: ['autores', 'localPublicacao'],
  tcc_monografia: ['autores', 'localPublicacao'],
  trabalho_evento: ['autores', 'anoEvento', 'localEvento', 'localPublicacao', 'paginas'],
  documento_institucional: ['autores', 'localPublicacao'],
  legislacao: ['localPublicacao'],
  pagina_web: ['autores', 'ano'],
  outro: ['autores'],
};

const TIPO_TRABALHO_PADRAO: Partial<Record<TipoPublicacao, string>> = {
  tese: 'Tese (Doutorado)',
  dissertacao: 'Dissertação (Mestrado)',
  tcc_monografia: 'Trabalho de Conclusão de Curso (Graduação)',
};

function valorPresente(d: DadosBibliograficos, campo: CampoBibliografico): boolean {
  const v = d[campo];
  if (Array.isArray(v)) return v.some((a) => tem(a.sobrenome));
  if (typeof v === 'number') return Number.isFinite(v);
  return tem(v as string | undefined);
}

/** Campos bibliográficos preenchidos (ignora quaisquer outros dados guardados junto, como tags ou resumo). */
function camposUsados(d: DadosBibliograficos): CampoBibliografico[] {
  return (Object.keys(ROTULO_CAMPO) as CampoBibliografico[]).filter((k) => valorPresente(d, k));
}

export function levantarPendencias(d: DadosBibliograficos): Pendencia[] {
  const pend: Pendencia[] = [];
  const tipoTrabalhoTemPadrao = TIPO_TRABALHO_PADRAO[d.tipo] !== undefined;

  for (const campo of OBRIGATORIOS[d.tipo]) {
    if (valorPresente(d, campo)) continue;
    if (campo === 'tipoTrabalho' && tipoTrabalhoTemPadrao) {
      pend.push({ campo, nivel: 'recomendado', mensagem: 'Informe o grau e o curso (ex.: "Mestrado em Enfermagem").' });
      continue;
    }
    pend.push({ campo, nivel: 'obrigatorio', mensagem: `Falta ${ROTULO_CAMPO[campo]}.` });
  }
  for (const campo of RECOMENDADOS[d.tipo]) {
    if (!valorPresente(d, campo)) {
      pend.push({ campo, nivel: 'recomendado', mensagem: `Não informado: ${ROTULO_CAMPO[campo]}.` });
    }
  }
  if (tem(d.url) && !tem(d.dataAcesso)) {
    pend.push({ campo: 'dataAcesso', nivel: 'obrigatorio', mensagem: 'Documento online exige a data de acesso.' });
  } else if (tem(d.dataAcesso) && formatarDataAcesso(d.dataAcesso!) === null) {
    pend.push({ campo: 'dataAcesso', nivel: 'obrigatorio', mensagem: 'Data de acesso inválida.' });
  }
  if (d.tipo === 'legislacao') {
    pend.push({ campo: 'titulo', nivel: 'conferir', mensagem: 'Legislação tem formato próprio na ABNT: revise a referência manualmente.' });
  }

  // Dados presentes que ainda não foram conferidos pela estudante
  const status = d.statusCampos ?? {};
  for (const campo of camposUsados(d)) {
    const s = status[campo];
    if (s === 'verificado') continue;
    const origem = s === 'importado' ? 'veio da busca automática' : 'ainda não foi conferido';
    pend.push({ campo, nivel: 'conferir', mensagem: `Conferir ${ROTULO_CAMPO[campo]} (${origem}).` });
  }
  return pend;
}

// ---------------------------------------------------------------------
// Montagem dos segmentos
// ---------------------------------------------------------------------

class Montador {
  segs: Segmento[] = [];
  add(texto: string, negrito = false): this {
    if (!texto) return this;
    const ultimo = this.segs[this.segs.length - 1];
    if (ultimo && !!ultimo.negrito === negrito) ultimo.texto += texto;
    else this.segs.push(negrito ? { texto, negrito: true } : { texto });
    return this;
  }
  /** Garante que o texto acumulado termine em ponto e adiciona espaço. */
  fecharFrase(): this {
    const ultimo = this.segs[this.segs.length - 1];
    if (!ultimo) return this;
    const t = ultimo.texto.trimEnd();
    if (!/[.?!]$/.test(t)) {
      // ponto fora do negrito
      if (ultimo.negrito) {
        ultimo.texto = t;
        this.add('.');
      } else ultimo.texto = `${t}.`;
    } else ultimo.texto = t;
    return this.add(' ');
  }
}

function anoOuMarcador(d: DadosBibliograficos): string {
  return d.ano ? String(d.ano) : '[ANO?]';
}

/** "Local: Editora" com os marcadores da ABNT para dados ausentes. */
function localEditora(d: DadosBibliograficos): string {
  const local = limpo(d.localPublicacao);
  const editora = limpo(d.editora);
  if (local && editora) return `${local}: ${editora}`;
  if (local) return `${local}: [s. n.]`;
  if (editora) return `[S. l.]: ${editora}`;
  return '[S. l.: s. n.]';
}

function edicao(d: DadosBibliograficos): string | null {
  const e = limpo(d.edicao);
  if (!e) return null;
  if (/^1(\.|ª|a)?\s*(ed\.?)?$/i.test(e)) return null; // primeira edição não se indica
  const num = /^(\d+)/.exec(e);
  return num ? `${num[1]}. ed.` : e;
}

function entrada(m: Montador, d: DadosBibliograficos, opcoes: OpcoesReferencia): boolean {
  const autores = listaDeAutores(d.autores ?? [], opcoes);
  if (autores) {
    m.add(autores).fecharFrase();
    return true;
  }
  return false;
}

/** Título + subtítulo. Quando não há autoria, o título vira a entrada (sem negrito). */
function titulo(m: Montador, d: DadosBibliograficos, destacar: boolean, temAutoria: boolean) {
  const t = limpo(d.titulo) || '[TÍTULO?]';
  if (!temAutoria) m.add(tituloComoEntrada(t));
  else m.add(t, destacar);
  if (tem(d.subtitulo)) m.add(`: ${limpo(d.subtitulo)}`);
  m.fecharFrase();
}

function online(m: Montador, d: DadosBibliograficos) {
  if (tem(d.doi)) m.add(`DOI: https://doi.org/${limparDoi(d.doi!)}`).fecharFrase();
  if (tem(d.url)) {
    m.add(`Disponível em: ${limpo(d.url)}`).fecharFrase();
    const data = tem(d.dataAcesso) ? formatarDataAcesso(d.dataAcesso!) : null;
    m.add(`Acesso em: ${data ?? '[DATA DE ACESSO?]'}`).fecharFrase();
  }
}

function montar(d: DadosBibliograficos, opcoes: OpcoesReferencia): Segmento[] {
  const m = new Montador();
  const temAutoria = entrada(m, d, opcoes);

  switch (d.tipo) {
    case 'artigo_periodico': {
      titulo(m, d, false, temAutoria);
      m.add(limpo(d.veiculo) || '[PERIÓDICO?]', true);
      const partes: string[] = [];
      if (tem(d.localPublicacao)) partes.push(limpo(d.localPublicacao));
      if (tem(d.volume)) partes.push(`v. ${limpo(d.volume)}`);
      if (tem(d.numero)) partes.push(`n. ${limpo(d.numero)}`);
      if (tem(d.paginas)) partes.push(formatarPaginas(d.paginas!));
      else if (tem(d.numeroArtigo)) partes.push(limpo(d.numeroArtigo));
      partes.push(anoOuMarcador(d));
      m.add(`, ${partes.join(', ')}`).fecharFrase();
      break;
    }
    case 'capitulo_livro': {
      titulo(m, d, false, temAutoria);
      m.add('In: ');
      const orgs = listaDeAutores(d.organizadores ?? [], opcoes);
      if (orgs) m.add(`${orgs} (${d.papelOrganizadores ?? 'org.'})`).fecharFrase();
      m.add(limpo(d.veiculo) || '[TÍTULO DO LIVRO?]', true).fecharFrase();
      const ed = edicao(d);
      if (ed) m.add(ed).fecharFrase();
      m.add(`${localEditora(d)}, ${anoOuMarcador(d)}`).fecharFrase();
      if (tem(d.paginas)) m.add(formatarPaginas(d.paginas!)).fecharFrase();
      break;
    }
    case 'tese':
    case 'dissertacao':
    case 'tcc_monografia': {
      titulo(m, d, true, temAutoria);
      m.add(anoOuMarcador(d)).fecharFrase();
      const tipoTrab = limpo(d.tipoTrabalho) || TIPO_TRABALHO_PADRAO[d.tipo]!;
      const vinculo = [limpo(d.veiculo) || '[INSTITUIÇÃO?]'];
      if (tem(d.localPublicacao)) vinculo.push(limpo(d.localPublicacao));
      vinculo.push(anoOuMarcador(d));
      m.add(`${tipoTrab} – ${vinculo.join(', ')}`).fecharFrase();
      break;
    }
    case 'trabalho_evento': {
      titulo(m, d, false, temAutoria);
      const ev = [maiusculas(limpo(d.veiculo) || '[EVENTO?]')];
      if (tem(d.numeroEvento)) ev.push(comPonto(limpo(d.numeroEvento).replace(/[ºª°]/g, '')));
      ev.push(String(d.anoEvento ?? d.ano ?? '[ANO?]'));
      if (tem(d.localEvento)) ev.push(limpo(d.localEvento));
      m.add(`In: ${ev.join(', ')}`).fecharFrase();
      m.add(limpo(d.tituloAnais) || 'Anais', true).add(' [...]').fecharFrase();
      m.add(`${localEditora(d)}, ${anoOuMarcador(d)}`).fecharFrase();
      if (tem(d.paginas)) m.add(formatarPaginas(d.paginas!)).fecharFrase();
      break;
    }
    case 'pagina_web': {
      titulo(m, d, true, temAutoria);
      const partes = [limpo(d.veiculo), limpo(d.localPublicacao)].filter(Boolean);
      if (d.ano) partes.push(String(d.ano));
      if (partes.length) m.add(partes.join(', ')).fecharFrase();
      break;
    }
    default: {
      // livro, documento institucional, legislação, outro
      titulo(m, d, true, temAutoria);
      const ed = edicao(d);
      if (ed) m.add(ed).fecharFrase();
      m.add(`${localEditora(d)}, ${anoOuMarcador(d)}`).fecharFrase();
      break;
    }
  }

  online(m, d);
  // remove o espaço final
  const ultimo = m.segs[m.segs.length - 1];
  if (ultimo) ultimo.texto = ultimo.texto.trimEnd();
  return m.segs.filter((s) => s.texto.length > 0);
}

// ---------------------------------------------------------------------
// Saídas
// ---------------------------------------------------------------------

const escaparHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function segmentosParaTexto(segs: Segmento[]): string {
  return segs.map((s) => s.texto).join('');
}

export function segmentosParaHtml(segs: Segmento[]): string {
  return segs.map((s) => (s.negrito ? `<strong>${escaparHtml(s.texto)}</strong>` : escaparHtml(s.texto))).join('');
}

export function gerarReferencia(d: DadosBibliograficos, opcoes: OpcoesReferencia = {}): Referencia {
  const segmentos = montar(d, opcoes);
  const pendencias = levantarPendencias(d);
  return {
    segmentos,
    texto: segmentosParaTexto(segmentos),
    html: segmentosParaHtml(segmentos),
    pendencias,
    completa: !pendencias.some((p) => p.nivel === 'obrigatorio'),
  };
}

/** Lista de referências em ordem alfabética (como na seção REFERÊNCIAS do TCC). */
export function gerarListaDeReferencias(
  fontes: DadosBibliograficos[],
  opcoes: OpcoesReferencia = {},
): { texto: string; html: string; referencias: Referencia[] } {
  const referencias = fontes
    .map((f) => gerarReferencia(f, opcoes))
    .sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR', { sensitivity: 'base' }));
  return {
    referencias,
    texto: referencias.map((r) => r.texto).join('\n\n'),
    html: referencias.map((r) => `<p>${r.html}</p>`).join('\n'),
  };
}
