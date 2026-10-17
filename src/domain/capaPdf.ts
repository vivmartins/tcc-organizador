// Lê título, autoria e outros dados da primeira página de um PDF sem DOI.
//
// Regra de ouro (a mesma da importação por DOI): só preenche o que está ESCRITO no PDF. Quando a
// leitura não tem certeza (ex.: não dá para separar os nomes dos autores), o campo fica vazio.
// Tudo o que for lido aparece marcado como "importado" para a pessoa conferir antes de salvar.

import type { Autor, DadosBibliograficos, TipoPublicacao } from './tipos.ts';

/** Um pedaço de texto do PDF, com posição (em pontos; y cresce para cima) e altura da letra. */
export interface TrechoPdf { str: string; x: number; y: number; altura: number; largura: number }
export interface LinhaPdf { texto: string; x: number; y: number; altura: number }

export type DadosDaCapa = Partial<Omit<DadosBibliograficos, 'statusCampos'>>;
export interface LeituraDaCapa {
  dados: DadosDaCapa;
  /** Observações para a pessoa conferir (ex.: título estava todo em maiúsculas). */
  avisos: string[];
}

// ---------------------------------------------------------------------
// Linhas
// ---------------------------------------------------------------------

/** Junta os trechos em linhas (de cima para baixo). Índices superiores ficam na mesma linha. */
export function montarLinhas(trechos: TrechoPdf[]): LinhaPdf[] {
  const validos = trechos.filter((t) => t.str.trim() && t.altura > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: TrechoPdf[][] = [];
  for (const t of validos) {
    const g = grupos.find((gr) => {
      const ref = gr.reduce((m, x) => (x.altura > m.altura ? x : m));
      return Math.abs(ref.y - t.y) <= Math.max(ref.altura, t.altura) * 0.45;
    });
    if (g) g.push(t);
    else grupos.push([t]);
  }
  return grupos
    .map((g) => {
      g.sort((a, b) => a.x - b.x);
      const principal = g.reduce((m, x) => (x.str.trim().length * x.altura > m.str.trim().length * m.altura ? x : m));
      let texto = '';
      let fim = -Infinity;
      for (const t of g) {
        const pequeno = t.altura < principal.altura * 0.8 && t.y > principal.y + principal.altura * 0.15;
        // índice superior (¹, *, a) colado ao nome: marcamos com ^ para poder tirar depois
        const pedaco = pequeno ? `^${t.str.trim()}^` : t.str;
        const espaco = texto && t.x - fim > principal.altura * 0.15 && !/\s$/.test(texto) && !/^\s/.test(pedaco) ? ' ' : '';
        texto += espaco + pedaco;
        fim = t.x + t.largura;
      }
      // altura "da linha": a maior entre os trechos de tamanho normal
      const altura = Math.max(...g.filter((t) => !(t.altura < principal.altura * 0.8)).map((t) => t.altura));
      return { texto: texto.replace(/\s+/g, ' ').trim(), x: g[0].x, y: principal.y, altura: Math.round(altura * 10) / 10 };
    })
    .filter((l) => l.texto.replace(/\^/g, '').trim())
    .sort((a, b) => b.y - a.y);
}

const semIndices = (s: string) => s.replace(/\^[^^]*\^/g, ' ').replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰*†‡§¶#]+/g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------
// Maiúsculas
// ---------------------------------------------------------------------

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o', 'as', 'os', 'à', 'às', 'ao', 'aos', 'para', 'por', 'com', 'sem', 'sob', 'sobre', 'entre', 'van', 'von', 'del', 'della', 'di', 'du', 'y', 'of', 'the', 'and', 'in', 'on', 'for', 'to', 'at']);
const letras = (s: string) => s.replace(/[^A-Za-zÀ-ÿ]/g, '');
export const todoMaiusculo = (s: string) => letras(s).length >= 4 && letras(s) === letras(s).toLocaleUpperCase('pt-BR');

/** "FACULDADE DE MEDICINA" → "Faculdade de Medicina" (para nomes e instituições). */
export function nomeProprio(s: string): string {
  return s
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.replace(/(^|[-'’])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase('pt-BR'))))
    .join(' ');
}

/** Título todo em maiúsculas → só a primeira letra maiúscula (siglas e nomes próprios: conferir). */
function frase(s: string): string {
  const t = s.split(' ').map((p) => (/^[B-DF-HJ-NP-TV-ZÇ]{2,}$/.test(p.replace(/[^\p{L}]/gu, '')) ? p : p.toLocaleLowerCase('pt-BR'))).join(' ');
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1);
}

// ---------------------------------------------------------------------
// Nomes de autores
// ---------------------------------------------------------------------

const PALAVRA_DE_NOME = /^(?:\p{Lu}[\p{Ll}'’-]*\.?|\p{Lu}\p{Ll}?\.(?:-?\p{Lu}\.)*|\p{Lu}{2,}[\p{Lu}'’-]*)$/u;
const NAO_E_NOME = /\b(universi|facul|institu|hospita|departa|labor|school|centro|center|centre|curso|revista|journal|resumo|abstract|introdu|palavras|keywords|recebido|received|aceito|accepted|correspond|e-?mail|brasil|brazil|artigo|article|original|review|revis[aã]o|vol|volume|ISSN|doi|http|www|orientador|advisor|programa|mestrado|doutorado|cidade|estado|são paulo|rio de janeiro)\b/i;
const PARTICULAS_NOME = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'van', 'von', 'der', 'den', 'del', 'della', 'di', 'du', 'y', 'la', 'le', 'dei', 'des']);
const SUFIXO_NOME = /^(filho|filha|júnior|junior|jr\.?|neto|neta|sobrinho)$/i;

function nomeValido(nome: string): boolean {
  const palavras = nome.split(' ').filter(Boolean);
  if (palavras.length < 2 || palavras.length > 7) return false;
  if (NAO_E_NOME.test(nome) || /\d/.test(nome)) return false;
  let comMaiuscula = 0;
  for (const p of palavras) {
    if (PARTICULAS_NOME.has(p.toLowerCase()) && p === p.toLowerCase()) continue;
    if (!PALAVRA_DE_NOME.test(p) && !SUFIXO_NOME.test(p)) return false;
    comMaiuscula++;
  }
  return comMaiuscula >= 2;
}

export function autorDoNome(completo: string): Autor {
  const limpo = todoMaiusculo(completo) ? nomeProprio(completo) : completo;
  const partes = limpo.replace(/\s+/g, ' ').trim().split(' ');
  let n = 1;
  if (partes.length > 2 && SUFIXO_NOME.test(partes[partes.length - 1])) n = 2;
  return { tipo: 'pessoa', sobrenome: partes.slice(-n).join(' '), prenomes: partes.slice(0, -n).join(' ') };
}

/** "Ana Lima¹, Carlos Souza² e Rita Dias³" → três nomes. Devolve null se algum pedaço não parecer nome. */
export function lerNomes(linha: string): string[] | null {
  const t = linha
    .replace(/\^[^^]*\^/g, ',') // índices viram separadores (também separam nomes sem vírgula)
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰*†‡§¶#]+/g, ',')
    .replace(/(\p{L})\d+(?:,\d+)*/gu, '$1,')
    .replace(/(^|[\s,])(?:e|and|&|y)\s+/gi, '$1,')
    .replace(/(\p{Lu}\.)(?=\p{Lu}\p{Ll})/gu, '$1 ')
    .replace(/;/g, ',');
  const nomes = t.split(',').map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => s && !/^[a-z]$/.test(s) && !/^(e|and)$/i.test(s));
  if (!nomes.length || !nomes.every(nomeValido)) return null;
  return nomes;
}

