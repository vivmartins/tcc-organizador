import { beforeEach, describe, expect, test } from 'vitest';
import { db } from './db.ts';
import { criarProjeto } from './projetos.ts';
import { gerarBackup } from './backup.ts';
import { ativar, gravar, lerBackupExistente, mudouDados, desativar, obterArquivo, type ArquivoDeBackup } from './backupAutomatico.ts';

/** Arquivo falso, em memória, com a mesma "cara" do arquivo real do navegador. */
function arquivoFalso(inicial = '') {
  const f = {
    conteudo: inicial,
    name: 'backup-organizador-tcc.json',
    async getFile() { return new File([f.conteudo], f.name); },
    async createWritable() {
      let novo = '';
      return { write: async (d: string) => { novo += d; }, close: async () => { f.conteudo = novo; } };
    },
  };
  return f;
}

beforeEach(async () => {
  await desativar();
  await db.delete();
  await db.open();
});

describe('backup automático', () => {
  test('grava todos os dados no arquivo e registra a data do backup', async () => {
    await criarProjeto({ nome: 'TCC' });
    const a = arquivoFalso();
    await ativar(a as unknown as ArquivoDeBackup);
    const salvo = JSON.parse(a.conteudo);
    expect(salvo.formato).toBe('tcc-organizador-backup');
    expect(salvo.dados.projetos[0].nome).toBe('TCC');
    expect((await db.config.get('ultimoBackupEm'))?.valor).toBeTruthy();
    expect((await obterArquivo())?.name).toBe('backup-organizador-tcc.json');
  });

  test('nunca grava um banco vazio por cima de um backup (a não ser ao escolher o arquivo)', async () => {
    const a = arquivoFalso('{"conteudo":"backup bom"}');
    expect(await gravar(a as unknown as ArquivoDeBackup)).toBe('vazio');
    expect(a.conteudo).toBe('{"conteudo":"backup bom"}');
  });

  test('reconhece um backup que já existe no arquivo escolhido', async () => {
    await criarProjeto({ nome: 'TCC antigo' });
    const texto = JSON.stringify(await gerarBackup());
    expect((await lerBackupExistente(arquivoFalso(texto) as unknown as ArquivoDeBackup))?.resumo.projetos).toEqual(['TCC antigo']);
    expect(await lerBackupExistente(arquivoFalso('') as unknown as ArquivoDeBackup)).toBeNull();
    expect(await lerBackupExistente(arquivoFalso('texto qualquer') as unknown as ArquivoDeBackup)).toBeNull();
  });

  test('só reage a mudanças nos dados, não nas configurações do app', () => {
    expect(mudouDados({ [`idb://${db.name}/fontes/`]: 1 })).toBe(true);
    expect(mudouDados({ [`idb://${db.name}/config/`]: 1 })).toBe(false);
    expect(mudouDados({ 'idb://outro-banco/fontes/': 1 })).toBe(false);
  });
});
