import { beforeEach, describe, expect, test } from 'vitest';
import { db } from './db.ts';
import { criarProjeto, excluirProjeto, obterProjetoAtivo, atualizarProjeto } from './projetos.ts';
import { criarFonte, atualizarFonte, marcarCampos, excluirFonte, verificarDuplicatas, ErroDeValidacao, type DadosFonte } from './fontes.ts';
import { obterOuCriarTag, excluirTag } from './tags.ts';
import { gerarBackup, lerArquivoDeBackup, restaurarBackup } from './backup.ts';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const fonteBase = (extra: Partial<DadosFonte> = {}): DadosFonte => ({
  tipo: 'artigo_periodico',
  titulo: '  Humanização   em radioterapia ',
  autores: [{ tipo: 'pessoa', sobrenome: 'Silva', prenomes: 'Maria' }, { tipo: 'pessoa', sobrenome: '  ' }],
  ano: 2021,
  veiculo: 'Revista X',
  palavrasChave: ['radioterapia', ' ', 'radioterapia'],
  tagIds: [],
  statusLeitura: 'nao_iniciado',
  origemMetadados: 'manual',
  ...extra,
});

describe('projetos', () => {
  test('cria, define como ativo e valida prazos', async () => {
    const p = await criarProjeto({ nome: 'Meu TCC', dataInicio: '2026-10-01', prazoFinal: '2027-06-30' });
    expect((await obterProjetoAtivo())?.id).toBe(p.id);
    await expect(criarProjeto({ nome: '  ' })).rejects.toThrow('nome');
    await expect(atualizarProjeto(p.id, { nome: 'X', dataInicio: '2027-01-01', prazoFinal: '2026-01-01' })).rejects.toThrow('prazo');
  });

  test('excluir projeto apaga tudo dele e troca o ativo', async () => {
    const a = await criarProjeto({ nome: 'A' });
    await criarFonte(a.id, fonteBase());
    await obterOuCriarTag(a.id, 'Comunicação');
    const b = await criarProjeto({ nome: 'B' });
    await criarFonte(b.id, fonteBase());
    await excluirProjeto(b.id);
    expect(await db.fontes.count()).toBe(1);
    expect((await obterProjetoAtivo())?.id).toBe(a.id);
  });
});

describe('fontes', () => {
  test('salva com dados limpos (espaços, autores vazios, palavras repetidas)', async () => {
    const p = await criarProjeto({ nome: 'TCC' });
    const f = await criarFonte(p.id, fonteBase());
    const salva = await db.fontes.get(f.id);
    expect(salva?.titulo).toBe('Humanização em radioterapia');
    expect(salva?.autores).toHaveLength(1);
    expect(salva?.palavrasChave).toEqual(['radioterapia']);
  });

  test('recusa dados inválidos com mensagens por campo', async () => {
    const p = await criarProjeto({ nome: 'TCC' });
    const erro = await criarFonte(p.id, fonteBase({ titulo: '', doi: 'abc', url: 'site', ano: 3000 })).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroDeValidacao);
    expect(Object.keys(erro.erros).sort()).toEqual(['ano', 'doi', 'titulo', 'url']);
  });

  test('editar um campo conferido faz ele voltar a "não conferido"', async () => {
    const p = await criarProjeto({ nome: 'TCC' });
    const f = await criarFonte(p.id, fonteBase());
    await marcarCampos(f.id, ['titulo', 'ano'], 'verificado');
    await atualizarFonte(f.id, { ...fonteBase(), ano: 2022 });
    const s = (await db.fontes.get(f.id))!.statusCampos;
    expect(s.titulo).toBe('verificado');
    expect(s.ano).toBeUndefined();
  });

  test('apagar um campo no formulário remove o valor salvo', async () => {
    const p = await criarProjeto({ nome: 'TCC' });
    const f = await criarFonte(p.id, fonteBase({ volume: '5' }));
    await atualizarFonte(f.id, fonteBase({ volume: '' }));
    expect((await db.fontes.get(f.id))!.volume).toBeUndefined();
  });

  test('aponta duplicata no mesmo projeto, mas não em outro', async () => {
    const p = await criarProjeto({ nome: 'TCC' });
    const outro = await criarProjeto({ nome: 'Outro' });
    const f = await criarFonte(p.id, fonteBase({ doi: '10.1590/abc' }));
    const dup = await verificarDuplicatas(p.id, fonteBase({ titulo: 'Diferente', doi: 'https://doi.org/10.1590/ABC' }));
    expect(dup.map((d) => d.fonte.id)).toEqual([f.id]);
    expect(await verificarDuplicatas(outro.id, fonteBase({ doi: '10.1590/abc' }))).toEqual([]);
  });

  test('excluir fonte apaga seus fichamentos', async () => {
    const p = await criarProjeto({ nome: 'TCC' });
    const f = await criarFonte(p.id, fonteBase());
    await db.fichamentos.add({ id: 'x', projetoId: p.id, fonteId: f.id, tipo: 'resumo', parafrase: 'a', tagIds: [], criadoEm: '', atualizadoEm: '' });
    await excluirFonte(f.id);
    expect(await db.fichamentos.count()).toBe(0);
  });
});

