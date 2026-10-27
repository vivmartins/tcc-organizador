import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { db } from './db.ts';
import { criarProjeto } from './projetos.ts';
import { criarFonte, excluirFonte, atualizarPrioridade } from './fontes.ts';
import { criarProjetoExemplo } from './exemplo.ts';
import { aplicarRetrato, concluirAnotacoes, instalarGanchos, juntar, marcarSubstituirNoDrive, retratoLocal, TABELAS_SINCRONIZADAS, type Retrato } from './sincronizacao.ts';
import { sincronizar } from '../integrations/sincronizarDrive.ts';
import type { DadosFonte } from './fontes.ts';

const vazio = (): Retrato => ({ dados: Object.fromEntries(TABELAS_SINCRONIZADAS.map((t) => [t, []])) as unknown as Retrato['dados'], excluidos: {} });
const com = (fontes: Record<string, unknown>[], excluidos: Record<string, string> = {}): Retrato => {
  const r = vazio();
  r.dados.fontes = fontes as Retrato['dados']['fontes'];
  if (Object.keys(excluidos).length) r.excluidos.fontes = excluidos;
  return r;
};

describe('junção registro a registro', () => {
  const hoje = new Date('2026-10-27T12:00:00Z');
  test('vale a versão alterada por último; o que só existe de um lado entra', () => {
    const j = juntar(
      com([{ id: 'a', titulo: 'A velho', alteradoEm: '2026-10-01' }, { id: 'b', titulo: 'B', alteradoEm: '2026-10-02' }]),
      com([{ id: 'a', titulo: 'A novo', alteradoEm: '2026-10-05' }, { id: 'c', titulo: 'C', alteradoEm: '2026-10-03' }]),
      hoje,
    );
    expect(j.retrato.dados.fontes.map((f) => f.titulo).sort()).toEqual(['A novo', 'B', 'C']);
    expect(j.recebidos).toBe(2); // A novo e C
    expect(j.enviados).toBe(1); // B
  });
  test('exclusão mais nova apaga; alteração depois da exclusão mantém', () => {
    const j = juntar(
      com([{ id: 'a', alteradoEm: '2026-10-01' }, { id: 'b', alteradoEm: '2026-10-09' }]),
      com([], { a: '2026-10-05', b: '2026-10-05' }),
      hoje,
    );
    expect(j.retrato.dados.fontes.map((f) => f.id)).toEqual(['b']);
    expect(j.retrato.excluidos.fontes).toEqual({ a: '2026-10-05' });
  });
  test('registros antigos sem "alteradoEm" usam atualizadoEm; exclusões muito antigas são esquecidas', () => {
    const j = juntar(com([{ id: 'a', atualizadoEm: '2026-10-02', titulo: 'x' }]), com([{ id: 'a', atualizadoEm: '2026-10-01', titulo: 'y' }], { z: '2025-01-01' }), hoje);
    expect(j.retrato.dados.fontes[0].titulo).toBe('x');
    expect(j.retrato.excluidos.fontes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------
// Dois aparelhos e um Drive falso
// ---------------------------------------------------------------------

const drive = { id: null as string | null, conteudo: '', envios: 0 };
async function driveFalso(url: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const u = String(url);
  const json = (b: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json', ...h } });
  if (u.includes('uploadType=resumable')) return json({}, { Location: 'https://upload.falso/sessao' });
  if (u.includes('/drive/v3/files?')) return json({ files: drive.id ? [{ id: drive.id }] : [] });
  if (u.includes('alt=media')) return new Response(drive.conteudo);
  if (u === 'https://upload.falso/sessao') {
    drive.conteudo = String(init.body);
    drive.id ??= 'arquivo1';
    drive.envios++;
    return json({ id: drive.id });
  }
  return new Response('', { status: 404 });
}
const buscar = driveFalso as typeof fetch;

/** "Troca de aparelho": guarda o banco deste aparelho e carrega o do outro. */
const aparelhos: Record<string, { r: Retrato } | null> = { computador: null, celular: null };
let atual = 'computador';
async function irPara(nome: string) {
  const r = await retratoLocal();
  for (const t of TABELAS_SINCRONIZADAS) r.dados[t] = (await db.table(t).toArray()) as Retrato['dados'][typeof t]; // inclui o exemplo
  aparelhos[atual] = { r };
  await db.delete();
  await db.open();
  const salvo = aparelhos[nome];
  if (salvo) await aplicarRetrato(salvo.r);
  atual = nome;
}

const fonte = (titulo: string): DadosFonte => ({ tipo: 'livro', titulo, autores: [], palavrasChave: [], tagIds: [], statusLeitura: 'nao_iniciado', origemMetadados: 'manual' });

beforeAll(() => {
  instalarGanchos();
  sessionStorage.setItem('tcc.google.token', JSON.stringify({ token: 't', expiraEm: Date.now() + 3_600_000 }));
});
beforeEach(async () => {
  drive.id = null; drive.conteudo = ''; drive.envios = 0;
  aparelhos.computador = null; aparelhos.celular = null; atual = 'computador';
  await db.delete();
  await db.open();
});

describe('sincronização entre computador e celular', () => {
  test('o celular recebe tudo; alterações e exclusões voltam para o computador', async () => {
    const p = await criarProjeto({ nome: 'Meu TCC' });
    const f1 = await criarFonte(p.id, fonte('Livro um'));
    const f2 = await criarFonte(p.id, fonte('Livro dois'));
    await criarProjetoExemplo(); // não deve ir para o Drive
    const r1 = await sincronizar(buscar);
    expect(r1.primeiraVez).toBe(true);
    expect(drive.conteudo).not.toContain('"exemplo":true');

    await irPara('celular');
    const r2 = await sincronizar(buscar);
    expect(r2.recebidos).toBeGreaterThan(0);
    expect((await db.fontes.toArray()).map((f) => f.titulo).sort()).toEqual(['Livro dois', 'Livro um']);
    expect((await db.config.get('projetoAtivoId'))?.valor).toBe(p.id);
    await new Promise((r) => setTimeout(r, 5));
    await atualizarPrioridade(f1.id, 'alta');
    await excluirFonte(f2.id);
    await criarFonte(p.id, fonte('Artigo do celular'));
    await concluirAnotacoes();
    await sincronizar(buscar);

    await irPara('computador');
    await sincronizar(buscar);
    const fontes = await db.fontes.where('projetoId').equals(p.id).toArray();
    expect(fontes.map((f) => f.titulo).sort()).toEqual(['Artigo do celular', 'Livro um']);
    expect(fontes.find((f) => f.id === f1.id)?.prioridade).toBe('alta');
    expect(await db.projetos.filter((x) => !!x.exemplo).count()).toBe(1); // o exemplo continua só aqui
  });

  test('sem nada novo, não reenvia o arquivo', async () => {
    const p = await criarProjeto({ nome: 'TCC' });
    await criarFonte(p.id, fonte('A'));
    await sincronizar(buscar);
    const envios = drive.envios;
    await sincronizar(buscar);
    expect(drive.envios).toBe(envios);
  });

  test('depois de restaurar um backup, o Drive fica igual a este aparelho', async () => {
    const p = await criarProjeto({ nome: 'TCC' });
    await criarFonte(p.id, fonte('Fica'));
    const sai = await criarFonte(p.id, fonte('Sai'));
    await sincronizar(buscar);
    await db.fontes.delete(sai.id); // como se o backup restaurado não tivesse esta fonte
    await db.config.delete('sincronizacao.excluidos');
    await marcarSubstituirNoDrive();
    await sincronizar(buscar);
    await irPara('celular');
    await sincronizar(buscar);
    expect((await db.fontes.toArray()).map((f) => f.titulo)).toEqual(['Fica']);
  });
});
