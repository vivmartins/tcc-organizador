import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Fichamento } from '../../../data/db.ts';
import { criarFicha, atualizarFicha } from '../../../data/fichamentos.ts';
import { ErroDeValidacao } from '../../../data/fontes.ts';
import { obterOuCriarTag } from '../../../data/tags.ts';
import { ORDEM_TIPOS_FICHAMENTO, ROTULO_TIPO_FICHAMENTO, type TipoFichamento } from '../../../domain/fichamento.ts';
import { AreaTexto, Botao, Campo, Entrada, Selecao } from '../../componentes/base.tsx';
import { Modal, useAvisos } from '../../componentes/dialogos.tsx';
import { EditorTags } from '../../componentes/EditorTags.tsx';

const AJUDA_TIPO: Record<TipoFichamento, string> = {
  citacao_direta: 'Trecho copiado exatamente como está no texto. Exige a página.',
  citacao_indireta: 'A ideia do autor escrita com as suas palavras.',
  resumo: 'Síntese de uma parte ou do texto inteiro.',
  ideia: 'Algo que o texto despertou e que você quer desenvolver no TCC.',
  dado_relevante: 'Número, resultado ou achado importante do estudo.',
};

interface Props {
  projetoId: string;
  /** Quando a ficha é criada a partir da página de uma fonte. */
  fonteId?: string;
  ficha?: Fichamento;
  aoFechar: () => void;
}

export function FormularioFicha({ projetoId, fonteId, ficha, aoFechar }: Props) {
  const avisar = useAvisos();
  const dados = useLiveQuery(async () => {
    const [tags, fontes] = await Promise.all([
      db.tags.where('projetoId').equals(projetoId).toArray(),
      fonteId || ficha ? Promise.resolve([]) : db.fontes.where('projetoId').equals(projetoId).toArray(),
    ]);
    return { tags, fontes: fontes.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')) };
  }, [projetoId, fonteId, ficha]);

  const [fonteEscolhida, setFonteEscolhida] = useState(fonteId ?? ficha?.fonteId ?? '');
  const [tipo, setTipo] = useState<TipoFichamento>(ficha?.tipo ?? 'citacao_direta');
  const [trecho, setTrecho] = useState(ficha?.trechoOriginal ?? '');
  const [pagina, setPagina] = useState(ficha?.pagina ?? '');
  const [parafrase, setParafrase] = useState(ficha?.parafrase ?? '');
  const [interpretacao, setInterpretacao] = useState(ficha?.interpretacao ?? '');
  const [tema, setTema] = useState(ficha?.tema ?? '');
  const [capitulo, setCapitulo] = useState(ficha?.capituloSecao ?? '');
  const [tagsSel, setTagsSel] = useState<string[] | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  if (!dados) return null;
  const nomesTags = new Map(dados.tags.map((t) => [t.id, t.nome]));
  const tags = tagsSel ?? (ficha?.tagIds ?? []).map((id) => nomesTags.get(id)).filter((n): n is string => !!n);
  const escolherFonte = !fonteId && !ficha;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (escolherFonte && !fonteEscolhida) {
      setErros({ fonte: 'Escolha a fonte desta ficha.' });
      return;
    }
    setSalvando(true);
    setErros({});
    try {
      const tagIds = [];
      for (const nome of tags) tagIds.push((await obterOuCriarTag(projetoId, nome)).id);
      const d = { tipo, trechoOriginal: trecho, pagina, parafrase, interpretacao, tema, capituloSecao: capitulo, tagIds };
      if (ficha) await atualizarFicha(ficha.id, d);
      else await criarFicha(fonteEscolhida, d);
      avisar('sucesso', ficha ? 'Ficha atualizada.' : 'Ficha registrada.');
      aoFechar();
    } catch (err) {
      if (err instanceof ErroDeValidacao) setErros(err.erros);
      else avisar('erro', `Não foi possível salvar: ${(err as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={ficha ? 'Editar ficha' : 'Nova ficha'}
      largura="max-w-2xl"
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" type="submit" form="form-ficha" disabled={salvando}>{ficha ? 'Salvar' : 'Registrar ficha'}</Botao>
        </>
      }
    >
      <form id="form-ficha" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {escolherFonte && (
          <Campo rotulo="Fonte" id="ficha-fonte" obrigatorio erro={erros.fonte}>
            <Selecao id="ficha-fonte" value={fonteEscolhida} onChange={(e) => setFonteEscolhida(e.target.value)} aria-invalid={!!erros.fonte}>
              <option value="">Escolha…</option>
              {dados.fontes.map((f) => <option key={f.id} value={f.id}>{f.titulo}{f.ano ? ` (${f.ano})` : ''}</option>)}
            </Selecao>
          </Campo>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Campo rotulo="Tipo de registro" id="ficha-tipo" dica={AJUDA_TIPO[tipo]}>
            <Selecao id="ficha-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoFichamento)}>
              {ORDEM_TIPOS_FICHAMENTO.map((t) => <option key={t} value={t}>{ROTULO_TIPO_FICHAMENTO[t]}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Página" id="ficha-pagina" obrigatorio={tipo === 'citacao_direta'} erro={erros.pagina}>
            <Entrada id="ficha-pagina" value={pagina} onChange={(e) => setPagina(e.target.value)} placeholder="Ex.: 15" aria-invalid={!!erros.pagina} />
          </Campo>
        </div>
        <Campo rotulo="Trecho original" id="ficha-trecho" obrigatorio={tipo === 'citacao_direta'} erro={erros.trechoOriginal} dica="Guardado exatamente como você digitar ou colar.">
          <AreaTexto id="ficha-trecho" value={trecho} onChange={(e) => setTrecho(e.target.value)} rows={4} aria-invalid={!!erros.trechoOriginal} className="font-serif text-[15px]" />
        </Campo>
        <Campo rotulo="Resumo ou paráfrase (com as suas palavras)" id="ficha-parafrase">
          <AreaTexto id="ficha-parafrase" value={parafrase} onChange={(e) => setParafrase(e.target.value)} rows={3} />
        </Campo>
        <Campo rotulo="Interpretação pessoal" id="ficha-interpretacao" dica="O que você pensa disso e como se relaciona com a sua pesquisa.">
          <AreaTexto id="ficha-interpretacao" value={interpretacao} onChange={(e) => setInterpretacao(e.target.value)} rows={3} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Tema relacionado" id="ficha-tema">
            <Entrada id="ficha-tema" value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex.: Comunicação com o paciente" />
          </Campo>
          <Campo rotulo="Capítulo ou seção do TCC" id="ficha-capitulo">
            <Entrada id="ficha-capitulo" value={capitulo} onChange={(e) => setCapitulo(e.target.value)} placeholder="Ex.: 2.1 Humanização" />
          </Campo>
        </div>
        <Campo rotulo="Tags" id="ficha-tags">
          <EditorTags id="ficha-tags" tags={tags} aoMudar={setTagsSel} sugestoes={[...nomesTags.values()]} />
        </Campo>
        {erros.geral && <p role="alert" className="text-sm text-perigo-700">{erros.geral}</p>}
      </form>
    </Modal>
  );
}
