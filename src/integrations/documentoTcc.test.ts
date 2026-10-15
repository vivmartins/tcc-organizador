import { describe, expect, test } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { lerDocx, montarParagrafos, lerDocumentoTcc } from './documentoTcc.ts';

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';

function docx(corpo: string, estilos = '') {
  return zipSync({
    'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${NS}><w:body>${corpo}</w:body></w:document>`),
    'word/styles.xml': strToU8(`<?xml version="1.0"?><w:styles ${NS}>${estilos}</w:styles>`),
  });
}

describe('ler o TCC em Word', () => {
  test('texto, revisões apagadas, recuo próprio e do estilo', async () => {
    const ps = await lerDocx(docx(
      '<w:p><w:r><w:t>Segundo </w:t></w:r><w:del><w:r><w:delText>apagado </w:delText></w:r></w:del><w:ins><w:r><w:t>Silva</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> (2020).</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:ind w:left="2268"/></w:pPr><w:r><w:t>Citação longa.</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="Citacao"/></w:pPr><w:r><w:t>Pelo estilo.</w:t></w:r></w:p>' +
      '<w:p><w:r><mc:AlternateContent><mc:Choice><w:p><w:r><w:t>Caixa</w:t></w:r></w:p></mc:Choice><mc:Fallback><w:p><w:r><w:t>Caixa</w:t></w:r></w:p></mc:Fallback></mc:AlternateContent></w:r></w:p>',
      '<w:style w:type="paragraph" w:styleId="Base"><w:pPr><w:ind w:left="2268"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Citacao"><w:basedOn w:val="Base"/></w:style>',
    ));
    expect(ps.map((p) => p.texto)).toEqual(['Segundo Silva (2020).', 'Citação longa.', 'Pelo estilo.', '', 'Caixa']);
    expect(ps[1].recuoCm).toBe(4);
    expect(ps[2].recuoCm).toBe(4);
    expect(ps[0].recuoCm).toBeUndefined();
    expect(ps.filter((p) => p.texto === 'Caixa')).toHaveLength(1); // o texto da caixa aparece uma vez só
  });

  test('recusa .doc antigo e arquivo que não é Word', async () => {
    await expect(lerDocumentoTcc(new File(['x'], 'tcc.doc'))).rejects.toThrow('Salvar como');
    await expect(lerDocx(zipSync({ 'a.txt': strToU8('oi') }))).rejects.toThrow('não parece');
  });
});

describe('montar parágrafos do PDF', () => {
  test('parágrafo com recuo de primeira linha, citação recuada, hifenização e número de página', () => {
    const l = (x: number, y: number, texto: string) => ({ x, y, texto });
    const ps = montarParagrafos([[
      l(120, 800, 'Primeiro parágrafo começa com recuo e conti-'),
      l(85, 786, 'nua aqui na margem normal do texto.'),
      l(85, 772, 'Mais uma linha do mesmo parágrafo.'),
      l(120, 758, 'Segundo parágrafo, também com recuo.'),
      l(85, 744, 'Fim do segundo.'),
      l(198, 720, 'Citação longa recuada em quatro centímetros'),
      l(198, 708, 'que ocupa mais de uma linha (Silva, 2020, p. 3).'),
      l(85, 684, 'Texto depois da citação.'),
      l(300, 40, '12'),
    ]]);
    expect(ps.map((p) => p.texto)).toEqual([
      'Primeiro parágrafo começa com recuo e continua aqui na margem normal do texto. Mais uma linha do mesmo parágrafo.',
      'Segundo parágrafo, também com recuo. Fim do segundo.',
      'Citação longa recuada em quatro centímetros que ocupa mais de uma linha (Silva, 2020, p. 3).',
      'Texto depois da citação.',
    ]);
    expect(ps[2].recuoCm).toBeCloseTo(3.98, 1);
  });
});