// ---------------------------------------------------------------------
// Periódico, volume, número, páginas e ano
// ---------------------------------------------------------------------

const ANO = '((?:19|20)\\d{2})';

interface Fasciculo { veiculo?: string; volume?: string; numero?: string; paginas?: string; numeroArtigo?: string; ano?: number }

/** Lê linhas como "Rev Bras Enferm. 2021;74(2):112-20" ou "Revista X, v. 16, n. 2, p. 112-120, 2021". */
export function lerFasciculo(texto: string): Fasciculo | null {
  const linhas = texto.split('\n').map((l) => semIndices(l));
  for (const l of linhas) {
    // estilo ABNT: Revista X, São Paulo, v. 16, n. 2, p. 112-120, abr./jun. 2021
    let m = new RegExp(`^(.{3,90}?),\\s*(?:[^,]{2,30},\\s*)?v\\.\\s*(\\d+),\\s*n\\.\\s*([\\w/-]+)(?:,\\s*p\\.\\s*(\\d+)\\s*[-–]\\s*(\\d+))?,?\\s*(?:[a-zç]{3,9}\\.?(?:\\s*[/-]\\s*[a-zç]{3,9}\\.?)?\\s*)?${ANO}`, 'i').exec(l);
    if (m) return { veiculo: m[1].trim(), volume: m[2], numero: m[3], paginas: m[4] ? `${m[4]}-${m[5]}` : undefined, ano: Number(m[6]) };
    // estilo Vancouver: Rev Bras Enferm. 2021;74(2):112-20
    m = new RegExp(`^(.{3,90}?)\\.?\\s+${ANO}\\s*(?:[A-Za-z]{3}\\s*)?;\\s*(\\d+)\\s*(?:\\(([\\w-]+)\\))?\\s*:\\s*(e?\\d+)(?:\\s*[-–]\\s*(\\d+))?`).exec(l);
    if (m) {
      const eletronico = /^e/.test(m[5]) && !m[6];
      return { veiculo: m[1].replace(/\.$/, '').trim(), ano: Number(m[2]), volume: m[3], numero: m[4], ...(eletronico ? { numeroArtigo: m[5] } : { paginas: m[6] ? `${m[5]}-${m[6]}` : m[5] }) };
    }
    // "Vol. 16, n. 2, 2021" / "Volume 16, Number 2 (2021)"
    m = new RegExp(`\\bvol(?:ume)?\\.?\\s*(\\d+)\\s*[,|–-]?\\s*(?:n(?:º|o|úm|um|umber)?\\.?\\s*([\\w/-]+))?[^\\d]{0,30}?\\(?${ANO}\\)?`, 'i').exec(l);
    if (m && !/recebid|received|aceit|accept/i.test(l)) return { volume: m[1], numero: m[2], ano: Number(m[3]) };
    m = new RegExp(`${ANO}\\s*[,|]\\s*vol(?:ume)?\\.?\\s*(\\d+)\\s*[,|]\\s*(?:n(?:º|o|úm|um|umber)?|issue)\\.?\\s*([\\w/-]+)`, 'i').exec(l);
    if (m && !/recebid|received|aceit|accept/i.test(l)) return { ano: Number(m[1]), volume: m[2], numero: m[3] };
  }
  return null;
}

