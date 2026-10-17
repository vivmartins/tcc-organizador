// Tradução de palavras-chave e tópicos para o português.
// 1º) Tradutor EMBUTIDO no navegador (Chrome 138+ e Edge 148+, no computador): traduz no próprio aparelho.
// 2º) Se ele não existir ou não responder, o serviço gratuito MyMemory (api.mymemory.translated.net).
//     Só vão para lá os termos curtos que vieram do artigo (públicos, do OpenAlex ou do PDF), nunca
//     dados da pessoa nem o texto do TCC.
// Se nenhum dos dois funcionar, devolvemos null e os termos estrangeiros NÃO são usados.

import { juntarPalavrasChave } from '../domain/palavrasChave.ts';

export type IdiomaOrigem = 'en' | 'es';

interface Tradutor {
  translate(texto: string): Promise<string>;
}
interface ApiTradutor {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<Tradutor>;
}

/** Tempo máximo para o navegador preparar o tradutor (na 1ª vez ele baixa o pacote de idioma) e para cada termo. */
export const LIMITE_PREPARO_MS = 60_000;
export const LIMITE_TERMO_MS = 15_000;

function comLimite<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(null); });
  });
}

const api = () => (globalThis as unknown as { Translator?: ApiTradutor }).Translator;
const cache = new Map<IdiomaOrigem, Promise<Tradutor | null>>();

/** O navegador tem o tradutor embutido? */
export const tradutorExiste = () => !!api();

/** Por que a última tentativa de tradução falhou (para explicar à pessoa). */
export type MotivoSemTraducao = 'sem_api' | 'baixando' | 'indisponivel' | 'erro';
let motivo: MotivoSemTraducao | null = null;
export const motivoSemTraducao = () => motivo;

/**
 * Prepara o tradutor. Chame logo no clique do botão (antes de qualquer espera), porque o navegador
 * só baixa o pacote de idioma em resposta a uma ação da pessoa.
 */
export function prepararTradutor(de: IdiomaOrigem): Promise<Tradutor | null> {
  const existente = cache.get(de);
  if (existente) return existente;
  const T = api();
  if (!T) motivo = 'sem_api';
  const p: Promise<Tradutor | null> = !T
    ? Promise.resolve(null)
    : (async () => {
        try {
          const opcoes = { sourceLanguage: de, targetLanguage: 'pt' };
          const disp = await comLimite(T.availability(opcoes), LIMITE_TERMO_MS);
          if (disp === 'unavailable') { motivo = 'indisponivel'; return null; }
          const t = await comLimite(T.create(opcoes), LIMITE_PREPARO_MS);
          // sem resposta enquanto o pacote de idioma ainda é baixado
          motivo = t ? null : disp === 'downloadable' || disp === 'downloading' ? 'baixando' : 'erro';
          return t;
        } catch {
          motivo = 'erro';
          return null;
        }
      })();
  cache.set(de, p);
  void p.then((t) => { if (!t) cache.delete(de); }); // permite tentar de novo depois
  return p;
}

const arrumar = (bruto: string) => {
  const t = bruto.trim().replace(/[.。]+$/, '');
  return t ? t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1) : '';
};

async function comEmbutido(termos: string[], de: IdiomaOrigem): Promise<string[] | null> {
  const tradutor = await prepararTradutor(de);
  if (!tradutor) return null;
  const traduzidos: string[] = [];
  for (const termo of termos) {
    try {
      const bruto = await comLimite(tradutor.translate(termo), LIMITE_TERMO_MS);
      if (bruto === null) return null;
      traduzidos.push(arrumar(bruto));
    } catch {
      return null;
    }
  }
  return traduzidos;
}

export const ENDERECO_MYMEMORY = 'https://api.mymemory.translated.net/get';
const memoriaOnline = new Map<string, string>();

async function umTermoOnline(termo: string, de: IdiomaOrigem): Promise<string | null> {
  const chave = `${de}|${termo.toLowerCase()}`;
  const salvo = memoriaOnline.get(chave);
  if (salvo) return salvo;
  const url = `${ENDERECO_MYMEMORY}?q=${encodeURIComponent(termo)}&langpair=${de}|pt-BR`;
  const resposta = await comLimite(fetch(url).then((r) => (r.ok ? r.json() : null)), LIMITE_TERMO_MS);
  const texto: unknown = resposta?.responseData?.translatedText;
  if (typeof texto !== 'string' || !texto.trim() || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(texto)) return null;
  if (resposta.responseStatus && Number(resposta.responseStatus) !== 200) return null;
  // o serviço devolve entidades HTML em alguns casos (&#39;)
  const limpo = texto.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  memoriaOnline.set(chave, limpo);
  return limpo;
}

async function comServicoOnline(termos: string[], de: IdiomaOrigem): Promise<string[] | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const r = await Promise.all(termos.slice(0, 25).map((t) => umTermoOnline(t, de)));
    if (r.some((t) => t === null)) return null;
    return (r as string[]).map(arrumar);
  } catch {
    return null;
  }
}

/** Traduz uma lista de termos curtos. Devolve null se a tradução não estiver disponível. */
export async function traduzirTermos(termos: string[], de: IdiomaOrigem, opcoes: { online?: boolean } = {}): Promise<string[] | null> {
  if (termos.length === 0) return [];
  const traduzidos = (await comEmbutido(termos, de)) ?? (opcoes.online === false ? null : await comServicoOnline(termos, de));
  if (!traduzidos) return null;
  motivo = null;
  return juntarPalavrasChave(traduzidos.filter(Boolean));
}

/** Só para os testes: esquece os tradutores preparados. */
export function _limparCacheDeTradutores() {
  cache.clear();
  memoriaOnline.clear();
}
