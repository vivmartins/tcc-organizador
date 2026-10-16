// Regras dos fichamentos: validação e montagem da "ficha completa" para copiar.
// O trecho original é SEMPRE preservado exatamente como foi digitado.

import type { DadosBibliograficos } from './tipos.ts';
import { gerarCitacao } from './abnt/citacao.ts';
import { gerarReferencia } from './abnt/referencia.ts';

export type TipoFichamento = 'citacao_direta' | 'citacao_indireta' | 'resumo' | 'ideia' | 'dado_relevante';

export const ROTULO_TIPO_FICHAMENTO: Record<TipoFichamento, string> = {
  citacao_direta: 'Citação direta',
  citacao_indireta: 'Citação indireta',
  resumo: 'Resumo',
  ideia: 'Ideia para desenvolver',
  dado_relevante: 'Dado ou resultado relevante',
};

export const ORDEM_TIPOS_FICHAMENTO = Object.keys(ROTULO_TIPO_FICHAMENTO) as TipoFichamento[];

export interface ConteudoFicha {
  tipo: TipoFichamento;
  trechoOriginal?: string;
  pagina?: string;
  parafrase?: string;
  interpretacao?: string;
  tema?: string;
  capituloSecao?: string;
}

const tem = (s?: string) => !!s?.trim();

export function validarFicha(f: ConteudoFicha): Record<string, string> {
  const erros: Record<string, string> = {};
  if (f.tipo === 'citacao_direta' && !tem(f.trechoOriginal)) {
    erros.trechoOriginal = 'Na citação direta, registre o trecho original.';
  }
  if (f.tipo === 'citacao_direta' && !tem(f.pagina)) {
    erros.pagina = 'A ABNT exige a página (ou localização) na citação direta.';
  }
  if (!tem(f.trechoOriginal) && !tem(f.parafrase) && !tem(f.interpretacao)) {
    erros.geral = 'Preencha pelo menos o trecho original, o resumo/paráfrase ou a interpretação.';
  }
  return erros;
}

/** Texto da ficha completa: conteúdo + identificação da fonte (citação e referência). */
export function textoDaFicha(f: ConteudoFicha, fonte: DadosBibliograficos, opcoes: { etAlAPartirDe4?: boolean; citacaoMaiusculas?: boolean } = {}): string {
  const partes: string[] = [`[${ROTULO_TIPO_FICHAMENTO[f.tipo]}]${tem(f.tema) ? ` Tema: ${f.tema!.trim()}` : ''}`];
  const citacao = gerarCitacao(fonte, { pagina: f.pagina, maiusculas: opcoes.citacaoMaiusculas });
  if (tem(f.trechoOriginal)) partes.push(`“${f.trechoOriginal}” ${citacao}`);
  if (tem(f.parafrase)) partes.push(`Resumo/paráfrase: ${f.parafrase!.trim()}${tem(f.trechoOriginal) ? '' : ` ${citacao}`}`);
  if (tem(f.interpretacao)) partes.push(`Minha interpretação: ${f.interpretacao!.trim()}`);
  if (tem(f.capituloSecao)) partes.push(`Uso no TCC: ${f.capituloSecao!.trim()}`);
  partes.push(`Fonte: ${gerarReferencia(fonte, opcoes).texto}`);
  return partes.join('\n\n');
}
