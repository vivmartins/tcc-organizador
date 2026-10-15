import { beforeEach, describe, expect, test } from 'vitest';
import { db } from './db.ts';
import { criarProjeto } from './projetos.ts';
import { criarFonte, excluirFonte } from './fontes.ts';
import { salvarTexto, removerTexto, contarPalavras } from './textos.ts';
import { gerarBackup, lerArquivoDeBackup, restaurarBackup } from './backup.ts';
import { resumoDoIndiceInvertido } from '../integrations/metadados.ts';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const LONGO = 'A humanização do cuidado em radioterapia depende da comunicação entre equipe e paciente, '.repeat(3);

async function fonte() {
  const p = await criarProjeto({ nome: 'TCC' });
  return criarFonte(p.id, {
    tipo: 'artigo_periodico', titulo: 'Título', autores: [{ tipo: 'pessoa', sobrenome: 'Silva' }], ano: 2021,
    palavrasChave: [], tagIds: [], statusLeitura: 'nao_iniciado', origemMetadados: 'manual',
  });
}

describe('textos das fontes', () => {
  test('conta palavras com acentos e hífen', () => {
    expect(contarPalavras('A pós-graduação, em 2021, foi ótima.')).toBe(5);
  });

  test('recusa texto curto (PDF escaneado)', async () => {
    const f = await fonte();
    await expect(salvarTexto(f.id, { origem: 'pdf', texto: 'pouco texto' })).rejects.toThrow('escaneado');
    expect(await db.textos.count()).toBe(0);
  });

  test('guarda, substitui e remove', async () => {
    const f = await fonte();
    const t = await salvarTexto(f.id, { origem: 'resumo', texto: LONGO });
    expect(t.projetoId).toBe(f.projetoId);
    expect(t.palavras).toBeGreaterThan(20);
    await salvarTexto(f.id, { origem: 'pdf', texto: LONGO + '\n\n\n\nfim', nomeArquivo: 'a.pdf', paginas: 3 });
    const novo = await db.textos.get(f.id);
    expect(novo?.origem).toBe('pdf');
    expect(novo?.texto).not.toContain('\n\n\n');
    expect(await db.textos.count()).toBe(1);
    await removerTexto(f.id);
    expect(await db.textos.count()).toBe(0);
  });

  test('excluir a fonte apaga o texto', async () => {
    const f = await fonte();
    await salvarTexto(f.id, { origem: 'pdf', texto: LONGO });
    await excluirFonte(f.id);
    expect(await db.textos.count()).toBe(0);
  });

  test('backup leva e traz os textos', async () => {
    const f = await fonte();
    await salvarTexto(f.id, { origem: 'pdf', texto: LONGO });
    const json = JSON.stringify(await gerarBackup());
    const { arquivo, resumo } = lerArquivoDeBackup(json);
    expect(resumo.contagens.textos).toBe(1);
    await db.textos.clear();
    await restaurarBackup(arquivo);
    expect((await db.textos.get(f.id))?.texto).toContain('radioterapia');
  });
});

describe('resumo do OpenAlex', () => {
  test('remonta o índice invertido na ordem', () => {
    expect(resumoDoIndiceInvertido({ cuidado: [1], O: [0], importa: [2] })).toBe('O cuidado importa');
    expect(resumoDoIndiceInvertido(null)).toBeNull();
    expect(resumoDoIndiceInvertido({})).toBeNull();
  });
});
