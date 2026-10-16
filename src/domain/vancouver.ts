// Estilo Vancouver (ICMJE / NLM "Citing Medicine"), com os termos em português,
// como nos guias das bibliotecas brasileiras da área da saúde.
//
//   Artigo:   Silva MA, Souza J. Título do artigo. Rev Bras Fis Med. 2021;16(2):112-20. doi: 10.xxxx/xxxx
//   Online:   ... Periódico [Internet]. 2021 [citado 2026 out 16];16(2):112-20. Disponível em: https://...
//   Livro:    Salvajoli JV, Souhami L, Faria SL. Radioterapia em oncologia. 2a ed. São Paulo: Atheneu; 2013.
//   Capítulo: Lima A. Título do capítulo. In: Pereira C, organizador. Título do livro. Cham: Springer; 2019. p. 33-50.
//
// As obras são numeradas na ordem em que aparecem pela primeira vez no texto; a chamada no texto
// é o número (sobrescrito, entre parênteses ou entre colchetes, conforme a instituição).
// Como em todo o app, nada é inventado: o que falta aparece como marcador e vira pendência.

import type { Autor, DadosBibliograficos, TipoPublicacao } from './tipos.ts';
import { levantarPendencias, limparDoi, segmentosParaHtml, type Pendencia, type Referencia, type Segmento } from './abnt/referencia.ts';
import { capitalizarSobrenome } from './abnt/citacao.ts';

export type ChamadaVancouver = 'sobrescrito' | 'parenteses' | 'colchetes';

export const ROTULO_CHAMADA: Record<ChamadaVancouver, string> = {
  sobrescrito: 'Sobrescrito: texto¹',
  parenteses: 'Entre parênteses: texto (1)',
  colchetes: 'Entre colchetes: texto [1]',
};

