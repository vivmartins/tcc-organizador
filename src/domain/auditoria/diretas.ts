// Citações diretas do TCC comparadas com os fichamentos (trecho original e página)
// e com o texto guardado da fonte.

import type { CitacaoDireta } from './citacoes.ts';
import type { FonteAuditoria } from './biblioteca.ts';
import { procurarObra } from './cruzamento.ts';
import { comparar, contemTrecho, paginasConferem, type PedacoDiferenca } from './comparar.ts';
import { palavras, type Palavra } from './texto.ts';

export type SituacaoDireta =
  | 'confere' //            igual ao fichamento ou ao texto da fonte
  | 'pagina_diferente' //   igual ao fichamento, mas com outra página
  | 'diferente' //          parecido, com palavras trocadas, a mais ou a menos
  | 'outra_fonte' //        o trecho é de outra fonte da biblioteca
  | 'nao_encontrada' //     não está nos fichamentos nem no texto da fonte
  | 'sem_material' //       a fonte não tem texto guardado nem fichas com trecho
  | 'fora_da_biblioteca'; // a obra citada não está cadastrada

export interface VerificacaoDireta {
  direta: CitacaoDireta;
  situacao: SituacaoDireta;
  fonte?: FonteAuditoria;
  /** onde o trecho foi encontrado */
  onde?: 'ficha' | 'texto';
  paginaFicha?: string;
  semelhanca?: number;
  trechoFonte?: string;
  diferencas?: PedacoDiferenca[];
}

const MINIMO_PARECIDO = 0.6;

/** Palavras de cada texto, calculadas uma vez só. */
function cacheDePalavras() {
  const m = new Map<string, Palavra[]>();
  return (t: string) => {
    let r = m.get(t);
    if (!r) { r = palavras(t); m.set(t, r); }
    return r;
  };
}

export function verificarDiretas(diretas: CitacaoDireta[], fontes: FonteAuditoria[]): VerificacaoDireta[] {
  const pal = cacheDePalavras();
  const r: VerificacaoDireta[] = [];
  for (const d of diretas) {
    if (!d.citacao) continue; // sem autoria: aparece em outro grupo
    const ligadas = [...new Set(d.citacao.obras.filter((o) => !o.apudOriginal).flatMap((o) => procurarObra(o, fontes).iguais))];
    if (!ligadas.length) {
      r.push({ direta: d, situacao: 'fora_da_biblioteca' });
      continue;
    }
    let melhor: VerificacaoDireta | null = null;
    let temMaterial = false;
    for (const f of ligadas) {
      for (const ficha of f.fichas) {
        temMaterial = true;
        if (contemTrecho(d.trecho, pal(ficha.trecho))) {
          const pg = paginasConferem(d.pagina, ficha.pagina);
          melhor = { direta: d, fonte: f, onde: 'ficha', paginaFicha: ficha.pagina, situacao: pg === false ? 'pagina_diferente' : 'confere', semelhanca: 1 };
          break;
        }
        const c = comparar(d.trecho, ficha.trecho, pal(ficha.trecho));
        if (c && c.semelhanca >= MINIMO_PARECIDO && (!melhor || (melhor.semelhanca ?? 0) < c.semelhanca))
          melhor = { direta: d, fonte: f, onde: 'ficha', paginaFicha: ficha.pagina, situacao: 'diferente', semelhanca: c.semelhanca, trechoFonte: c.trechoFonte, diferencas: c.diferencas };
      }
      if (melhor && melhor.situacao !== 'diferente') break;
      if (f.texto) {
        temMaterial = true;
        const alvo = pal(f.texto.texto);
        if (contemTrecho(d.trecho, alvo)) {
          melhor = { direta: d, fonte: f, onde: 'texto', situacao: 'confere', semelhanca: 1 };
          break;
        }
        const c = comparar(d.trecho, f.texto.texto, alvo);
        if (c && c.semelhanca >= MINIMO_PARECIDO && (!melhor || (melhor.semelhanca ?? 0) < c.semelhanca))
          melhor = { direta: d, fonte: f, onde: 'texto', situacao: 'diferente', semelhanca: c.semelhanca, trechoFonte: c.trechoFonte, diferencas: c.diferencas };
      }
    }
    if (melhor) {
      r.push(melhor);
      continue;
    }
    // Não está na fonte citada: está em outra fonte da biblioteca?
    const outra = fontes.find(
      (f) => !ligadas.includes(f) && (f.fichas.some((x) => contemTrecho(d.trecho, pal(x.trecho))) || (f.texto && contemTrecho(d.trecho, pal(f.texto.texto)))),
    );
    if (outra) r.push({ direta: d, situacao: 'outra_fonte', fonte: outra });
    else r.push({ direta: d, situacao: temMaterial ? 'nao_encontrada' : 'sem_material', fonte: ligadas[0] });
  }
  return r;
}
