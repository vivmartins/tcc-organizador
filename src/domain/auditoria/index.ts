// Auditoria do TCC: junta todas as verificações. Tudo roda no navegador; o arquivo do TCC não é guardado.

import { separarDocumento, type DocumentoTcc } from './documento.ts';
import { lerReferencias } from './referencias.ts';
import { encontrarCitacoes, encontrarCitacoesDiretas } from './citacoes.ts';
import { cruzarCitacoes, type ResultadoCruzamento } from './cruzamento.ts';
import { verificarDiretas, type VerificacaoDireta } from './diretas.ts';
import { checarCopia, type ResultadoCopia } from './copia.ts';
import type { FonteAuditoria } from './biblioteca.ts';
import type { ParagrafoCorpo } from './documento.ts';

export interface ResultadoAuditoria {
  nomeArquivo: string;
  corpo: ParagrafoCorpo[];
  achouReferencias: boolean;
  totalReferencias: number;
  palavrasNoTexto: number;
  citacoes: ResultadoCruzamento;
  diretas: VerificacaoDireta[];
  copia: ResultadoCopia;
  /** fontes da biblioteca sem texto guardado e sem fichas com trecho original */
  fontesSemMaterial: FonteAuditoria[];
}

export function auditar(doc: DocumentoTcc, fontes: FonteAuditoria[]): ResultadoAuditoria {
  const sep = separarDocumento(doc);
  const refs = lerReferencias(sep.referencias);
  const citacoes = encontrarCitacoes(sep.corpo);
  const diretas = encontrarCitacoesDiretas(sep.corpo, citacoes);
  return {
    nomeArquivo: doc.nomeArquivo,
    corpo: sep.corpo,
    achouReferencias: sep.achouReferencias,
    totalReferencias: refs.length,
    palavrasNoTexto: sep.corpo.reduce((s, p) => s + (p.texto.match(/[\p{L}\p{N}]+/gu) ?? []).length, 0),
    citacoes: cruzarCitacoes(citacoes, diretas, refs),
    diretas: verificarDiretas(diretas, fontes),
    copia: checarCopia(sep.corpo, citacoes, diretas, fontes),
    fontesSemMaterial: fontes.filter((f) => !f.texto && f.fichas.length === 0),
  };
}

export type { DocumentoTcc, Paragrafo } from './documento.ts';
export type { FonteAuditoria } from './biblioteca.ts';
export { prepararFonte } from './biblioteca.ts';
