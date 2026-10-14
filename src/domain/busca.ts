// Busca textual simples, sem diferenciar acentos nem maiúsculas.
// "humanizacao radio" encontra um registro que contenha
// "Humanização" e "Radioterapia" (todas as palavras precisam aparecer).

export function normalizarParaBusca(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function termosDaConsulta(consulta: string): string[] {
  return normalizarParaBusca(consulta).split(' ').filter(Boolean);
}

/** true se TODOS os termos aparecem em algum dos textos (como início de palavra ou dentro dela). */
export function corresponde(termos: string[], textos: (string | undefined | null)[]): boolean {
  if (termos.length === 0) return true;
  const alvo = normalizarParaBusca(textos.filter(Boolean).join(' '));
  return termos.every((t) => alvo.includes(t));
}
