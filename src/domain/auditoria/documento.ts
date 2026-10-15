// O TCC lido do arquivo (Word ou PDF) e a separação entre o texto e a lista de referências.

import { normalizar } from './texto.ts';

export interface Paragrafo {
  texto: string;
  /** Recuo da margem esquerda em centímetros, quando o arquivo informa (citações longas usam 4 cm). */
  recuoCm?: number;
}

export interface DocumentoTcc {
  nomeArquivo: string;
  origem: 'docx' | 'pdf';
  paragrafos: Paragrafo[];
}

export interface ParagrafoCorpo extends Paragrafo {
  /** posição do parágrafo no documento (começa em 0) */
  indice: number;
}

export interface DocumentoSeparado {
  corpo: ParagrafoCorpo[];
  referencias: string[];
  achouReferencias: boolean;
}

const TITULO_REFERENCIAS = /^(\d+(\.\d+)*\.?\s+)?(referencias|referencias bibliograficas|bibliografia)$/;
const FIM_DAS_REFERENCIAS = /^(\d+(\.\d+)*\.?\s+)?(apendice|apendices|anexo|anexos|glossario|indice)\b/;

/** Uma referência ABNT começa com SOBRENOME, ENTIDADE ou TÍTULO em maiúsculas. */
const pareceInicioDeReferencia = (t: string) => /^(?:\p{Lu}{1,3}\s+)?\p{Lu}[\p{Lu}'’\-]+([ ,.;:]|$)/u.test(t.trim());

/** Separa o texto (corpo) da lista de referências. Usa o ÚLTIMO título "Referências" (o primeiro costuma estar no sumário). */
export function separarDocumento(doc: DocumentoTcc): DocumentoSeparado {
  const ps = doc.paragrafos;
  let inicioRefs = -1;
  for (let i = ps.length - 1; i >= 0; i--) {
    const n = normalizar(ps[i].texto);
    if (n.length < 40 && TITULO_REFERENCIAS.test(n)) {
      inicioRefs = i;
      break;
    }
  }
  const corpo: ParagrafoCorpo[] = [];
  const limite = inicioRefs < 0 ? ps.length : inicioRefs;
  for (let i = 0; i < limite; i++) if (ps[i].texto.trim()) corpo.push({ ...ps[i], indice: i });

  const referencias: string[] = [];
  if (inicioRefs >= 0) {
    for (let i = inicioRefs + 1; i < ps.length; i++) {
      const t = ps[i].texto.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const n = normalizar(t);
      if (n.length < 80 && FIM_DAS_REFERENCIAS.test(n)) {
        // o restante (apêndices e anexos) não é lido
        break;
      }
      // Pedaço que continua a referência anterior (quebra de linha no PDF)
      if (referencias.length && !pareceInicioDeReferencia(t)) referencias[referencias.length - 1] += ` ${t}`;
      else referencias.push(t);
    }
  }
  return { corpo, referencias, achouReferencias: inicioRefs >= 0 };
}
