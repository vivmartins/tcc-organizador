// Citações no texto — ABNT NBR 10520:2023 (sistema autor-data).
//
// Principais regras aplicadas:
//  * Sobrenome com inicial maiúscula e demais minúsculas: (Silva, 2021, p. 15).
//  * Até 3 autores separados por ponto e vírgula entre parênteses: (Silva; Souza; Lima, 2021).
//    Na forma narrativa: "Silva, Souza e Lima (2021)".
//  * 4 ou mais autores: primeiro autor seguido de "et al.".
//  * Opção "maiusculas" (padrão anterior, ainda exigido por algumas instituições): entre parênteses o
//    sobrenome vai em MAIÚSCULAS — (SILVA; SOUZA, 2021), (SZYCHOT et al., 2014). Na forma narrativa
//    continua só a inicial maiúscula: "Silva (2021)".
//  * Entidade: nome por extenso como cadastrado; com hierarquia ("Brasil. Ministério da Saúde"),
//    usa-se a primeira parte.
//  * Sem autoria: primeira palavra do título (e a seguinte, se for artigo) seguida de [...].

import type { Autor, DadosBibliograficos } from '../tipos.ts';
import { formatarPaginas } from './referencia.ts';
import { entradaDoAutor } from './nomes.ts';

export type EstiloCitacao = 'parentetica' | 'narrativa';

export interface OpcoesCitacao {
  estilo?: EstiloCitacao;
  /** Página ou localização do trecho (ex.: "15", "15-16", "seção 3"). */
  pagina?: string;
  /** Sobrenome em MAIÚSCULAS na citação entre parênteses. */
  maiusculas?: boolean;
}

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', "d'", 'van', 'von', 'del', 'della', 'di', 'du']);
const ARTIGOS = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'the', 'an', 'el', 'la', 'los', 'las', 'le', 'les']);

const limpo = (s?: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

/** "SILVA FILHO" → "Silva Filho"; "DE OLIVEIRA" → "de Oliveira" (só altera nomes todos em maiúsculas). */
export function capitalizarSobrenome(s: string): string {
  const t = limpo(s);
  if (t !== t.toLocaleUpperCase('pt-BR')) return t; // já veio em caixa mista: respeitar
  return t
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1)))
    .map((p) => p.replace(/-(\p{L})/gu, (_, l: string) => `-${l.toLocaleUpperCase('pt-BR')}`))
    .join(' ');
}

function nomeNaCitacao(a: Autor): string {
  if (a.tipo === 'entidade') {
    const n = limpo(a.sobrenome);
    const i = n.indexOf('. ');
    return i === -1 ? n : n.slice(0, i);
  }
  return capitalizarSobrenome(entradaDoAutor(a).sobrenome);
}

function entradaPorTitulo(titulo: string): string {
  const palavras = limpo(titulo).split(' ').filter(Boolean);
  if (palavras.length === 0) return '[Título?]';
  const n = palavras.length > 1 && ARTIGOS.has(palavras[0].toLowerCase()) ? 2 : 1;
  const trecho = palavras.slice(0, n).join(' ').replace(/[.,:;]+$/, '');
  return `${trecho.charAt(0).toLocaleUpperCase('pt-BR')}${trecho.slice(1)} [...]`;
}

function autoria(d: DadosBibliograficos, estilo: EstiloCitacao, maiusculas = false): string {
  const caixa = (s: string) => (maiusculas && estilo === 'parentetica' ? s.toLocaleUpperCase('pt-BR') : s);
  const nomes = (d.autores ?? []).filter((a) => limpo(a.sobrenome)).map((a) => caixa(nomeNaCitacao(a)));
  if (nomes.length === 0) {
    const e = entradaPorTitulo(d.titulo);
    return e.endsWith(' [...]') ? `${caixa(e.slice(0, -6))} [...]` : caixa(e);
  }
  if (nomes.length >= 4) return `${nomes[0]} et al.`;
  if (estilo === 'parentetica') return nomes.join('; ');
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export function gerarCitacao(d: DadosBibliograficos, opcoes: OpcoesCitacao = {}): string {
  const estilo = opcoes.estilo ?? 'parentetica';
  const ano = d.ano ? String(d.ano) : '[ano?]';
  const pagina = limpo(opcoes.pagina);
  const local = pagina
    ? /^\d/.test(pagina) || /^p\.?\s/i.test(pagina)
      ? `, ${formatarPaginas(pagina)}`
      : `, ${pagina}`
    : '';
  const quem = autoria(d, estilo, opcoes.maiusculas);
  return estilo === 'parentetica' ? `(${quem}, ${ano}${local})` : `${quem} (${ano}${local})`;
}
