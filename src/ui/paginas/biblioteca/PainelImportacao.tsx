import { useRef, useState } from 'react';
import { Download, FileText, Link2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { buscarPorDoi, ErroDeImportacao, type ResultadoImportacao } from '../../../integrations/metadados.ts';
import { lerPdf } from '../../../integrations/pdf.ts';
import { extrairDoi } from '../../../domain/duplicatas.ts';
import { Botao, Cartao, Entrada, cx } from '../../componentes/base.tsx';

export type Modo = 'doi' | 'link' | 'pdf';

export interface Importacao {
  resultado: ResultadoImportacao | null;
  /** Link digitado, quando a importação foi por link. */
  url?: string;
  modo: Modo;
  /** Palavras-chave escritas pelos autores, lidas do PDF. */
  palavrasChaveDosAutores?: string[];
}

const ROTULO_SERVICO = { crossref: 'Crossref', openalex: 'OpenAlex' };

export function PainelImportacao({ modoInicial = 'doi', aoImportar }: { modoInicial?: Modo; aoImportar: (i: Importacao) => void }) {
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [valor, setValor] = useState('');
  const [carregando, setCarregando] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'aviso' | 'erro'; texto: string } | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  async function importarDoi(doi: string, extras: Omit<Importacao, 'resultado'>) {
    setCarregando('Buscando os dados no Crossref e no OpenAlex…');
    try {
      const resultado = await buscarPorDoi(doi);
      aoImportar({ ...extras, resultado });
      const servicos = resultado.servicos.map((s) => ROTULO_SERVICO[s]).join(' e ');
      setMensagem({ tipo: 'ok', texto: `Dados encontrados (${servicos}) e preenchidos abaixo. Confira cada campo com a publicação antes de salvar.` });
    } catch (e) {
      if (extras.modo === 'link') aoImportar({ ...extras, resultado: null });
      setMensagem({ tipo: 'erro', texto: e instanceof ErroDeImportacao ? e.message : 'Não foi possível buscar os dados agora. Tente de novo ou preencha manualmente.' });
    } finally {
      setCarregando(null);
    }
  }

  // Sem <form> próprio: este painel fica dentro do formulário de cadastro (formulários não podem ser aninhados).
  async function enviar() {
    setMensagem(null);
    const v = valor.trim();
    if (!v) return;
    if (modo === 'doi') return importarDoi(v, { modo });
    // Link: procura o DOI dentro do endereço
    let url: URL;
    try {
      url = new URL(v);
    } catch {
      setMensagem({ tipo: 'erro', texto: 'Endereço inválido. Ele deve começar com http:// ou https://.' });
      return;
    }
    const doi = extrairDoi(url.href);
    if (doi) return importarDoi(doi, { modo, url: url.href });
    aoImportar({ modo, url: url.href, resultado: null });
    setMensagem({ tipo: 'aviso', texto: 'Não encontramos um DOI nesse link. Guardamos o endereço e a data de acesso de hoje; preencha os demais dados abaixo. (Ler a página do site exigiria um servidor, que este app não usa.)' });
  }

  async function escolherPdf(f?: File) {
    if (!f) return;
    setMensagem(null);
    setCarregando('Lendo o PDF…');
    try {
      const { doi, palavrasChave } = await lerPdf(f);
      if (!doi) {
        if (palavrasChave.length) aoImportar({ modo: 'pdf', resultado: null, palavrasChaveDosAutores: palavrasChave });
        setMensagem({
          tipo: 'aviso',
          texto: `Não encontramos um DOI em “${f.name}”. ${palavrasChave.length ? 'Encontramos as palavras-chave dos autores e as colocamos em “Palavras-chave”; complete os demais dados abaixo.' : 'Preencha os dados manualmente abaixo (o título costuma estar na primeira página).'}`,
        });
        return;
      }
      setValor(doi);
      await importarDoi(doi, { modo: 'pdf', palavrasChaveDosAutores: palavrasChave });
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: (e as Error).message });
    } finally {
      setCarregando(null);
      if (arquivo.current) arquivo.current.value = '';
    }
  }

  const abas: [Modo, string, typeof Download][] = [['doi', 'DOI', Download], ['link', 'Link', Link2], ['pdf', 'PDF', FileText]];

  return (
    <Cartao className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold">Preencher automaticamente</h2>
      <p className="mt-0.5 text-xs text-cinza-500">Opcional. Busca os dados pelo DOI no Crossref e no OpenAlex. Você confere tudo antes de salvar.</p>
      <div role="tablist" aria-label="Forma de importação" className="mt-3 inline-flex gap-1 rounded-md border border-borda p-1">
        {abas.map(([id, rotulo, Icone]) => (
          <button key={id} type="button" role="tab" aria-selected={modo === id} onClick={() => { setModo(id); setMensagem(null); setValor(''); }} className={cx('flex items-center gap-1.5 rounded px-3 py-1.5 text-sm', modo === id ? 'bg-acao-50 font-medium text-acao-700' : 'text-cinza-600 hover:text-marinho-900')}>
            <Icone size={14} /> {rotulo}
          </button>
        ))}
      </div>

      {modo === 'pdf' ? (
        <div className="mt-3">
          <input ref={arquivo} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Arquivo PDF" onChange={(e) => escolherPdf(e.target.files?.[0])} />
          <Botao onClick={() => arquivo.current?.click()} disabled={!!carregando}><FileText size={15} /> Escolher PDF</Botao>
          <p className="mt-1.5 text-xs text-cinza-500">O PDF é lido aqui no seu navegador para encontrar o DOI. Ele não é enviado para lugar nenhum nem guardado no app.</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Entrada
            aria-label={modo === 'doi' ? 'DOI para importar' : 'Link para importar'}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={modo === 'doi' ? 'Ex.: 10.1590/s0034-89102010000100001' : 'Cole o link do artigo (ex.: https://www.scielo.br/…)'}
            inputMode={modo === 'link' ? 'url' : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault(); // não envia o formulário de cadastro
                if (valor.trim() && !carregando) void enviar();
              }
            }}
          />
          <Botao variante="primario" onClick={() => void enviar()} disabled={!valor.trim() || !!carregando} className="shrink-0">Buscar dados</Botao>
        </div>
      )}

      {carregando && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-cinza-600"><Loader2 size={15} className="animate-spin" /> {carregando}</p>}
      {mensagem && !carregando && (
        <p role={mensagem.tipo === 'erro' ? 'alert' : 'status'} className={cx('mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm', mensagem.tipo === 'ok' ? 'bg-sucesso-50 text-sucesso-700' : mensagem.tipo === 'aviso' ? 'bg-alerta-50 text-alerta-700' : 'bg-perigo-50 text-perigo-700')}>
          {mensagem.tipo === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          {mensagem.texto}
        </p>
      )}
    </Cartao>
  );
}
