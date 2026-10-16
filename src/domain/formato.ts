// Formato de referências e citações escolhido no projeto: ABNT (autor-data) ou Vancouver (numérico).
// As telas pedem a referência e a citação de uma fonte por aqui, sem precisar saber qual é a norma.

import type { DadosBibliograficos } from './tipos.ts';
import { gerarReferencia, type Referencia } from './abnt/referencia.ts';
import { gerarCitacao, type EstiloCitacao } from './abnt/citacao.ts';
import { chamadaVancouver, gerarReferenciaVancouver, type ChamadaVancouver } from './vancouver.ts';

export type NormaReferencias = 'abnt' | 'vancouver';

export interface FormatoReferencias {
  norma: NormaReferencias;
  /** ABNT: com 4+ autores, "et al." nas referências */
  etAl?: boolean;
  /** ABNT: sobrenome em MAIÚSCULAS na citação entre parênteses */
  maiusculas?: boolean;
  /** Vancouver: como o número aparece no texto */
  chamada?: ChamadaVancouver;
}

/** Lê as opções guardadas no projeto. */
export function formatoDoProjeto(p: { normaReferencias?: NormaReferencias; etAlNasReferencias?: boolean; citacaoMaiusculas?: boolean; chamadaVancouver?: ChamadaVancouver }): FormatoReferencias {
  return { norma: p.normaReferencias ?? 'abnt', etAl: p.etAlNasReferencias, maiusculas: p.citacaoMaiusculas, chamada: p.chamadaVancouver ?? 'sobrescrito' };
}

export const NOME_NORMA: Record<NormaReferencias, string> = {
  abnt: 'ABNT (NBR 6023:2025 e NBR 10520:2023)',
  vancouver: 'Vancouver',
};

type FonteNumerada = DadosBibliograficos & { numeroVancouver?: number };

export function referenciaDaFonte(f: FonteNumerada, fmt: FormatoReferencias): Referencia {
  return fmt.norma === 'vancouver' ? gerarReferenciaVancouver(f) : gerarReferencia(f, { etAlAPartirDe4: fmt.etAl });
}

export function citacaoDaFonte(f: FonteNumerada, fmt: FormatoReferencias, opcoes: { pagina?: string; estilo?: EstiloCitacao } = {}): string {
  if (fmt.norma === 'vancouver') return chamadaVancouver(f.numeroVancouver, fmt.chamada, opcoes.pagina);
  return gerarCitacao(f, { pagina: opcoes.pagina, estilo: opcoes.estilo, maiusculas: fmt.maiusculas });
}

/** Lista para a seção REFERÊNCIAS: ABNT em ordem alfabética; Vancouver na ordem dos números
 *  (as fontes ainda sem número vão no fim, marcadas com "[nº?]"). */
export function listaDeReferencias(fontes: FonteNumerada[], fmt: FormatoReferencias): { texto: string; html: string; semNumero: number } {
  if (fmt.norma !== 'vancouver') {
    const refs = fontes.map((f) => gerarReferencia(f, { etAlAPartirDe4: fmt.etAl })).sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR', { sensitivity: 'base' }));
    return { texto: refs.map((r) => r.texto).join('\n\n'), html: refs.map((r) => `<p>${r.html}</p>`).join('\n'), semNumero: 0 };
  }
  const ordenadas = [...fontes].sort((a, b) => (a.numeroVancouver ?? Infinity) - (b.numeroVancouver ?? Infinity) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  const linhas = ordenadas.map((f) => ({ n: f.numeroVancouver ? `${f.numeroVancouver}.` : '[nº?]', r: gerarReferenciaVancouver(f) }));
  return {
    texto: linhas.map((l) => `${l.n} ${l.r.texto}`).join('\n'),
    html: linhas.map((l) => `<p>${l.n} ${l.r.html}</p>`).join('\n'),
    semNumero: ordenadas.filter((f) => !f.numeroVancouver).length,
  };
}
