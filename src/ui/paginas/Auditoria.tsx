import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileSearch, Upload, Loader2, RefreshCw, ShieldCheck, Info, FileText, ChevronRight } from 'lucide-react';
import { db } from '../../data/db.ts';
import { carregarFontesParaAuditoria } from '../../data/auditoria.ts';
import { numerarFontes } from '../../data/fontes.ts';
import { lerDocumentoTcc } from '../../integrations/documentoTcc.ts';
import { auditar, type DocumentoTcc, type ResultadoAuditoria } from '../../domain/auditoria/index.ts';
import type { PedacoDiferenca } from '../../domain/auditoria/comparar.ts';
import type { VerificacaoDireta, SituacaoDireta } from '../../domain/auditoria/diretas.ts';
import type { TrechoParecido } from '../../domain/auditoria/copia.ts';
import { Botao, CabecalhoPagina, Cartao, Selo, cx } from '../componentes/base.tsx';
import { useAvisos } from '../componentes/dialogos.tsx';
import { useProjetoObrigatorio } from '../projetoAtivo.tsx';
import { AjudaSecao } from '../ajuda/AjudaSecao.tsx';
import { TextoDaFonte } from './biblioteca/TextoDaFonte.tsx';

// O resultado fica só na memória desta aba (para não se perder ao abrir uma fonte e voltar).
// O arquivo do TCC nunca é guardado.
let memoria: { projetoId: string; doc: DocumentoTcc; resultado: ResultadoAuditoria } | null = null;

type Aba = 'citacoes' | 'diretas' | 'copia';

