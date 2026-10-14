// Validação dos dados bibliográficos digitados no formulário.
import type { CampoBibliografico, DadosBibliograficos } from './tipos.ts';
import { limparDoi } from './abnt/referencia.ts';

export type ErrosDeCampo = Partial<Record<CampoBibliografico | `autores.${number}`, string>>;

export function validarDadosBibliograficos(d: DadosBibliograficos, hoje = new Date()): ErrosDeCampo {
  const erros: ErrosDeCampo = {};
  if (!d.titulo?.trim()) erros.titulo = 'O título é obrigatório.';

  const anoAtual = hoje.getFullYear();
  if (d.ano !== undefined && (!Number.isInteger(d.ano) || d.ano < 1000 || d.ano > anoAtual + 1)) {
    erros.ano = `Informe um ano entre 1000 e ${anoAtual + 1}.`;
  }
  if (d.anoEvento !== undefined && (!Number.isInteger(d.anoEvento) || d.anoEvento < 1000 || d.anoEvento > anoAtual + 1)) {
    erros.anoEvento = 'Ano do evento inválido.';
  }
  if (d.doi?.trim() && !/^10\.\d{4,9}\/\S+$/.test(limparDoi(d.doi))) {
    erros.doi = 'DOI inválido. Ele começa com "10." (ex.: 10.1590/abc.123).';
  }
  if (d.url?.trim()) {
    try {
      const u = new URL(d.url.trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    } catch {
      erros.url = 'Endereço inválido. Ele deve começar com http:// ou https://.';
    }
  }
  if (d.dataAcesso?.trim()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d.dataAcesso.trim());
    const data = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    if (!data || data.getMonth() !== Number(m![2]) - 1) erros.dataAcesso = 'Data de acesso inválida.';
    else if (data.getTime() > hoje.getTime()) erros.dataAcesso = 'A data de acesso não pode estar no futuro.';
  }
  (d.autores ?? []).forEach((a, i) => {
    if (!a.sobrenome?.trim() && a.prenomes?.trim()) {
      erros[`autores.${i}`] = a.tipo === 'entidade' ? 'Informe o nome da entidade.' : 'Informe o sobrenome.';
    }
  });
  return erros;
}
