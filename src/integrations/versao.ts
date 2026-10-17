// Atualizações da plataforma com a página já aberta.
// A cada publicação, os arquivos ganham nomes novos e os antigos deixam de existir. Uma aba aberta
// antes disso ainda procura os nomes antigos quando carrega uma parte sob demanda (ex.: o leitor de
// PDF) e falha com "Failed to fetch dynamically imported module". Aqui: (1) tentamos de novo e, se
// não der, explicamos em português; (2) avisamos quando há uma versão nova, para recarregar a tempo.

export const MENSAGEM_VERSAO_NOVA =
  'A plataforma foi atualizada enquanto esta página estava aberta. Recarregue a página (tecla F5) e tente de novo; seus dados continuam salvos.';

const ehFalhaDeCarregamento = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i.test(String((e as Error)?.message ?? e));

/** Carrega um módulo sob demanda; se o arquivo não existir mais (versão nova publicada), explica. */
export async function carregarModulo<T>(carregar: () => Promise<T>): Promise<T> {
  try {
    return await carregar();
  } catch (e) {
    if (!ehFalhaDeCarregamento(e)) throw e;
    try {
      return await carregar();
    } catch {
      throw new Error(MENSAGEM_VERSAO_NOVA);
    }
  }
}

const padraoScript = /<script[^>]+type="module"[^>]+src="([^"]*assets\/[^"]+)"/;

/** Endereço do script principal desta página (só existe na versão publicada). */
export function scriptAtual(doc: Document = document): string | null {
  const s = doc.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/"]');
  return s ? new URL(s.getAttribute('src')!, doc.baseURI).pathname : null;
}

/** Compara com a página publicada agora. Sem internet ou em desenvolvimento, responde false. */
export async function haVersaoNova(): Promise<boolean> {
  const atual = scriptAtual();
  if (!atual) return false;
  try {
    const r = await fetch(location.pathname, { cache: 'no-store' });
    if (!r.ok) return false;
    const m = padraoScript.exec(await r.text());
    return !!m && new URL(m[1], location.href).pathname !== atual;
  } catch {
    return false;
  }
}