export function Auditoria() {
  const projeto = useProjetoObrigatorio();
  const avisar = useAvisos();
  const entrada = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState(memoria?.projetoId === projeto.id ? memoria : null);
  const [lendo, setLendo] = useState(false);
  const [aba, setAba] = useState<Aba>('citacoes');

  const fontes = useLiveQuery(() => db.fontes.where('projetoId').equals(projeto.id).sortBy('titulo'), [projeto.id]);
  const textos = useLiveQuery(() => db.textos.where('projetoId').equals(projeto.id).toArray(), [projeto.id]);
  const fichasComTrecho = useLiveQuery(
    async () => new Set((await db.fichamentos.where('projetoId').equals(projeto.id).toArray()).filter((f) => f.trechoOriginal?.trim()).map((f) => f.fonteId)),
    [projeto.id],
  );

  async function rodar(doc: DocumentoTcc) {
    const resultado = auditar(doc, await carregarFontesParaAuditoria(projeto.id), { norma: projeto.normaReferencias, chamada: projeto.chamadaVancouver });
    memoria = { projetoId: projeto.id, doc, resultado };
    setEstado(memoria);
  }

  async function escolher(arquivo?: File) {
    if (!arquivo) return;
    setLendo(true);
    try {
      await rodar(await lerDocumentoTcc(arquivo));
    } catch (e) {
      avisar('erro', (e as Error).message);
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  const comTexto = new Map((textos ?? []).map((t) => [t.id, t.origem]));
  const completas = [...comTexto.values()].filter((o) => o === 'pdf').length;
  const resumos = comTexto.size - completas;
  const semMaterial = (fontes ?? []).filter((f) => !comTexto.has(f.id) && !fichasComTrecho?.has(f.id));
  const soResumo = (fontes ?? []).filter((f) => comTexto.get(f.id) === 'resumo');
  const r = estado?.resultado;

  return (
    <div className="max-w-4xl">
      <CabecalhoPagina titulo="Auditoria do TCC" descricao="Confere citações, referências e trechos parecidos com as suas fontes. Mostra pontos para conferir, não um veredito." />
      <AjudaSecao secao="auditoria" />

      <div className="grid gap-4 md:grid-cols-2">
        <Cartao className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><FileText size={16} className="text-acao-600" /> 1. Material das suas fontes</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-cinza-600">
            A comparação usa o texto guardado de cada fonte e os trechos originais dos seus fichamentos.
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            <li><strong className="font-medium">{completas}</strong> com texto completo (PDF)</li>
            <li><strong className="font-medium">{resumos}</strong> só com o resumo</li>
            <li><strong className="font-medium">{semMaterial.length}</strong> sem texto e sem fichas com trecho</li>
          </ul>
          {(semMaterial.length > 0 || soResumo.length > 0) && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-acao-700">Anexar PDFs às fontes</summary>
              <ul className="mt-2 flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
                {[...semMaterial, ...soResumo].map((f) => (
                  <li key={f.id} className="rounded-md border border-borda p-3">
                    <Link to={`/biblioteca/${f.id}`} className="mb-2 block font-medium hover:text-acao-700">{f.titulo || 'Sem título'}</Link>
                    <TextoDaFonte fonte={f} compacto />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Cartao>

        <Cartao className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Upload size={16} className="text-acao-600" /> 2. Envie o arquivo do TCC</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-cinza-600">Word (.docx) ou PDF. O Word dá um resultado melhor: o app reconhece o recuo das citações longas.</p>
          <input ref={entrada} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" aria-label="Arquivo do TCC" onChange={(e) => escolher(e.target.files?.[0])} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao variante="primario" onClick={() => entrada.current?.click()} disabled={lendo}>
              {lendo ? <Loader2 size={15} className="animate-spin" /> : <FileSearch size={15} />} {lendo ? 'Analisando…' : estado ? 'Analisar outro arquivo' : 'Escolher arquivo e analisar'}
            </Botao>
            {estado && !lendo && <Botao onClick={() => rodar(estado.doc)}><RefreshCw size={15} /> Analisar de novo</Botao>}
          </div>
          <p className="mt-3 flex gap-1.5 text-xs leading-relaxed text-cinza-500">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-sucesso-700" /> O arquivo é lido aqui, no seu navegador. Ele não é enviado a lugar nenhum nem guardado. Ao fechar a aba, o resultado some.
          </p>
        </Cartao>
      </div>

      {r && (
        <div className="mt-8">
          <h2 className="text-base font-semibold">Resultado: {r.nomeArquivo}</h2>
          <p className="mt-1 text-sm text-cinza-600">
            {r.palavrasNoTexto.toLocaleString('pt-BR')} palavras no texto · {r.citacoes.totalCitacoes} citações · {r.citacoes.totalObras} obras citadas · {r.totalReferencias} referências
          </p>
          <p className="mt-3 flex gap-2 rounded-md bg-cinza-100 px-3 py-2 text-xs leading-relaxed text-cinza-600">
            <Info size={14} className="mt-0.5 shrink-0" />
            A leitura é automática e pode errar (por exemplo, confundir um nome com o começo da frase). Confira cada ponto no seu arquivo: copie um pedaço do trecho e use Ctrl+F no Word.
          </p>

          <div role="tablist" aria-label="Partes da auditoria" className="mb-4 mt-5 flex gap-1 overflow-x-auto border-b border-borda">
            {([
              ['citacoes', 'Citações e referências', contarCitacoes(r)],
              ['diretas', 'Citações diretas', r.diretas.filter((d) => d.situacao !== 'confere').length],
              ['copia', 'Semelhança com as fontes', r.copia.trechos.length],
            ] as [Aba, string, number][]).map(([id, rotulo, n]) => (
              <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
                className={cx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors', aba === id ? 'border-acao-600 font-medium text-acao-700' : 'border-transparent text-cinza-600 hover:text-marinho-900')}>
                {rotulo}
                <span className={cx('ml-1.5 rounded px-1.5 text-xs', n ? 'bg-alerta-50 text-alerta-700' : 'bg-sucesso-50 text-sucesso-700')}>{n}</span>
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {aba === 'citacoes' && <AbaCitacoes r={r} maiusculas={!!projeto.citacaoMaiusculas} projetoId={projeto.id} />}
            {aba === 'diretas' && <AbaDiretas r={r} />}
            {aba === 'copia' && <AbaCopia r={r} />}
          </div>
        </div>
      )}
    </div>
  );
}

const contarCitacoes = (r: ResultadoAuditoria) =>
  (r.vancouver ? r.vancouver.semReferencia.length + r.vancouver.foraDeOrdem.length : 0) +
  r.citacoes.problemas.length + r.citacoes.naoCitadas.length + r.citacoes.semPagina.length + r.citacoes.semAutoria.length + r.citacoes.longasSemRecuo.length;

// ---------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------

function Trecho({ texto, inicio, fim, margem = 70 }: { texto: string; inicio: number; fim: number; margem?: number }) {
  const a = Math.max(0, inicio - margem);
  const b = Math.min(texto.length, fim + margem);
  return (
    <span className="text-sm leading-relaxed text-marinho-700">
      {a > 0 && '…'}{texto.slice(a, inicio)}
      <mark className="rounded bg-alerta-50 px-0.5 text-marinho-900">{texto.slice(inicio, fim)}</mark>
      {texto.slice(fim, b)}{b < texto.length && '…'}
    </span>
  );
}

function Grupo({ titulo, explicacao, n, tom = 'alerta', children }: { titulo: string; explicacao: ReactNode; n: number; tom?: 'alerta' | 'perigo' | 'neutro'; children: ReactNode }) {
  if (n === 0) return null;
  return (
    <details open className="group rounded-lg border border-borda bg-superficie">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
        <ChevronRight size={15} className="shrink-0 text-cinza-500 transition-transform group-open:rotate-90" />
        <span className="text-sm font-semibold">{titulo}</span>
        <Selo tom={tom} className="ml-auto">{n}</Selo>
      </summary>
      <div className="border-t border-borda px-4 pb-4 pt-3">
        <p className="mb-3 text-xs leading-relaxed text-cinza-600">{explicacao}</p>
        <ul className="flex flex-col gap-3">{children}</ul>
      </div>
    </details>
  );
}

function TudoCerto({ children }: { children: ReactNode }) {
  return <p className="flex items-center gap-2 rounded-lg border border-borda bg-superficie px-4 py-3 text-sm text-sucesso-700"><ShieldCheck size={16} /> {children}</p>;
}

// ---------------------------------------------------------------------
// Aba 1: citações × referências
// ---------------------------------------------------------------------

function AbaCitacoes({ r, maiusculas, projetoId }: { r: ResultadoAuditoria; maiusculas: boolean; projetoId: string }) {
  const v = r.vancouver;
  const c = r.citacoes;
  const texto = (pi: number) => r.corpo[pi]?.texto ?? '';
  const sem = c.problemas.filter((p) => p.tipo === 'sem_referencia');
  const ano = c.problemas.filter((p) => p.tipo === 'ano_diferente');
  const misturado = c.estilos.maiusculas > 0 && c.estilos.minusculas > 0;
  // Fora do padrão escolhido no projeto (só quando o arquivo usa um padrão só, o outro caso é o "misturado").
  const foraDoPadrao = !misturado && (maiusculas ? c.estilos.minusculas > 0 : c.estilos.maiusculas > 0);
  const padrao = maiusculas ? 'MAIÚSCULAS, como (SILVA, 2020)' : 'só a inicial maiúscula, como (Silva, 2020)';
  return (
    <div className="flex flex-col gap-3">
      {!r.achouReferencias && (
        <p className="rounded-lg border border-alerta-700/20 bg-alerta-50 px-4 py-3 text-sm text-alerta-700">
          Não encontramos o título “REFERÊNCIAS” no arquivo. Sem ele, não dá para conferir a lista. Verifique se o título está escrito sozinho numa linha.
        </p>
      )}
      {contarCitacoes(r) === 0 && !misturado && r.achouReferencias && <TudoCerto>Todas as citações encontradas têm referência, e todas as referências foram citadas.</TudoCerto>}
      {v && <GruposVancouver r={r} projetoId={projetoId} />}

      <Grupo titulo="Citado no texto, mas sem referência" n={sem.length} tom="perigo"
        explicacao="Toda obra citada precisa estar na lista de referências. Pode ser que falte a referência ou que o nome esteja escrito de outro jeito no texto e na lista.">
        {sem.map((p) => (
          <li key={p.obra} className="rounded-md bg-fundo p-3">
            <p className="text-sm font-medium">{p.obra} <span className="font-normal text-cinza-500">· {p.ocorrencias.length} {p.ocorrencias.length === 1 ? 'vez' : 'vezes'}</span></p>
            <p className="mt-1"><Trecho texto={texto(p.ocorrencias[0].citacao.paragrafo)} inicio={p.ocorrencias[0].citacao.inicio} fim={p.ocorrencias[0].citacao.fim} /></p>
          </li>
        ))}
      </Grupo>

      <Grupo titulo="Ano diferente do que está na referência" n={ano.length}
        explicacao="O autor está nas referências, mas com outro ano. Confira qual é o certo.">
        {ano.map((p) => (
          <li key={p.obra} className="rounded-md bg-fundo p-3">
            <p className="text-sm"><span className="font-medium">No texto:</span> {p.obra} <span className="text-cinza-500">· {p.ocorrencias.length} {p.ocorrencias.length === 1 ? 'vez' : 'vezes'}</span></p>
            {p.referencias.map((ref) => <p key={ref.indice} className="mt-1 text-sm"><span className="font-medium">Nas referências:</span> {ref.texto}</p>)}
            <p className="mt-1"><Trecho texto={texto(p.ocorrencias[0].citacao.paragrafo)} inicio={p.ocorrencias[0].citacao.inicio} fim={p.ocorrencias[0].citacao.fim} /></p>
          </li>
        ))}
      </Grupo>

      <Grupo titulo="Nas referências, mas não citado no texto" n={c.naoCitadas.length}
        explicacao="A lista de referências deve ter só as obras citadas no trabalho. Se você usou a obra, inclua a citação; se não, retire a referência.">
        {c.naoCitadas.map((ref) => <li key={ref.indice} className="rounded-md bg-fundo p-3 text-sm">{ref.texto}</li>)}
      </Grupo>

      <Grupo titulo="Citação direta sem página" n={c.semPagina.length} tom={v ? 'neutro' : 'alerta'}
        explicacao={v ? 'No Vancouver, a página na citação direta depende da instituição. Se a sua pedir, indique junto ao número, por exemplo: (1, p. 15).' : 'Na citação direta (cópia exata do texto), a NBR 10520 pede a página, por exemplo: (Silva, 2020, p. 15).'}>
        {c.semPagina.map((d, i) => <li key={i} className="rounded-md bg-fundo p-3"><Trecho texto={texto(d.paragrafo)} inicio={d.inicio} fim={d.citacao ? Math.max(d.fim, d.citacao.paragrafo === d.paragrafo ? d.citacao.fim : d.fim) : d.fim} margem={30} /></li>)}
      </Grupo>

      <Grupo titulo="Trecho entre aspas ou recuado sem citação" n={c.semAutoria.length}
        explicacao={v ? 'Encontramos um trecho entre aspas (ou recuado, como citação longa) sem número de citação logo depois. Se for uma citação, indique o número da obra.' : 'Encontramos um trecho entre aspas (ou recuado, como citação longa) sem autor e ano perto dele. Se for uma citação, indique a autoria.'}>
        {c.semAutoria.map((d, i) => <li key={i} className="rounded-md bg-fundo p-3"><Trecho texto={texto(d.paragrafo)} inicio={d.inicio} fim={d.fim} margem={30} /></li>)}
      </Grupo>

      <Grupo titulo="Citação longa entre aspas" n={c.longasSemRecuo.length} tom="neutro"
        explicacao="Citações diretas com mais de 3 linhas devem ficar em parágrafo próprio, com recuo de 4 cm, letra menor e sem aspas. Estes trechos têm mais de 40 palavras: confira o tamanho no Word.">
        {c.longasSemRecuo.map((d, i) => <li key={i} className="rounded-md bg-fundo p-3"><Trecho texto={texto(d.paragrafo)} inicio={d.inicio} fim={d.fim} margem={0} /></li>)}
      </Grupo>

      {misturado && (
        <p className="flex gap-2 rounded-lg border border-borda bg-superficie px-4 py-3 text-sm text-cinza-600">
          <Info size={16} className="mt-0.5 shrink-0 text-acao-600" />
          <span>Nos parênteses, há {c.estilos.maiusculas} citações com o sobrenome em MAIÚSCULAS e {c.estilos.minusculas} em minúsculas. O seu projeto está configurado para {padrao}. O importante é usar um só padrão. (Siglas, como IBGE, podem aparecer aqui.)</span>
        </p>
      )}
      {foraDoPadrao && (
        <p className="flex gap-2 rounded-lg border border-borda bg-superficie px-4 py-3 text-sm text-cinza-600">
          <Info size={16} className="mt-0.5 shrink-0 text-acao-600" />
          <span>As citações entre parênteses do arquivo estão com o sobrenome em {maiusculas ? 'minúsculas' : 'MAIÚSCULAS'}, mas o seu projeto está configurado para {padrao}. Confira qual padrão a sua instituição pede; dá para mudar em Projeto.</span>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Aba 2: citações diretas × fichamentos e textos
// ---------------------------------------------------------------------

function Diferencas({ pedacos, lado }: { pedacos: PedacoDiferenca[]; lado: 'tcc' | 'fonte' }) {
  const fora = lado === 'tcc' ? 'so_fonte' : 'so_tcc';
  const destaque = lado === 'tcc' ? 'so_tcc' : 'so_fonte';
  return (
    <span className="text-sm leading-relaxed">
      {pedacos.filter((p) => p.tipo !== fora).map((p, i) => (
        <span key={i}>
          {i > 0 && ' '}
          {p.tipo === destaque ? <mark className={cx('rounded px-0.5', lado === 'tcc' ? 'bg-perigo-50 text-perigo-700' : 'bg-sucesso-50 text-sucesso-700')}>{p.texto}</mark> : p.texto}
        </span>
      ))}
    </span>
  );
}

const ONDE = { ficha: 'no fichamento', texto: 'no texto guardado da fonte' } as const;

function AbaDiretas({ r }: { r: ResultadoAuditoria }) {
  const por = (s: SituacaoDireta) => r.diretas.filter((d) => d.situacao === s);
  const confere = por('confere');
  const rotulo = (v: VerificacaoDireta) => v.fonte?.rotulo ?? '';
  const trechoTcc = (v: VerificacaoDireta) => <Trecho texto={r.corpo[v.direta.paragrafo]?.texto ?? ''} inicio={v.direta.inicio} fim={v.direta.fim} margem={0} />;
  if (!r.diretas.length) return <TudoCerto>Não encontramos citações diretas com autoria (trechos entre aspas ou recuados seguidos de citação).</TudoCerto>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-cinza-600">
        {r.diretas.length} citações diretas encontradas. <strong className="font-medium text-sucesso-700">{confere.length} conferem</strong> com o fichamento ou com o texto da fonte.
      </p>
      <Grupo titulo="Palavras diferentes da fonte" n={por('diferente').length} tom="perigo"
        explicacao="A citação direta precisa reproduzir o texto exatamente. Em vermelho, o que está só no seu TCC; em verde, o que está na fonte. Supressões marcadas com [...] são aceitas.">
        {por('diferente').map((v, i) => (
          <li key={i} className="rounded-md bg-fundo p-3">
            <p className="text-xs font-medium text-cinza-500">{rotulo(v)} · {Math.round((v.semelhanca ?? 0) * 100)}% igual {ONDE[v.onde!]}</p>
            <p className="mt-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-cinza-500">No TCC </span><Diferencas pedacos={v.diferencas ?? []} lado="tcc" /></p>
            <p className="mt-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-cinza-500">Na fonte </span><Diferencas pedacos={v.diferencas ?? []} lado="fonte" /></p>
          </li>
        ))}
      </Grupo>
      <Grupo titulo="Página diferente do fichamento" n={por('pagina_diferente').length}
        explicacao="O trecho é igual ao do seu fichamento, mas a página citada no TCC é outra.">
        {por('pagina_diferente').map((v, i) => (
          <li key={i} className="rounded-md bg-fundo p-3">
            <p className="text-sm"><span className="font-medium">{rotulo(v)}</span> · no TCC: p. {v.direta.pagina} · no fichamento: p. {v.paginaFicha}</p>
            <p className="mt-1">{trechoTcc(v)}</p>
          </li>
        ))}
      </Grupo>
      <Grupo titulo="Trecho de outra fonte" n={por('outra_fonte').length} tom="perigo"
        explicacao="O trecho não está na obra citada, mas aparece exatamente em outra fonte da sua biblioteca. Confira a autoria.">
        {por('outra_fonte').map((v, i) => (
          <li key={i} className="rounded-md bg-fundo p-3">
            <p className="text-sm">Citado como <span className="font-medium">{v.direta.citacao?.texto}</span>, mas o trecho está em <span className="font-medium">{rotulo(v)}</span></p>
            <p className="mt-1">{trechoTcc(v)}</p>
          </li>
        ))}
      </Grupo>
      <Grupo titulo="Não encontrado nas fichas nem no texto da fonte" n={por('nao_encontrada').length}
        explicacao="A fonte tem material guardado, mas o trecho não aparece nele. Pode estar numa parte do texto que não foi guardada (por exemplo, quando só há o resumo) ou ter sido alterado.">
        {por('nao_encontrada').map((v, i) => <li key={i} className="rounded-md bg-fundo p-3"><p className="text-xs font-medium text-cinza-500">{rotulo(v)}</p><p className="mt-1">{trechoTcc(v)}</p></li>)}
      </Grupo>
      <Grupo titulo="Sem como conferir" n={por('sem_material').length + por('fora_da_biblioteca').length} tom="neutro"
        explicacao="A obra citada não está na biblioteca, ou está sem texto guardado e sem fichas com o trecho original. Anexe o PDF à fonte para conferir.">
        {[...por('sem_material'), ...por('fora_da_biblioteca')].map((v, i) => (
          <li key={i} className="rounded-md bg-fundo p-3">
            <p className="text-xs font-medium text-cinza-500">{v.situacao === 'sem_material' ? `${rotulo(v)} · sem material guardado` : `${v.direta.citacao?.texto} · não está na biblioteca`}</p>
            <p className="mt-1">{trechoTcc(v)}</p>
          </li>
        ))}
      </Grupo>
    </div>
  );
}

// ---------------------------------------------------------------------
// Aba 3: semelhança com as fontes
// ---------------------------------------------------------------------

const ORIGEM = (t: TrechoParecido) => (t.onde === 'ficha' ? 'trecho do fichamento' : t.fonte.texto?.origem === 'resumo' ? 'resumo' : 'texto do PDF');

function ParLado({ t }: { t: TrechoParecido }) {
  return (
    <li className="grid gap-3 rounded-md bg-fundo p-3 md:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-cinza-500">No seu TCC</p>
        <p className="text-sm leading-relaxed">{t.textoTcc}</p>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-cinza-500">{t.fonte.rotulo} · {ORIGEM(t)}</p>
        <p className="text-sm leading-relaxed text-cinza-600">{t.textoFonte}</p>
      </div>
      <p className="text-xs text-cinza-500 md:col-span-2">
        {t.tipo === 'parafrase' ? `${Math.round((t.semelhanca ?? 0) * 100)}% das sequências de palavras em comum` : `${t.palavras} palavras iguais`}
        {t.tipo !== 'fonte_diferente' && (t.citaFonte ? ' · o parágrafo cita esta fonte' : ' · o parágrafo não cita esta fonte')}
        {t.citada && ` · citado como ${t.citada}`}
      </p>
    </li>
  );
}

function AbaCopia({ r }: { r: ResultadoAuditoria }) {
  const c = r.copia;
  const por = (tipo: TrechoParecido['tipo']) => c.trechos.filter((t) => t.tipo === tipo);
  if (c.fontesComparadas === 0)
    return <p className="rounded-lg border border-borda bg-superficie px-4 py-3 text-sm text-cinza-600">Nenhuma fonte tem texto guardado ou fichas com trecho original. Anexe os PDFs às fontes (no quadro “Material das suas fontes”) e analise de novo.</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-cinza-600">
        Comparado com {c.fontesComparadas} {c.fontesComparadas === 1 ? 'fonte' : 'fontes'} da sua biblioteca.
        {c.citadosCorretamente > 0 && <> <strong className="font-medium text-sucesso-700">{c.citadosCorretamente} {c.citadosCorretamente === 1 ? 'trecho igual à fonte está' : 'trechos iguais à fonte estão'} entre aspas e com a citação certa.</strong></>}
        {' '}Não compara com a internet nem com outros trabalhos.
      </p>
      {c.trechos.length === 0 && <TudoCerto>Nenhum trecho do seu texto é igual ou muito próximo das fontes guardadas, fora das citações.</TudoCerto>}
      <Grupo titulo="Igual à fonte, sem aspas" n={por('sem_aspas').length} tom="perigo"
        explicacao="Trechos de 12 ou mais palavras idênticos ao texto da fonte, fora de aspas. Mesmo citando o autor, a cópia literal precisa de aspas (citação direta, com página) ou ser reescrita com as suas palavras (citação indireta).">
        {por('sem_aspas').map((t, i) => <ParLado key={i} t={t} />)}
      </Grupo>
      <Grupo titulo="Entre aspas, mas citando outra obra" n={por('fonte_diferente').length} tom="perigo"
        explicacao="O trecho entre aspas é igual a uma fonte, mas a citação ao lado indica outra obra.">
        {por('fonte_diferente').map((t, i) => <ParLado key={i} t={t} />)}
      </Grupo>
      <Grupo titulo="Entre aspas, sem citação" n={por('aspas_sem_citacao').length}
        explicacao="O trecho está entre aspas e é igual a uma fonte, mas não há autor e ano perto dele.">
        {por('aspas_sem_citacao').map((t, i) => <ParLado key={i} t={t} />)}
      </Grupo>
      <Grupo titulo="Paráfrase muito próxima" n={por('parafrase').length}
        explicacao="Frases em que metade ou mais das sequências de palavras também aparecem numa fonte. Na citação indireta, o texto deve ser reescrito com as suas palavras e citar o autor.">
        {por('parafrase').map((t, i) => <ParLado key={i} t={t} />)}
      </Grupo>
    </div>
  );
}

// ---------------------------------------------------------------------
// Vancouver: números sem referência, ordem de citação e numeração da biblioteca
// ---------------------------------------------------------------------

function GruposVancouver({ r, projetoId }: { r: ResultadoAuditoria; projetoId: string }) {
  const v = r.vancouver!;
  const avisar = useAvisos();
  const texto = (pi: number) => r.corpo[pi]?.texto ?? '';
  const [aplicando, setAplicando] = useState(false);
  return (
    <>
      <Grupo titulo="Número citado que não está na lista" n={v.semReferencia.length} tom="perigo"
        explicacao="O texto cita um número que não aparece na lista de referências. Pode faltar a referência ou o número estar errado.">
        {v.semReferencia.map((s) => (
          <li key={s.numero} className="rounded-md bg-fundo p-3">
            <p className="text-sm font-medium">Número {s.numero} <span className="font-normal text-cinza-500">· {s.ocorrencias.length} {s.ocorrencias.length === 1 ? 'vez' : 'vezes'}</span></p>
            <p className="mt-1"><Trecho texto={texto(s.ocorrencias[0].paragrafo)} inicio={s.ocorrencias[0].inicio} fim={s.ocorrencias[0].fim} /></p>
          </li>
        ))}
      </Grupo>
      <Grupo titulo="Numeração fora da ordem de citação" n={v.foraDeOrdem.length}
        explicacao="No Vancouver, as obras são numeradas na ordem em que aparecem pela primeira vez no texto. Aqui, a primeira citação deste número aparece antes da do número esperado.">
        {v.foraDeOrdem.map((f) => (
          <li key={f.numero} className="rounded-md bg-fundo p-3">
            <p className="text-sm">Aparece o <span className="font-medium">{f.numero}</span> quando o próximo número novo seria o <span className="font-medium">{f.esperado}</span>.</p>
            <p className="mt-1"><Trecho texto={texto(f.ocorrencia.paragrafo)} inicio={f.ocorrencia.inicio} fim={f.ocorrencia.fim} /></p>
          </li>
        ))}
      </Grupo>
      {v.listaSemNumero > 0 && (
        <p className="flex gap-2 rounded-lg border border-borda bg-superficie px-4 py-3 text-sm text-cinza-600">
          <Info size={16} className="mt-0.5 shrink-0 text-acao-600" />
          <span>{v.listaSemNumero === 1 ? '1 referência da lista não começa' : `${v.listaSemNumero} referências da lista não começam`} com número. Consideramos a posição na lista, mas no Vancouver cada referência começa com o seu número.</span>
        </p>
      )}
      {v.numeracao.length > 0 && (
        <Cartao className="p-4">
          <h3 className="text-sm font-semibold">Numerar a biblioteca na ordem do TCC</h3>
          <p className="mt-1 text-sm text-cinza-600">A plataforma encontrou {v.numeracao.length === 1 ? '1 fonte da biblioteca citada' : `${v.numeracao.length} fontes da biblioteca citadas`} no seu arquivo. Cada uma recebe o número da ordem em que aparece pela primeira vez. As fontes que não aparecem no TCC ficam sem número.</p>
          <ol className="mt-3 flex flex-col gap-1 text-sm text-marinho-700">
            {v.numeracao.slice(0, 12).map((n) => <li key={n.fonteId}><span className="font-semibold text-acao-700">{n.numero}.</span> {n.rotulo}</li>)}
            {v.numeracao.length > 12 && <li className="text-cinza-500">e mais {v.numeracao.length - 12}…</li>}
          </ol>
          {v.foraDaBiblioteca.length > 0 && <p className="mt-2 text-xs text-cinza-500">Não encontradas na biblioteca: {v.foraDaBiblioteca.map((x) => x.rotulo).join('; ')}.</p>}
          <Botao className="mt-3" variante="primario" disabled={aplicando} onClick={async () => {
            setAplicando(true);
            try {
              await numerarFontes(projetoId, new Map(v.numeracao.map((n) => [n.fonteId, n.numero])));
              avisar('sucesso', 'Biblioteca numerada na ordem do TCC.');
            } finally { setAplicando(false); }
          }}>Numerar a biblioteca</Botao>
        </Cartao>
      )}
    </>
  );
}
