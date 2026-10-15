import { describe, expect, test } from 'vitest';
import { comparar, contemTrecho, paginasConferem } from './comparar.ts';
import { palavras } from './texto.ts';
import { prepararFonte, type FonteAuditoria } from './biblioteca.ts';
import { auditar } from './index.ts';

const FONTE_SILVA =
  'A comunicação entre a equipe de enfermagem e o paciente oncológico é um elemento central do cuidado humanizado. ' +
  'Quando o profissional escuta com atenção as dúvidas do paciente, a ansiedade diante do tratamento diminui de forma ' +
  'significativa e a adesão às sessões de radioterapia aumenta. Os resultados indicam que o acolhimento na primeira ' +
  'consulta reduz o medo associado ao equipamento e melhora a confiança dos pacientes na equipe ao longo das semanas.';

const FONTE_LIMA =
  'O planejamento da alta hospitalar deve começar no momento da internação, envolvendo a família e a equipe ' +
  'multiprofissional em todas as decisões sobre a continuidade do tratamento em casa.';

function fontes(): FonteAuditoria[] {
  return [
    prepararFonte({ id: 's', titulo: 'Comunicação', ano: 2020, autores: [{ sobrenome: 'Silva' }] }, { texto: FONTE_SILVA, origem: 'pdf' }, [
      { id: 'f1', trechoOriginal: 'Quando o profissional escuta com atenção as dúvidas do paciente, a ansiedade diante do tratamento diminui de forma significativa', pagina: '12' },
    ]),
    prepararFonte({ id: 'l', titulo: 'Alta', ano: 2018, autores: [{ sobrenome: 'Lima' }] }, undefined, [
      { id: 'f2', trechoOriginal: FONTE_LIMA, pagina: '7' },
    ]),
    prepararFonte({ id: 'c', titulo: 'Sem nada', ano: 2019, autores: [{ sobrenome: 'Costa' }] }, undefined, []),
  ];
}

describe('comparar trechos', () => {
  test('aceita supressão [...] e ignora maiúsculas e pontuação', () => {
    const alvo = palavras(FONTE_SILVA);
    expect(contemTrecho('Quando o profissional escuta [...] a ansiedade diante do tratamento diminui', alvo)).toBe(true);
    expect(contemTrecho('quando o PROFISSIONAL escuta, com atenção', alvo)).toBe(true);
    expect(contemTrecho('quando o profissional ouve com atenção', alvo)).toBe(false);
  });

  test('mostra as palavras trocadas', () => {
    const c = comparar('o profissional escuta com cuidado as dúvidas do paciente', FONTE_SILVA)!;
    expect(c.identico).toBe(false);
    expect(c.semelhanca).toBeCloseTo(8 / 9);
    expect(c.diferencas).toEqual([
      { tipo: 'igual', texto: 'o profissional escuta com' },
      { tipo: 'so_tcc', texto: 'cuidado' },
      { tipo: 'so_fonte', texto: 'atenção' },
      { tipo: 'igual', texto: 'as dúvidas do paciente' },
    ]);
    expect(c.trechoFonte).toBe('o profissional escuta com atenção as dúvidas do paciente');
  });

  test('páginas', () => {
    expect(paginasConferem('12', '12')).toBe(true);
    expect(paginasConferem('12-13', '13')).toBe(true);
    expect(paginasConferem('15', '12')).toBe(false);
    expect(paginasConferem(undefined, '12')).toBeNull();
  });
});

describe('auditoria completa', () => {
  const tcc = (...ps: string[]) => ({
    nomeArquivo: 'tcc.docx',
    origem: 'docx' as const,
    paragrafos: [...ps, 'REFERÊNCIAS', 'SILVA, M. Comunicação. Revista, 2020.', 'LIMA, A. Alta. Recife: UFPE, 2018.', 'COSTA, J. Sem nada. 2019.'].map((texto) => ({ texto })),
  });

  test('citações diretas: confere, página diferente, palavras trocadas, outra fonte', () => {
    const r = auditar(
      tcc(
        'Segundo Silva (2020, p. 12), “quando o profissional escuta com atenção as dúvidas do paciente, a ansiedade diante do tratamento diminui”.',
        '“A ansiedade diante do tratamento diminui de forma significativa” (Silva, 2020, p. 30).',
        '“O acolhimento na primeira consulta reduz o pavor associado ao equipamento” (Silva, 2020, p. 13).',
        '“O planejamento da alta hospitalar deve começar no momento da internação” (Costa, 2019, p. 2).',
      ),
      fontes(),
    );
    expect(r.diretas.map((d) => [d.situacao, d.onde ?? null])).toEqual([
      ['confere', 'ficha'],
      ['pagina_diferente', 'ficha'],
      ['diferente', 'texto'],
      ['outra_fonte', null],
    ]);
    expect(r.diretas[1].paginaFicha).toBe('12');
    expect(r.diretas[2].diferencas?.find((x) => x.tipo === 'so_tcc')?.texto).toBe('pavor');
    expect(r.diretas[3].fonte?.id).toBe('l');
    expect(r.fontesSemMaterial.map((f) => f.id)).toEqual(['c']);
    expect(r.citacoes.problemas).toEqual([]);
  });

  test('cópia: sem aspas, entre aspas correta, fonte diferente e paráfrase próxima', () => {
    const r = auditar(
      tcc(
        // copiado sem aspas, citando a fonte
        'Quando o profissional escuta com atenção as dúvidas do paciente, a ansiedade diante do tratamento diminui de forma significativa (Silva, 2020).',
        // entre aspas, fonte certa
        'Como diz a autora, “a comunicação entre a equipe de enfermagem e o paciente oncológico é um elemento central do cuidado humanizado” (Silva, 2020, p. 3).',
        // entre aspas, fonte errada
        '“O planejamento da alta hospitalar deve começar no momento da internação, envolvendo a família” (Costa, 2019, p. 4).',
        // paráfrase muito próxima, sem citação
        'Os achados mostram que acolhimento na primeira consulta diminui o medo associado ao equipamento e melhora a confiança dos pacientes.',
        // texto próprio
        'Este trabalho discute a organização do serviço a partir de entrevistas com doze profissionais do setor.',
      ),
      fontes(),
    );
    const t = r.copia.trechos.map((x) => [x.tipo, x.paragrafo, x.fonte.id, x.citaFonte]);
    expect(t).toEqual([
      ['sem_aspas', 0, 's', true],
      ['fonte_diferente', 2, 'l', false],
      ['parafrase', 3, 's', false],
    ]);
    expect(r.copia.citadosCorretamente).toBe(1);
    expect(r.copia.trechos[0].palavras).toBe(19);
    expect(r.copia.trechos[1].citada).toBe('Costa, 2019');
    expect(r.copia.trechos[2].semelhanca).toBeGreaterThanOrEqual(0.5);
    expect(r.copia.trechos[2].textoFonte).toContain('primeira consulta');
    expect(r.copia.fontesComparadas).toBe(2);
  });
});