function anoDaPublicacao(texto: string): number | undefined {
  const m =
    new RegExp(`(?:publicado|published|publica[çc][ãa]o)(?:\\s+(?:em|online|on))?\\s*:?\\s*(?:\\d{1,2}[/.\\s-]+)?(?:\\w+[/.\\s-]+)?${ANO}`, 'i').exec(texto) ??
    new RegExp(`(?:©|\\(c\\)|copyright)\\s*${ANO}`, 'i').exec(texto);
  return m ? Number(m[1]) : undefined;
}

// ---------------------------------------------------------------------
// Teses, dissertações e TCCs
// ---------------------------------------------------------------------

const INSTITUICAO = /^(universidade|faculdade|instituto|centro universit|escola|funda[çc][ãa]o|hospital|university|college)/i;
const SUB_INSTITUICAO = /^(programa|curso|departamento|faculdade|escola|instituto|centro de)/i;

function tipoDoTrabalho(texto: string): { tipo: TipoPublicacao; tipoTrabalho?: string } | null {
  const t = texto.replace(/\s+/g, ' ');
  let tipo: TipoPublicacao | null = null;
  if (/\btese\b[^.]{0,80}\b(doutor|doutorado)\b|\bdoutorado\b[^.]{0,60}\btese\b|título de doutor/i.test(t)) tipo = 'tese';
  else if (/disserta[çc][ãa]o[^.]{0,120}(mestr|programa de p[óo]s)|título de mestre/i.test(t)) tipo = 'dissertacao';
  else if (/trabalho de conclus[ãa]o de curso|monografia apresentada|\bTCC\b|título de (bacharel|licenciad|tecn[óo]log|especialista)/i.test(t)) tipo = 'tcc_monografia';
  if (!tipo) return null;
  const grau = tipo === 'tese' ? 'Doutorado' : tipo === 'dissertacao' ? 'Mestrado' : null;
  const area =
    /(?:título|grau) de (?:mestre|doutor|doutora|bacharel|licenciad[oa]|tecn[óo]log[oa]|especialista)\s+(?:em|no|na)\s+([^.,;\n]{3,60})/i.exec(t)?.[1] ??
    /programa de p[óo]s-?gradua[çc][ãa]o\s+(?:em|stricto sensu em)\s+([^.,;\n]{3,60})/i.exec(t)?.[1] ??
    /curso de (?:gradua[çc][ãa]o em\s+|especializa[çc][ãa]o em\s+)?([^.,;\n]{3,50})/i.exec(t)?.[1];
  const areaLimpa = area?.replace(/\s+(da|do|de|na|no)\s+(universidade|faculdade|escola|instituto|centro).*$/i, '').replace(/\s+(como|para|sob)\b.*$/i, '').trim();
  const nomeArea = areaLimpa ? (todoMaiusculo(areaLimpa) ? nomeProprio(areaLimpa) : areaLimpa) : undefined;
  let tipoTrabalho: string | undefined;
  if (grau) tipoTrabalho = `${tipo === 'tese' ? 'Tese' : 'Dissertação'} (${grau}${nomeArea ? ` em ${nomeArea}` : ''})`;
  else if (/especializa|especialista|p[óo]s-gradua[çc][ãa]o lato/i.test(t)) tipoTrabalho = `Trabalho de Conclusão de Curso (Especialização${nomeArea ? ` em ${nomeArea}` : ''})`;
  else tipoTrabalho = `Trabalho de Conclusão de Curso (Graduação${nomeArea ? ` em ${nomeArea}` : ''})`;
  return { tipo, tipoTrabalho };
}

