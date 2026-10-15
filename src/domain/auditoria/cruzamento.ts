// Cruza as citações do texto com a lista de referências (e com as fontes da biblioteca).

import type { Citacao, CitacaoDireta, ObraCitada } from './citacoes.ts';
import { anoBase, type ReferenciaLida } from './referencias.ts';
import { normalizar } from './texto.ts';

/** Algo que pode ser citado: uma referência do TCC ou uma fonte da biblioteca. */
export interface Citavel {
  autores: string[];
  anos: string[];
  /** a entrada é o título (obra sem autor) */
  porTitulo?: boolean;
}

function anoConfere(citado: string, anos: string[]): boolean {
  if (anos.includes(citado)) return true;
  // "2020" citado e "2020a" na referência (ou o contrário): consideramos o mesmo ano
  return anos.some((a) => anoBase(a) === anoBase(citado) && (a === anoBase(a) || citado === anoBase(citado)));
}

function primeiroConfere(chave: string, item: Citavel, prefixo?: boolean): boolean {
  const a = item.autores[0];
  if (!a || !chave) return false;
  if (a === chave) return true;
  return (!!prefixo || !!item.porTitulo) && (a.startsWith(chave + ' ') || chave.startsWith(a + ' '));
}

export interface Encontro<T> {
  /** itens com o mesmo autor e ano */
  iguais: T[];
  /** itens com o mesmo autor, mas outro ano */
  mesmoAutor: T[];
}

/** Procura a obra citada numa lista (referências ou fontes), pelo primeiro autor e pelo ano. */
export function procurarObra<T extends Citavel>(obra: ObraCitada, lista: T[]): Encontro<T> {
  const autor = obra.autores[0];
  if (!autor) return { iguais: [], mesmoAutor: [] };
  for (const chave of autor.candidatos) {
    const mesmoAutor = lista.filter((r) => primeiroConfere(chave, r, autor.prefixo));
    if (mesmoAutor.length) {
      const iguais = mesmoAutor.filter((r) => anoConfere(obra.ano, r.anos));
      return { iguais, mesmoAutor: iguais.length ? [] : mesmoAutor };
    }
  }
  return { iguais: [], mesmoAutor: [] };
}

/** Como mostrar a obra citada: "Silva; Souza, 2020" ou "Silva et al., 2020". */
export function rotuloObra(o: ObraCitada): string {
  const nomes = o.autores.map((a) => {
    // na narrativa "Segundo Freire", mostra só o sobrenome provável
    const ultimo = a.candidatos.at(-1) ?? '';
    const palavras = a.escrito.split(' ');
    const n = palavras.length > 1 && normalizar(palavras.at(-1)!) === ultimo ? palavras.at(-1)! : a.escrito;
    return n + (a.prefixo ? '...' : '');
  });
  return `${nomes.join('; ')}${o.etAl ? ' et al.' : ''}, ${o.ano === 'sd' ? '[s. d.]' : o.ano}`;
}

export const chaveObra = (o: ObraCitada) => `${normalizar(rotuloObra(o).replace(/,[^,]*$/, ''))}|${o.ano}`;

export interface Ocorrencia {
  citacao: Citacao;
  obra: ObraCitada;
}

export interface ProblemaCitacao {
  tipo: 'sem_referencia' | 'ano_diferente';
  obra: string;
  ocorrencias: Ocorrencia[];
  /** para "ano diferente": as referências do mesmo autor */
  referencias: ReferenciaLida[];
}

export interface ResultadoCruzamento {
  totalCitacoes: number;
  totalObras: number;
  problemas: ProblemaCitacao[];
  naoCitadas: ReferenciaLida[];
  /** citações diretas sem página */
  semPagina: CitacaoDireta[];
  /** trechos entre aspas (ou recuados) sem citação perto */
  semAutoria: CitacaoDireta[];
  /** citações diretas entre aspas com mais de 40 palavras (podem passar de 3 linhas) */
  longasSemRecuo: CitacaoDireta[];
  estilos: { maiusculas: number; minusculas: number };
}

export function cruzarCitacoes(citacoes: Citacao[], diretas: CitacaoDireta[], referencias: ReferenciaLida[]): ResultadoCruzamento {
  const citadas = new Set<number>();
  const porChave = new Map<string, ProblemaCitacao>();
  const obrasVistas = new Set<string>();
  for (const c of citacoes) {
    for (const obra of c.obras) {
      obrasVistas.add(chaveObra(obra));
      const e = procurarObra(obra, referencias);
      e.iguais.forEach((r) => citadas.add(r.indice));
      if (e.iguais.length || obra.apudOriginal) continue;
      const tipo = e.mesmoAutor.length ? 'ano_diferente' : 'sem_referencia';
      const chave = `${tipo}|${chaveObra(obra)}`;
      const p = porChave.get(chave) ?? { tipo, obra: rotuloObra(obra), ocorrencias: [], referencias: e.mesmoAutor };
      p.ocorrencias.push({ citacao: c, obra });
      porChave.set(chave, p);
    }
  }
  const palavras = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;
  return {
    totalCitacoes: citacoes.length,
    totalObras: obrasVistas.size,
    problemas: [...porChave.values()].sort((a, b) => (a.tipo === b.tipo ? a.obra.localeCompare(b.obra) : a.tipo === 'sem_referencia' ? -1 : 1)),
    naoCitadas: referencias.filter((r) => !citadas.has(r.indice)),
    semPagina: diretas.filter((d) => d.citacao && !d.pagina),
    semAutoria: diretas.filter((d) => !d.citacao && (d.recuada || palavras(d.trecho) >= 8)),
    longasSemRecuo: diretas.filter((d) => !d.recuada && palavras(d.trecho) > 40),
    estilos: {
      maiusculas: citacoes.filter((c) => c.estilo === 'maiusculas').length,
      minusculas: citacoes.filter((c) => c.estilo === 'minusculas').length,
    },
  };
}