describe('tags', () => {
  test('não duplica tags com acento ou maiúsculas diferentes; excluir remove das fontes', async () => {
    const p = await criarProjeto({ nome: 'TCC' });
    const t1 = await obterOuCriarTag(p.id, 'Comunicação');
    const t2 = await obterOuCriarTag(p.id, 'comunicacao');
    expect(t2.id).toBe(t1.id);
    const f = await criarFonte(p.id, fonteBase({ tagIds: [t1.id] }));
    await excluirTag(t1.id);
    expect((await db.fontes.get(f.id))!.tagIds).toEqual([]);
  });
});

describe('backup', () => {
  test('exportar e restaurar devolve exatamente os mesmos dados', async () => {
    const p = await criarProjeto({ nome: 'TCC', prazoFinal: '2027-06-30' });
    const tag = await obterOuCriarTag(p.id, 'Radioterapia');
    await criarFonte(p.id, fonteBase({ tagIds: [tag.id] }));
    const backup = await gerarBackup();
    const texto = JSON.stringify(backup);

    await excluirProjeto(p.id);
    expect(await db.fontes.count()).toBe(0);

    const { arquivo, resumo } = lerArquivoDeBackup(texto);
    expect(resumo.projetos).toEqual(['TCC']);
    expect(resumo.contagens.fontes).toBe(1);
    await restaurarBackup(arquivo);
    expect(await db.fontes.count()).toBe(1);
    expect((await obterProjetoAtivo())?.nome).toBe('TCC');
    expect((await db.fontes.toArray())[0].tagIds).toEqual([tag.id]);
  });

  test('recusa arquivos que não são backup ou estão danificados', () => {
    expect(() => lerArquivoDeBackup('olá')).toThrow('formato inválido');
    expect(() => lerArquivoDeBackup('{"a":1}')).toThrow('não é um backup');
    expect(() => lerArquivoDeBackup(JSON.stringify({ formato: 'tcc-organizador-backup', versao: 1, dados: { fontes: [{ semId: 1 }] } }))).toThrow('danificado');
    expect(() => lerArquivoDeBackup(JSON.stringify({ formato: 'tcc-organizador-backup', versao: 99, dados: {} }))).toThrow('versão mais nova');
  });
});

