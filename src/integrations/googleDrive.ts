// Google Drive: login (Google Identity Services) e o arquivo de sincronização.
//
// O arquivo fica na "pasta de dados do app" do Drive da própria pessoa (appDataFolder): um espaço
// escondido que só esta plataforma enxerga. Ela não tem acesso a nenhum outro arquivo do Drive.
// Não há servidor nosso no meio: o navegador conversa direto com o Google.

import { ID_CLIENTE_GOOGLE } from '../configuracao.ts';
export { ID_CLIENTE_GOOGLE };
export const ESCOPOS = 'https://www.googleapis.com/auth/drive.appdata openid email';
export const NOME_ARQUIVO = 'organizador-tcc-sincronizacao.json';

export const driveConfigurado = () => !!ID_CLIENTE_GOOGLE;

export class ErroDrive extends Error {
  readonly precisaEntrar: boolean;
  constructor(mensagem: string, precisaEntrar = false) {
    super(mensagem);
    this.precisaEntrar = precisaEntrar;
  }
}

// ---------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------

interface RespostaToken { access_token?: string; expires_in?: number; error?: string; error_description?: string }
interface ClienteToken { requestAccessToken(o?: { prompt?: string; login_hint?: string }): void }
interface GoogleOauth2 {
  initTokenClient(o: { client_id: string; scope: string; callback: (r: RespostaToken) => void; error_callback?: (e: { type?: string; message?: string }) => void }): ClienteToken;
  revoke(token: string, cb?: () => void): void;
}
const google = () => (globalThis as unknown as { google?: { accounts?: { oauth2?: GoogleOauth2 } } }).google?.accounts?.oauth2;

let carregandoScript: Promise<void> | null = null;
export function carregarGoogle(): Promise<void> {
  if (google()) return Promise.resolve();
  carregandoScript ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { carregandoScript = null; reject(new ErroDrive('Não foi possível carregar o login do Google. Verifique a internet.')); };
    document.head.appendChild(s);
  });
  return carregandoScript;
}

const CHAVE_TOKEN = 'tcc.google.token';
interface TokenGuardado { token: string; expiraEm: number }

/** Token ainda válido nesta sessão do navegador (dura cerca de 1 hora). */
export function tokenValido(): string | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(CHAVE_TOKEN) ?? 'null') as TokenGuardado | null;
    return t && t.expiraEm > Date.now() + 60_000 ? t.token : null;
  } catch {
    return null;
  }
}

function guardarToken(token: string, segundos: number) {
  try {
    sessionStorage.setItem(CHAVE_TOKEN, JSON.stringify({ token, expiraEm: Date.now() + segundos * 1000 }));
  } catch {
    // sem sessionStorage: o token vale só enquanto a página estiver aberta
  }
  tokenEmMemoria = { token, expiraEm: Date.now() + segundos * 1000 };
}
let tokenEmMemoria: TokenGuardado | null = null;
const tokenAtual = () => tokenValido() ?? (tokenEmMemoria && tokenEmMemoria.expiraEm > Date.now() + 60_000 ? tokenEmMemoria.token : null);

export function esquecerToken() {
  tokenEmMemoria = null;
  try { sessionStorage.removeItem(CHAVE_TOKEN); } catch { /* nada */ }
}

/**
 * Abre a janelinha do Google. Precisa ser chamado num clique (o navegador bloqueia janelas
 * abertas sem ação da pessoa). Na 2ª vez em diante, a janela só pisca e fecha.
 */
export async function entrar(opcoes: { primeiraVez?: boolean; email?: string | null } = {}): Promise<string> {
  if (!driveConfigurado()) throw new ErroDrive('A sincronização ainda não foi configurada nesta plataforma.');
  await carregarGoogle();
  const oauth = google();
  if (!oauth) throw new ErroDrive('Não foi possível carregar o login do Google.');
  return new Promise<string>((resolve, reject) => {
    const cliente = oauth.initTokenClient({
      client_id: ID_CLIENTE_GOOGLE,
      scope: ESCOPOS,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new ErroDrive(r.error === 'access_denied' ? 'Você não autorizou o acesso ao Google Drive.' : 'O Google não autorizou o acesso. Tente de novo.', true));
        guardarToken(r.access_token, r.expires_in ?? 3600);
        resolve(r.access_token);
      },
      error_callback: (e) => reject(new ErroDrive(e?.type === 'popup_closed' ? 'A janela do Google foi fechada antes de terminar.' : e?.type === 'popup_failed_to_open' ? 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.' : 'Não foi possível entrar com o Google.', true)),
    });
    cliente.requestAccessToken({ prompt: opcoes.primeiraVez ? 'consent' : '', login_hint: opcoes.email ?? undefined });
  });
}

export function sair() {
  const t = tokenAtual();
  esquecerToken();
  if (t) google()?.revoke(t);
}

// ---------------------------------------------------------------------
// Chamadas ao Drive
// ---------------------------------------------------------------------

type Buscar = typeof fetch;

async function chamar(url: string, init: RequestInit = {}, buscar: Buscar = fetch): Promise<Response> {
  const token = tokenAtual();
  if (!token) throw new ErroDrive('É preciso entrar com o Google de novo.', true);
  let r: Response;
  try {
    r = await buscar(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
  } catch {
    throw new ErroDrive('Sem conexão com o Google Drive. Verifique a internet.');
  }
  if (r.status === 401) { esquecerToken(); throw new ErroDrive('É preciso entrar com o Google de novo.', true); }
  if (r.status === 403) throw new ErroDrive('O Google Drive recusou o acesso (403). Saia e entre de novo, autorizando o acesso ao Drive.', true);
  if (!r.ok) throw new ErroDrive(`O Google Drive respondeu com erro (${r.status}). Tente de novo daqui a pouco.`);
  return r;
}

export async function emailDaConta(buscar: Buscar = fetch): Promise<string | null> {
  try {
    const r = await chamar('https://www.googleapis.com/oauth2/v3/userinfo', {}, buscar);
    return ((await r.json()) as { email?: string }).email ?? null;
  } catch {
    return null;
  }
}

export interface ArquivoNoDrive { id: string; modifiedTime?: string }

export async function procurarArquivo(buscar: Buscar = fetch): Promise<ArquivoNoDrive | null> {
  const q = encodeURIComponent(`name = '${NOME_ARQUIVO}' and trashed = false`);
  const r = await chamar(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`, {}, buscar);
  return ((await r.json()) as { files?: ArquivoNoDrive[] }).files?.[0] ?? null;
}

export async function baixarArquivo(id: string, buscar: Buscar = fetch): Promise<string> {
  const r = await chamar(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {}, buscar);
  return r.text();
}

/** Cria ou substitui o arquivo (envio "retomável": aceita arquivos grandes, com os textos dos PDFs). */
export async function enviarArquivo(conteudo: string, id: string | null, buscar: Buscar = fetch): Promise<ArquivoNoDrive> {
  const metadados = id ? {} : { name: NOME_ARQUIVO, parents: ['appDataFolder'], mimeType: 'application/json' };
  const inicio = await chamar(
    id ? `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=resumable&fields=id,modifiedTime` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,modifiedTime',
    { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/json' }, body: JSON.stringify(metadados) },
    buscar,
  );
  const destino = inicio.headers.get('Location');
  if (!destino) throw new ErroDrive('O Google Drive não aceitou o envio. Tente de novo.');
  const r = await chamar(destino, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: conteudo }, buscar);
  return (await r.json()) as ArquivoNoDrive;
}