function blocos(linhas: LinhaPdf[]): LinhaPdf[][] {
  const r: LinhaPdf[][] = [];
  for (const l of linhas) {
    const ult = r[r.length - 1]?.at(-1);
    if (ult && ult.y - l.y <= Math.max(ult.altura, l.altura) * 1.9 && Math.abs(ult.altura - l.altura) < 1.5 && !/^\p{Ll}/u.test(l.texto.trim()) === !/^\p{Ll}/u.test(ult.texto.trim()) || (ult && /:$/.test(ult.texto.trim()) && ult.y - l.y <= ult.altura * 2.5)) r[r.length - 1].push(l);
    else r.push([l]);
  }
  return r;
}

function lerCapaDeTrabalho(linhas: LinhaPdf[], tipo: { tipo: TipoPublicacao; tipoTrabalho?: string }): LeituraDaCapa {
  const dados: DadosDaCapa = { tipo: tipo.tipo, tipoTrabalho: tipo.tipoTrabalho };
  const avisos: string[] = [];
  const texto = (l: LinhaPdf) => semIndices(l.texto);
  // ano e local: a última linha com só um ano ("2020" ou "São Paulo, 2020" / "São Paulo – 2020")
  let fim = linhas.length;
  for (let i = linhas.length - 1; i >= Math.max(0, linhas.length - 4); i--) {
    const t = texto(linhas[i]);
    const m = new RegExp(`^(?:([\\p{L} '-]{3,40}?)\\s*[,–-]\\s*)?${ANO}\\.?$`, 'u').exec(t);
    if (!m) continue;
    dados.ano = Number(m[2]);
    fim = i;
    const local = m[1] ?? (i > 0 && /^[\p{L} '-]{3,40}$/u.test(texto(linhas[i - 1])) && !INSTITUICAO.test(texto(linhas[i - 1])) ? texto(linhas[i - 1]) : undefined);
    if (local) {
      dados.localPublicacao = todoMaiusculo(local) ? nomeProprio(local) : local;
      if (!m[1]) fim = i - 1;
    }
    break;
  }
  const corpo = linhas.slice(0, fim);
  // instituição: linhas do topo com UNIVERSIDADE, FACULDADE...
  const inst: string[] = [];
  let i = 0;
  while (i < corpo.length && (INSTITUICAO.test(texto(corpo[i])) || SUB_INSTITUICAO.test(texto(corpo[i])))) inst.push(texto(corpo[i++]));
  if (inst.length) {
    const nomes = inst.map((s) => (todoMaiusculo(s) ? nomeProprio(s) : s));
    const universidade = nomes.find((s) => /^(universidade|university|centro universit|funda)/i.test(s));
    const unidade = nomes.find((s) => /^(faculdade|escola|instituto)/i.test(s) && s !== universidade);
    dados.veiculo = [unidade, universidade ?? (unidade ? undefined : nomes[0])].filter(Boolean).join(', ');
  }
  // o que sobra: autor(es) e título, separados por espaço em branco
  const resto = blocos(corpo.slice(i)).filter((b) => !b.every((l) => /orientador|orientadora|advisor|apresentad|disserta|tese |monografia|trabalho de conclus/i.test(texto(l))));
  const ehNatureza = (b: LinhaPdf[]) => /apresentad[ao]|requisito|obten[çc][ãa]o do t[íi]tulo|orientador/i.test(b.map(texto).join(' '));
  const candidatos = resto.filter((b) => !ehNatureza(b));
  const ehAutor = (b: LinhaPdf[]) => b.length <= 4 && b.every((l) => lerNomes(texto(l))?.length === 1);
  const primeiroAutor = candidatos.findIndex(ehAutor);
  const blocosAutor = new Set<number>();
  for (let k = primeiroAutor; k >= 0 && k < candidatos.length && ehAutor(candidatos[k]); k++) blocosAutor.add(k);
  if (blocosAutor.size) dados.autores = [...blocosAutor].flatMap((k) => candidatos[k].map((l) => autorDoNome(lerNomes(texto(l))![0])));
  const semAutor = candidatos.filter((_, k) => !blocosAutor.has(k));
  const maior = Math.max(...semAutor.map((b) => b[0].altura));
  const blocoTitulo = semAutor.find((b) => b[0].altura >= maior - 0.5) ?? semAutor[0];
  if (blocoTitulo) {
    let titulo = blocoTitulo.map(texto).join(' ');
    // subtítulo em bloco logo abaixo, menor
    const prox = semAutor[semAutor.indexOf(blocoTitulo) + 1];
    if (prox && !ehNatureza(prox) && prox.length <= 3) {
      if (/:$/.test(titulo)) titulo += ` ${prox.map(texto).join(' ')}`;
      else if (prox[0].altura < blocoTitulo[0].altura && titulo.indexOf(':') < 0) titulo += `: ${prox.map(texto).join(' ')}`;
    }
    aplicarTitulo(dados, titulo, avisos);
  }
  return { dados, avisos };
}

// ---------------------------------------------------------------------
// Artigos
// ---------------------------------------------------------------------

const CABECALHO = /^(ISSN|e-?ISSN|doi|https?:|www\.|vol\.|volume|p[áa]gina|page|recebido|received|aceito|accepted|publicado|published|copyright|©|licen|creative commons|open access|acesso aberto|citation|como citar|how to cite|correspond)/i;
/** Rótulos de seção da revista ("ARTIGO ORIGINAL", "Revisão"), que não são o título. */
const ROTULO_SECAO = /^(artigo|article|original|research|review|revis[aã]o|relato|case report|editorial|comunica[çc][ãa]o|ensaio|nota|carta|perspectiva)( (original|de (caso|experi[êe]ncia|literatura)|breve|article|paper|integrativa|sistem[áa]tica))?\.?$/i;

function aplicarTitulo(dados: DadosDaCapa, bruto: string, avisos: string[]) {
  const titulo = bruto.replace(/\s+/g, ' ').replace(/\s*[.;]\s*$/, '').trim();
  const i = titulo.indexOf(': ');
  const partes = i >= 3 && i < titulo.length - 4 ? [titulo.slice(0, i).trim(), titulo.slice(i + 2).trim()] : [titulo];
  let convertido = false;
  const [t, sub] = partes.map((p, k) => {
    if (!todoMaiusculo(p) || (!todoMaiusculo(titulo) && p.split(' ').length < 3)) return p;
    convertido = true;
    return k === 0 ? frase(p) : frase(p).toLocaleLowerCase('pt-BR') === frase(p) ? p.toLocaleLowerCase('pt-BR') : frase(p).charAt(0).toLocaleLowerCase('pt-BR') + frase(p).slice(1);
  });
  if (convertido) avisos.push('O título estava em maiúsculas no PDF; confira siglas e nomes próprios.');
  dados.titulo = t;
  if (sub) dados.subtitulo = sub;
}

const REVISTA = /\b(journal|revista|rev\.?|jornal|arquivos|cadernos|anais|annals|acta|proceedings|bulletin|boletim|archives|letters|reports|magazine|review of)\b/i;
const FIM_DOS_NOMES = /^(resumo|abstract|resumen|palavras|keywords|introdu|descritores|\^?\d+\^?\s*\p{L}|e-?mail)/iu;

/** Nomes nas linhas logo abaixo do título (os nomes podem continuar na linha seguinte). */
function nomesAbaixo(linhas: LinhaPdf[], inicio: number): string[] {
  const soIndices = (l: LinhaPdf) => /^[\d\s*†‡,^a-f]{1,12}$/.test(l.texto) && /[\d*†‡]/.test(l.texto);
  for (let j = inicio; j < Math.min(linhas.length, inicio + 5); j++) {
    if (FIM_DOS_NOMES.test(semIndices(linhas[j].texto)) && !/^\^/.test(linhas[j].texto)) return [];
    if (soIndices(linhas[j])) continue;
    // junta continuações (mesma letra, logo abaixo): nomes que seguem na linha de baixo
    let texto = linhas[j].texto;
    let melhor = lerNomes(texto);
    if (!melhor) continue; // ex.: o título traduzido, entre o título e os nomes
    for (let k = j + 1; k < Math.min(linhas.length, j + 6); k++) {
      const l = linhas[k];
      if (soIndices(l)) { texto += '^*^'; continue; }
      if (Math.abs(l.altura - linhas[j].altura) > 0.6 || FIM_DOS_NOMES.test(l.texto) || /^\^/.test(l.texto)) break;
      const junto = lerNomes(`${texto} ${l.texto}`);
      if (!junto) break;
      texto = `${texto} ${l.texto}`;
      melhor = junto;
    }
    return melhor;
  }
  return [];
}

function lerCapaDeArtigo(linhas: LinhaPdf[], textoInicio: string): LeituraDaCapa {
  const dados: DadosDaCapa = {};
  const avisos: string[] = [];
  const pesoTotal = new Map<number, number>();
  for (const l of linhas) pesoTotal.set(l.altura, (pesoTotal.get(l.altura) ?? 0) + l.texto.length);
  const corpo = [...pesoTotal.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
  // título: as linhas de letra maior (na metade de cima), que não sejam cabeçalho da revista
  const limite = Math.ceil(linhas.length * 0.6);
  const ehCandidata = (l: LinhaPdf) => l.altura >= corpo * 1.15 && letras(l.texto).length >= 3 && !CABECALHO.test(semIndices(l.texto)) && !lerFasciculo(l.texto);
  const rotulo = (q: LinhaPdf[]) => q.length === 1 && ROTULO_SECAO.test(semIndices(q[0].texto));
  // sequências de linhas grandes, do mesmo tamanho e próximas: cada uma pode ser o título
  const sequencias: LinhaPdf[][] = [];
  for (const l of linhas.slice(0, limite)) {
    const ult = sequencias.at(-1)?.at(-1);
    if (!ehCandidata(l)) { if (ult) sequencias.push([]); continue; }
    if (ult && Math.abs(l.altura - ult.altura) <= 0.6 && ult.y - l.y <= ult.altura * 2.2) sequencias.at(-1)!.push(l);
    else sequencias.push([l]);
  }
  const opcoes = sequencias
    .filter((q) => q.length && !rotulo(q) && letras(q.map((l) => l.texto).join('')).length >= 10)
    .filter((q) => { const n = lerNomes(q.map((l) => l.texto).join(' ')); return !n || (n.length === 1 && !/\^/.test(q[0].texto)); }) // linha de nomes não é título
    .map((q) => ({ q, nomes: nomesAbaixo(linhas, linhas.indexOf(q[q.length - 1]) + 1), revista: q.length === 1 && REVISTA.test(q[0].texto) }));
  // prefere o título que tem nomes de autores logo abaixo; depois, a letra maior que não seja nome de revista
  const escolhida =
    opcoes.filter((o) => o.nomes.length && !o.revista).sort((x, y) => y.q[0].altura - x.q[0].altura)[0] ??
    opcoes.filter((o) => !o.revista).sort((x, y) => y.q[0].altura - x.q[0].altura)[0];
  if (escolhida) {
    aplicarTitulo(dados, escolhida.q.map((l) => semIndices(l.texto)).join(' '), avisos);
    if (escolhida.nomes.length) dados.autores = escolhida.nomes.map(autorDoNome);
  }
  const fasciculo = lerFasciculo(textoInicio);
  if (fasciculo) {
    for (const [k, v] of Object.entries(fasciculo)) if (v !== undefined && v !== '') (dados as Record<string, unknown>)[k] = v;
  }
  dados.ano ??= anoDaPublicacao(textoInicio);
  if (dados.titulo && (fasciculo?.veiculo || /\b(resumo|abstract)\b/i.test(textoInicio))) dados.tipo = 'artigo_periodico';
  return { dados, avisos };
}

// ---------------------------------------------------------------------
// Metadados gravados no arquivo
// ---------------------------------------------------------------------

function tituloDoArquivo(info?: Record<string, unknown>): string | undefined {
  const t = typeof info?.Title === 'string' ? info.Title.replace(/\s+/g, ' ').trim() : '';
  if (letras(t).length < 10 || t.split(' ').length < 3 || /\.(docx?|pdf|tex|odt|rtf|indd)\b|microsoft|untitled|sem t[íi]tulo|^document|^apresenta|^slide/i.test(t)) return undefined;
  return t;
}

const comparavel = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function autoresDoArquivo(info?: Record<string, unknown>): Autor[] | undefined {
  const a = typeof info?.Author === 'string' ? info.Author.trim() : '';
  if (!a) return undefined;
  const nomes = lerNomes(a);
  return nomes?.length ? nomes.map(autorDoNome) : undefined;
}

// ---------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------

/**
 * @param paginas linhas das primeiras páginas (1ª página primeiro)
 * @param info metadados do arquivo (Title, Author), quando houver
 */
export function lerCapa(paginas: LinhaPdf[][], info?: Record<string, unknown>): LeituraDaCapa {
  const primeira = paginas[0] ?? [];
  const textoInicio = paginas.slice(0, 3).map((p) => p.map((l) => l.texto).join('\n')).join('\n');
  const trabalho = tipoDoTrabalho(textoInicio);
  const r = trabalho ? lerCapaDeTrabalho(primeira, trabalho) : lerCapaDeArtigo(primeira, textoInicio);
  // Metadados do arquivo: usados quando a página não deu resultado, ou quando conferem com o que
  // está escrito na 1ª página (aí são mais precisos: nomes separados, maiúsculas originais).
  const naPagina = comparavel(primeira.map((l) => semIndices(l.texto)).join(' '));
  const doArquivo = tituloDoArquivo(info);
  if (doArquivo && (!r.dados.titulo || naPagina.includes(comparavel(doArquivo)))) {
    r.dados.subtitulo = undefined;
    r.avisos = r.avisos.filter((a) => !a.startsWith('O título estava'));
    aplicarTitulo(r.dados, doArquivo, r.avisos);
  }
  const autoresArq = autoresDoArquivo(info);
  if (autoresArq && (!r.dados.autores?.length || autoresArq.length >= r.dados.autores.length && autoresArq.every((a) => naPagina.includes(comparavel(`${a.prenomes ?? ''} ${a.sobrenome}`))))) r.dados.autores = autoresArq;
  for (const [k, v] of Object.entries(r.dados)) if (v === undefined || v === '') delete (r.dados as Record<string, unknown>)[k];
  return r;
}