/** Até 6 autores; a partir de 7, os 6 primeiros seguidos de "et al.". */
const MAX_AUTORES = 6;
const MESES = ['jan', 'fev', 'mar', 'abr', 'maio', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', "d'", 'van', 'von', 'del', 'della', 'di', 'du']);

const limpo = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
const tem = (s?: string | null) => limpo(s).length > 0;
const semPontoFinal = (s: string) => s.replace(/[.\s]+$/, '');

// ---------------------------------------------------------------------
// Autoria
// ---------------------------------------------------------------------

/** "Maria Aparecida" → "MA"; "Jean-Pierre" → "JP"; "João da" → "J". */
export function iniciais(prenomes?: string): string {
  return limpo(prenomes)
    .split(' ')
    .filter((p) => p && !PARTICULAS.has(p.toLowerCase()))
    .flatMap((p) => p.split('-'))
    .map((p) => p.replace(/[^\p{L}]/gu, '').charAt(0).toLocaleUpperCase('pt-BR'))
    .join('');
}

export function autorVancouver(a: Autor): string {
  if (a.tipo === 'entidade') return semPontoFinal(limpo(a.sobrenome));
  const ini = iniciais(a.prenomes);
  const sobrenome = capitalizarSobrenome(a.sobrenome);
  return ini ? `${sobrenome} ${ini}` : sobrenome;
}

export function listaDeAutoresVancouver(autores: Autor[]): string {
  const v = autores.filter((a) => tem(a.sobrenome));
  if (!v.length) return '';
  const nomes = v.slice(0, MAX_AUTORES).map(autorVancouver);
  return v.length > MAX_AUTORES ? `${nomes.join(', ')}, et al` : nomes.join(', ');
}

// ---------------------------------------------------------------------
// Partes
// ---------------------------------------------------------------------

/** Intervalo de páginas abreviado: "112-116" → "112-6"; "112-120" → "112-20"; "45-60" → "45-60". */
export function paginasVancouver(p: string): string {
  const t = limpo(p).replace(/^p\.?\s*/i, '').replace(/\s*[-–—]\s*/g, '-');
  const m = /^(\d+)-(\d+)$/.exec(t);
  if (!m) return t;
  const [ini, fim] = [m[1], m[2]];
  if (fim.length !== ini.length) return `${ini}-${fim}`;
  let i = 0;
  while (i < fim.length - 1 && ini[i] === fim[i]) i++;
  return `${ini}-${fim.slice(i)}`;
}

/** "2026-10-16" → "2026 out 16". */
export function dataCitado(iso?: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpo(iso));
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${m[1]} ${MESES[mes - 1]} ${Number(m[3])}`;
}

function edicao(d: DadosBibliograficos): string | null {
  const e = limpo(d.edicao);
  if (!e || /^1(\.|ª|a)?\s*(ed\.?)?$/i.test(e)) return null;
  const n = /^(\d+)/.exec(e);
  return n ? `${n[1]}a ed.` : e;
}

function localEditora(d: DadosBibliograficos): string {
  const local = limpo(d.localPublicacao) || '[local desconhecido]';
  const editora = limpo(d.editora) || '[editora desconhecida]';
  return `${local}: ${editora}`;
}

const ano = (d: DadosBibliograficos) => (d.ano ? String(d.ano) : '[ANO?]');
const citado = (d: DadosBibliograficos) => `[citado ${dataCitado(d.dataAcesso) ?? '[DATA DE ACESSO?]'}]`;
const tituloCompleto = (d: DadosBibliograficos) =>
  `${limpo(d.titulo) || '[TÍTULO?]'}${tem(d.subtitulo) ? `: ${limpo(d.subtitulo)}` : ''}`;

const ROTULO_TRABALHO: Partial<Record<TipoPublicacao, string>> = {
  tese: 'tese',
  dissertacao: 'dissertação',
  tcc_monografia: 'trabalho de conclusão de curso',
};
const PAPEL: Record<string, [string, string]> = {
  'org.': ['organizador', 'organizadores'],
  'coord.': ['coordenador', 'coordenadores'],
  'ed.': ['editor', 'editores'],
};

/** Monta as frases da referência (cada uma termina em ponto). */
function frases(d: DadosBibliograficos): string[] {
  const f: string[] = [];
  const autores = listaDeAutoresVancouver(d.autores ?? []);
  if (autores) f.push(autores);
  const online = tem(d.url) && !tem(d.doi);
  const internet = online ? ' [Internet]' : '';

  switch (d.tipo) {
    case 'artigo_periodico': {
      f.push(tituloCompleto(d));
      let p = `${limpo(d.veiculo) || '[PERIÓDICO?]'}${internet}. ${ano(d)}`;
      if (online) p += ` ${citado(d)}`;
      let loc = '';
      if (tem(d.volume)) loc += limpo(d.volume);
      if (tem(d.numero)) loc += `(${limpo(d.numero)})`;
      if (tem(d.paginas)) loc += `:${paginasVancouver(d.paginas!)}`;
      else if (tem(d.numeroArtigo)) loc += `:${limpo(d.numeroArtigo)}`;
      if (loc) p += `;${loc}`;
      f.push(p);
      break;
    }
    case 'capitulo_livro': {
      f.push(tituloCompleto(d));
      const orgs = listaDeAutoresVancouver(d.organizadores ?? []);
      const papel = PAPEL[d.papelOrganizadores ?? 'org.'] ?? PAPEL['org.'];
      const n = (d.organizadores ?? []).filter((a) => tem(a.sobrenome)).length;
      let p = 'In: ';
      if (orgs) p += `${orgs}, ${n > 1 ? papel[1] : papel[0]}. `;
      p += `${limpo(d.veiculo) || '[TÍTULO DO LIVRO?]'}${internet}`;
      f.push(p);
      const ed = edicao(d);
      if (ed) f.push(ed);
      f.push(`${localEditora(d)}; ${ano(d)}${online ? ` ${citado(d)}` : ''}`);
      if (tem(d.paginas)) f.push(`p. ${paginasVancouver(d.paginas!)}`);
      break;
    }
    case 'tese':
    case 'dissertacao':
    case 'tcc_monografia': {
      f.push(`${tituloCompleto(d)} [${ROTULO_TRABALHO[d.tipo]}]${internet}`);
      const local = limpo(d.localPublicacao) || '[local desconhecido]';
      f.push(`${local}: ${limpo(d.veiculo) || '[INSTITUIÇÃO?]'}; ${ano(d)}${online ? ` ${citado(d)}` : ''}`);
      break;
    }
    case 'trabalho_evento': {
      f.push(tituloCompleto(d));
      const ev = [limpo(d.tituloAnais) || `${tem(d.numeroEvento) ? `${limpo(d.numeroEvento).replace(/[ºª°.]/g, '')}º ` : ''}${limpo(d.veiculo) || '[EVENTO?]'}`];
      if (d.anoEvento) ev.push(String(d.anoEvento));
      if (tem(d.localEvento)) ev.push(limpo(d.localEvento));
      f.push(`In: ${ev.join('; ')}${internet}`);
      f.push(`${localEditora(d)}; ${ano(d)}${online ? ` ${citado(d)}` : ''}`);
      if (tem(d.paginas)) f.push(`p. ${paginasVancouver(d.paginas!)}`);
      break;
    }
    case 'pagina_web': {
      f.push(`${tituloCompleto(d)} [Internet]`);
      const resp = limpo(d.editora) || limpo(d.veiculo);
      const local = limpo(d.localPublicacao);
      const quem = [local, resp].filter(Boolean).join(': ');
      f.push(`${quem ? `${quem}; ` : ''}${d.ano ? `${d.ano} ` : ''}${citado(d)}`);
      break;
    }
    default: {
      // livro, documento institucional, legislação, outro
      f.push(`${tituloCompleto(d)}${internet}`);
      const ed = edicao(d);
      if (ed) f.push(ed);
      f.push(`${localEditora(d)}; ${ano(d)}${online ? ` ${citado(d)}` : ''}`);
      break;
    }
  }
  if (tem(d.url) && (online || d.tipo === 'pagina_web')) f.push(`Disponível em: ${limpo(d.url)}`);
  return f;
}

function pendenciasVancouver(d: DadosBibliograficos): Pendencia[] {
  // mesmas regras de dados faltando e de conferência; os avisos específicos da ABNT saem
  const p = levantarPendencias(d).filter((x) => !x.mensagem.includes('ABNT'));
  if (d.tipo === 'artigo_periodico' && tem(d.veiculo) && /\s\S{6,}/.test(limpo(d.veiculo))) {
    p.push({
      campo: 'veiculo',
      nivel: 'conferir',
      mensagem: 'No Vancouver, o título do periódico costuma ser abreviado (ex.: "Rev Bras Fis Med"). Confira a abreviatura oficial no NLM Catalog e corrija o campo, se a sua instituição pedir.',
    });
  }
  if (d.tipo === 'legislacao') {
    p.push({ campo: 'titulo', nivel: 'conferir', mensagem: 'O Vancouver não tem regra para legislação brasileira; muitas instituições pedem o formato da ABNT para esses documentos. Confira com a sua.' });
  }
  return p;
}

export function gerarReferenciaVancouver(d: DadosBibliograficos): Referencia {
  const texto = frases(d)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/[.?!]$/.test(s) || /^Disponível em:/.test(s) ? s : `${s}.`))
    .join(' ');
  const doi = tem(d.doi) ? ` doi: ${limparDoi(d.doi!)}` : '';
  const final = `${texto}${doi}`;
  const segmentos: Segmento[] = [{ texto: final }];
  const pendencias = pendenciasVancouver(d);
  return { segmentos, texto: final, html: segmentosParaHtml(segmentos), pendencias, completa: !pendencias.some((x) => x.nivel === 'obrigatorio') };
}

// ---------------------------------------------------------------------
// Chamada no texto
// ---------------------------------------------------------------------

const SOBRESCRITO: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
export const paraSobrescrito = (s: string) => [...s].map((c) => SOBRESCRITO[c] ?? c).join('');

/** [1,2,3,5] → "1-3,5" */
export function compactarNumeros(ns: number[]): string {
  const v = [...new Set(ns)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < v.length; ) {
    let j = i;
    while (j + 1 < v.length && v[j + 1] === v[j] + 1) j++;
    partes.push(j - i >= 2 ? `${v[i]}-${v[j]}` : v.slice(i, j + 1).join(','));
    i = j + 1;
  }
  return partes.join(',');
}

/** Chamada numérica: "¹", "(1)" ou "[1]"; com página: "¹ (p. 47)", "(1, p. 47)", "[1, p. 47]".
 *  Sem número ainda: "[nº?]", porque a numeração depende da ordem de citação no TCC. */
export function chamadaVancouver(numeros: number | number[] | undefined, estilo: ChamadaVancouver = 'sobrescrito', pagina?: string): string {
  const lista = numeros === undefined ? [] : Array.isArray(numeros) ? numeros : [numeros];
  const p = limpo(pagina) ? `p. ${paginasVancouver(pagina!)}` : '';
  if (!lista.length) return p ? `[nº?, ${p}]` : '[nº?]';
  const n = compactarNumeros(lista);
  if (estilo === 'sobrescrito') return `${paraSobrescrito(n)}${p ? ` (${p})` : ''}`;
  const [a, b] = estilo === 'parenteses' ? ['(', ')'] : ['[', ']'];
  return `${a}${n}${p ? `, ${p}` : ''}${b}`;
}
