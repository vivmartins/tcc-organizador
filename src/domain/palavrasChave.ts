// Palavras-chave e sugestão de temas.
//
// 1) extrairPalavrasChave: lê a linha "Palavras-chave:" / "Descritores:" / "Keywords:" do texto
//    de um artigo (ex.: primeira página do PDF). São as palavras escolhidas pelos AUTORES.
// 2) sugerirTemasExistentes: aponta quais temas que a estudante já criou combinam com a fonte
//    (pelo título e pelas palavras-chave). Nada é aplicado sem ela aceitar.

import { normalizarParaBusca } from './busca.ts';

const ROTULOS: { idioma: 'pt' | 'es' | 'en'; re: RegExp }[] = [
  { idioma: 'pt', re: /\b(?:palavras?[\s-]*chaves?|descritores|unitermos)\s*[:：.\-–—]/i },
  { idioma: 'es', re: /\b(?:palabras[\s-]*claves?|descriptores)\s*[:：.\-–—]/i },
  { idioma: 'en', re: /\b(?:key[\s-]*words?|descriptors|index terms)\s*[:：.\-–—]/i },
];

/** Onde o bloco de palavras-chave termina: outro rótulo, início de seção ou dados editoriais. */
const FIM = /\n\s*\n|\b(?:palavras?[\s-]*chaves?|descritores|unitermos|palabras[\s-]*claves?|descriptores|key[\s-]*words?|descriptors|index terms)\s*[:：.\-–—]|\b(?:abstract|resumo|resumen|introdu[çc][ãa]o|introduction|introducci[óo]n|recebido|received|aceito|accepted|aprovado|como citar|how to cite|correspond[êe]ncia|correspondence|e-?mail|doi\s*:|https?:\/\/)/i;

function dividir(bloco: string): string[] {
  const linhas = bloco.replace(/\s+/g, ' ').trim();
  const separador = /;/.test(linhas) ? /;/ : /•|·|\|/.test(linhas) ? /[•·|]/ : /\.\s/.test(linhas) ? /\.\s/ : /,/;
  return linhas
    .split(separador)
    .map((p) => p.replace(/^[\s.,;:–—-]+|[\s.,;:–—-]+$/g, '').trim())
    .filter((p) => p.length >= 2 && p.length <= 80 && p.split(' ').length <= 8 && !/^\d+$/.test(p));
}

export interface PalavrasEncontradas {
  idioma: 'pt' | 'es' | 'en';
  termos: string[];
}

/** Palavras-chave dos autores, preferindo as em português. null se não encontrar. */
export function extrairPalavrasChave(texto: string, max = 12): PalavrasEncontradas | null {
  for (const { idioma, re } of ROTULOS) {
    const m = re.exec(texto);
    if (!m) continue;
    const resto = texto.slice(m.index + m[0].length, m.index + m[0].length + 500);
    const fim = FIM.exec(resto);
    const termos = dividir(fim ? resto.slice(0, fim.index) : resto);
    const unicos: string[] = [];
    for (const t of termos) if (!unicos.some((u) => normalizarParaBusca(u) === normalizarParaBusca(t))) unicos.push(t);
    if (unicos.length) return { idioma, termos: unicos.slice(0, max) };
  }
  return null;
}

/** Junta listas de palavras-chave sem repetir (ignorando acentos e maiúsculas). */
export function juntarPalavrasChave(...listas: (string[] | undefined)[]): string[] {
  const r: string[] = [];
  for (const l of listas) for (const p of l ?? []) {
    const t = p.trim();
    if (t && !r.some((x) => normalizarParaBusca(x) === normalizarParaBusca(t))) r.push(t);
  }
  return r;
}

/** Radical simples: "humanização" → "humaniz", para casar com "humanizado", "humanizar"… */
function radical(palavra: string): string {
  return palavra.length <= 5 ? palavra : palavra.slice(0, Math.max(5, palavra.length - 3));
}

const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'as', 'os', 'para', 'com', 'por', 'the', 'of', 'and', 'in']);

/** Temas já existentes no projeto que combinam com o título/subtítulo/palavras-chave da fonte. */
export function sugerirTemasExistentes(fonte: { titulo?: string; subtitulo?: string; palavrasChave?: string[] }, temas: string[]): string[] {
  const texto = normalizarParaBusca([fonte.titulo, fonte.subtitulo, ...(fonte.palavrasChave ?? [])].filter(Boolean).join(' '));
  if (!texto) return [];
  const palavrasTexto = texto.split(' ');
  return temas.filter((tema) => {
    const palavrasTema = normalizarParaBusca(tema).split(' ').filter((p) => p && !PALAVRAS_VAZIAS.has(p));
    if (palavrasTema.length === 0) return false;
    return palavrasTema.every((pt) => palavrasTexto.some((px) => px.startsWith(radical(pt))));
  });
}