describe('fichamentos', () => {
  test('cria no mesmo projeto da fonte, preserva o trecho original e valida', async () => {
    const { criarFicha, atualizarFicha } = await import('./fichamentos.ts');
    const p = await criarProjeto({ nome: 'TCC' });
    const f = await criarFonte(p.id, fonteBase());
    const trecho = '  Texto   com espaços\noriginais ';
    const ficha = await criarFicha(f.id, { tipo: 'citacao_direta', trechoOriginal: trecho, pagina: ' 15 ', tagIds: [] });
    const salva = (await db.fichamentos.get(ficha.id))!;
    expect(salva.trechoOriginal).toBe(trecho);
    expect(salva.pagina).toBe('15');
    expect(salva.projetoId).toBe(p.id);
    await expect(criarFicha(f.id, { tipo: 'citacao_direta', parafrase: 'x', tagIds: [] })).rejects.toBeInstanceOf(ErroDeValidacao);
    await atualizarFicha(ficha.id, { tipo: 'citacao_indireta', parafrase: 'Nova', tagIds: [] });
    const editada = (await db.fichamentos.get(ficha.id))!;
    expect(editada.trechoOriginal).toBeUndefined();
    expect(editada.parafrase).toBe('Nova');
  });
});

describe('planejamento', () => {
  test('tarefas: data de conclusão acompanha o status; excluir etapa mantém as tarefas', async () => {
    const pl = await import('./planejamento.ts');
    const p = await criarProjeto({ nome: 'TCC' });
    const e = await pl.criarEtapa(p.id, { nome: 'Leitura', dataInicio: '2026-10-01', dataFim: '2026-10-31' });
    const t = await pl.criarTarefa(p.id, { titulo: ' Ler artigos ', etapaId: e.id, prioridade: 'alta', status: 'a_fazer' });
    expect((await db.tarefas.get(t.id))!.titulo).toBe('Ler artigos');
    await pl.alterarStatusTarefa(t.id, 'concluida');
    const concluida = (await db.tarefas.get(t.id))!;
    expect(concluida.concluidaEm).toBeTruthy();
    await pl.alterarStatusTarefa(t.id, 'em_andamento');
    expect((await db.tarefas.get(t.id))!.concluidaEm).toBeUndefined();
    await pl.excluirEtapa(e.id);
    const semEtapa = (await db.tarefas.get(t.id))!;
    expect(semEtapa.etapaId).toBeUndefined();
    await expect(pl.criarTarefa(p.id, { titulo: '  ', prioridade: 'media', status: 'a_fazer' })).rejects.toBeInstanceOf(ErroDeValidacao);
  });

  test('reordenar etapas e aplicar o planejamento sugerido só num planejamento vazio', async () => {
    const pl = await import('./planejamento.ts');
    const p = await criarProjeto({ nome: 'TCC' });
    await pl.aplicarPlanejamentoSugerido(p.id, '2026-10-14', '2027-06-30');
    const etapas = (await db.etapas.where('projetoId').equals(p.id).toArray()).sort((a, b) => a.ordem - b.ordem);
    expect(etapas[0].nome).toBe('Definição do tema e do problema');
    expect(await db.tarefas.where('projetoId').equals(p.id).count()).toBeGreaterThan(10);
    await pl.moverEtapa(etapas[1].id, -1);
    const reordenadas = (await db.etapas.where('projetoId').equals(p.id).toArray()).sort((a, b) => a.ordem - b.ordem);
    expect(reordenadas[0].id).toBe(etapas[1].id);
    await expect(pl.aplicarPlanejamentoSugerido(p.id, '2026-10-14', '2027-06-30')).rejects.toThrow('já tem etapas');
  });

  test('excluir tarefa desfaz o vínculo da orientação', async () => {
    const pl = await import('./planejamento.ts');
    const p = await criarProjeto({ nome: 'TCC' });
    const t = await pl.criarTarefa(p.id, { titulo: 'Revisar introdução', prioridade: 'media', status: 'a_fazer' });
    await db.orientacoes.add({ id: 'o1', projetoId: p.id, titulo: 'Ajustar intro', origem: 'reuniao', prioridade: 'media', status: 'pendente', tarefaId: t.id, criadoEm: '', atualizadoEm: '' });
    await pl.excluirTarefa(t.id);
    expect((await db.orientacoes.get('o1'))!.tarefaId).toBeUndefined();
  });
});
