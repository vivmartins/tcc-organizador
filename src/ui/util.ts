/** Copia texto (e, quando possível, a versão com negrito para colar no Word/Docs). */
export async function copiar(texto: string, html?: string): Promise<void> {
  if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([texto], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ]);
      return;
    } catch {
      /* alguns navegadores só aceitam texto simples */
    }
  }
  await navigator.clipboard.writeText(texto);
}

/** "2027-06-30" → "30/06/2027" (sem problemas de fuso horário). */
export function dataCurta(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  if (iso.length > 10) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  }
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Dias inteiros de hoje até a data (negativo = já passou). */
export function diasAte(iso: string, hoje = new Date()): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const alvo = Date.UTC(a, m - 1, d);
  const base = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo - base) / 86_400_000);
}

export function hojeIso(hoje = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}`;
}

export function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
