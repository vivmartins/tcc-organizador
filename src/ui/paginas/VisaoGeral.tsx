import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileUp, MessagesSquare, BookPlus, Quote, Library, NotebookPen, Loader, CalendarClock, ArrowRight, CheckCircle2, Flag } from 'lucide-react';
import { db } from '../../data/db.ts';
import { AjudaSecao } from '../ajuda/AjudaSecao.tsx';
import { useProjetoObrigatorio } from '../projetoAtivo.tsx';
import { Cartao, CabecalhoPagina, BotaoLink, Selo, cx } from '../componentes/base.tsx';
import { dataCurta, diasAte, hojeIso, plural } from '../util.ts';
import { etapaAtual as calcularEtapaAtual, progresso, progressoPorEtapa, situacaoTarefa, ordenarTarefas } from '../../domain/planejamento.ts';
import { ROTULO_STATUS_LEITURA, TOM_STATUS_LEITURA, autoresCurtos } from './biblioteca/rotulos.ts';

function Indicador({ rotulo, valor, detalhe, icone, para }: { rotulo: string; valor: string; detalhe?: string; icone: ReactNode; para?: string }) {
  const conteudo = (
    <>
      <div className="flex items-center gap-2 text-[13px] text-cinza-600">
        <span className="text-cinza-500">{icone}</span>
        {rotulo}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{valor}</div>
      {detalhe && <div className="mt-0.5 text-xs text-cinza-500">{detalhe}</div>}
    </>
  );
  const classe = 'block rounded-lg border border-borda bg-superficie p-4';
  return para ? <Link to={para} className={cx(classe, 'hover:border-borda-forte')}>{conteudo}</Link> : <div className={classe}>{conteudo}</div>;
}

export function VisaoGeral() {
  const projeto = useProjetoObrigatorio();
  const dados = useLiveQuery(async () => {
    const id = projeto.id;
    const [fontes, fichamentos, tarefas, etapas] = await Promise.all([
      db.fontes.where('projetoId').equals(id).toArray(),
      db.fichamentos.where('projetoId').equals(id).toArray(),
      db.tarefas.where('projetoId').equals(id).toArray(),
      db.etapas.where('projetoId').equals(id).sortBy('ordem'),
    ]);
    return { fontes, fichamentos, tarefas, etapas };
  }, [projeto.id]);

  if (!dados) return null;
  const { fontes, fichamentos, tarefas, etapas } = dados;
  const hoje = hojeIso();
  const fontesRecentes = [...fontes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 5);
  const fichasRecentes = [...fichamentos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 5);
  const emAndamento = tarefas.filter((t) => t.status === 'em_andamento').length;
  const proximas = ordenarTarefas(tarefas.filter((t) => t.status !== 'concluida')).slice(0, 5);
  const etapaAtual = calcularEtapaAtual(etapas, tarefas, hoje);
  const progressoGeral = progresso(tarefas);
  const progressoEtapaAtual = etapaAtual ? progressoPorEtapa([etapaAtual], tarefas)[0] : null;
  const atrasadas = tarefas.filter((t) => situacaoTarefa(t, hoje) === 'atrasada').length;
  const lidas = fontes.filter((f) => f.statusLeitura === 'lido' || f.statusLeitura === 'revisado').length;
  const titulosFonte = new Map(fontes.map((f) => [f.id, f.titulo]));

  let prazoValor = 'Não definido';
  let prazoDetalhe: string | undefined = 'Defina em Dados do projeto';
  if (projeto.prazoFinal) {
    const d = diasAte(projeto.prazoFinal);
    prazoValor = dataCurta(projeto.prazoFinal);
    prazoDetalhe = d > 0 ? `faltam ${plural(d, 'dia', 'dias')}` : d === 0 ? 'é hoje' : `passou há ${plural(-d, 'dia', 'dias')}`;
  }

  return (
    <>
      <CabecalhoPagina titulo={projeto.nome} descricao={projeto.tema || 'Visão geral do seu TCC'} />
      <AjudaSecao secao="visao" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Fontes" valor={String(fontes.length)} detalhe={fontes.length ? plural(lidas, 'lida ou revisada', 'lidas ou revisadas') : undefined} icone={<Library size={15} />} para="/biblioteca" />
        <Indicador rotulo="Fichamentos" valor={String(fichamentos.length)} icone={<NotebookPen size={15} />} para="/fichamentos" />
        <Indicador rotulo="Tarefas em andamento" valor={String(emAndamento)} detalhe={progressoGeral.percentual !== null ? `${progressoGeral.percentual}% do planejamento concluído${atrasadas ? ` · ${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : ''}` : undefined} icone={<Loader size={15} />} para="/planejamento" />
        <Indicador rotulo="Prazo de entrega" valor={prazoValor} detalhe={prazoDetalhe} icone={<CalendarClock size={15} />} para={projeto.prazoFinal ? undefined : '/projeto'} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <BotaoLink para="/biblioteca/nova" variante="primario"><BookPlus size={16} /> Cadastrar fonte</BotaoLink>
        <BotaoLink para="/biblioteca/nova?importar=pdf"><FileUp size={16} /> Importar um PDF</BotaoLink>
        {fontes.length > 0 && <BotaoLink para="/fichamentos"><NotebookPen size={16} /> Adicionar anotação</BotaoLink>}
        {fontes.length > 0 && <BotaoLink para="/biblioteca?referencias=1"><Quote size={16} /> Gerar referências</BotaoLink>}
        <BotaoLink para="/orientacoes?nova=1"><MessagesSquare size={16} /> Registrar orientação</BotaoLink>
      </div>

      {fontes.length === 0 && (
        <Cartao className="mt-6 p-6">
          <h2 className="text-base font-semibold">Primeiros passos</h2>
          <ol className="mt-3 flex flex-col gap-3 text-sm text-marinho-700">
            {[
              ['Cadastre as fontes que você já tem', 'Artigos, livros, teses… com autores, ano e periódico.', '/biblioteca/nova'],
              ['Confira os dados e gere as referências ABNT', 'O app mostra o que está faltando ou precisa ser conferido.', null],
              ['Monte o planejamento', 'Etapas, tarefas e prazos até a entrega, com um planejamento sugerido para começar.', '/planejamento'],
              ['Faça um backup', 'Seus dados ficam só neste navegador. Guarde uma cópia no seu Drive.', '/dados'],
            ].map(([t, d, link], i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-acao-50 text-xs font-semibold text-acao-700">{i + 1}</span>
                <span>
                  {link ? <Link to={link} className="font-medium text-acao-700 hover:underline">{t}</Link> : <span className="font-medium">{t}</span>}
                  <span className="block text-cinza-600">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </Cartao>
      )}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {fontes.length > 0 && (<>
          <Cartao>
            <div className="flex items-center justify-between border-b border-borda px-4 py-3">
              <h2 className="text-sm font-semibold">Fontes adicionadas recentemente</h2>
              <Link to="/biblioteca" className="flex items-center gap-1 text-xs text-acao-700 hover:underline">Ver todas <ArrowRight size={13} /></Link>
            </div>
            <ul className="divide-y divide-borda">
              {fontesRecentes.map((f) => (
                <li key={f.id}>
                  <Link to={`/biblioteca/${f.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-fundo">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.titulo}</span>
                      <span className="block truncate text-xs text-cinza-500">{[autoresCurtos(f.autores), f.ano].filter(Boolean).join(' · ')}</span>
                    </span>
                    <Selo tom={TOM_STATUS_LEITURA[f.statusLeitura]} className="shrink-0">{ROTULO_STATUS_LEITURA[f.statusLeitura]}</Selo>
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>

          <Cartao>
            <div className="flex items-center justify-between border-b border-borda px-4 py-3"><h2 className="text-sm font-semibold">Fichamentos recentes</h2><Link to="/fichamentos" className="flex items-center gap-1 text-xs text-acao-700 hover:underline">Ver todos <ArrowRight size={13} /></Link></div>
            {fichasRecentes.length === 0 ? (
              <p className="px-4 py-6 text-sm text-cinza-500">Nenhum fichamento registrado ainda.</p>
            ) : (
              <ul className="divide-y divide-borda">
                {fichasRecentes.map((f) => (
                  <li key={f.id} className="px-4 py-3">
                    <p className="line-clamp-2 text-sm">{f.trechoOriginal || f.parafrase || f.interpretacao}</p>
                    <p className="mt-0.5 truncate text-xs text-cinza-500">{titulosFonte.get(f.fonteId)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          </>)}

          <Cartao>
            <div className="flex items-center justify-between border-b border-borda px-4 py-3"><h2 className="text-sm font-semibold">Próximas tarefas</h2><Link to="/planejamento" className="flex items-center gap-1 text-xs text-acao-700 hover:underline">Planejamento <ArrowRight size={13} /></Link></div>
            {proximas.length === 0 ? (
              <p className="px-4 py-6 text-sm text-cinza-500">Nenhuma tarefa pendente.</p>
            ) : (
              <ul className="divide-y divide-borda">
                {proximas.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="truncate">{t.titulo}</span>
                    {t.prazo && <span className={cx('shrink-0 text-xs', t.prazo < hoje ? 'text-perigo-700' : 'text-cinza-500')}>{dataCurta(t.prazo)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao className="p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Flag size={15} className="text-cinza-500" /> Etapa do cronograma</h2>
            {etapaAtual ? (
              <>
                <p className="mt-2 text-sm">{etapaAtual.nome}{etapaAtual.dataFim && <span className="text-cinza-500"> até {dataCurta(etapaAtual.dataFim)}</span>}</p>
                {progressoEtapaAtual?.percentual !== null && progressoEtapaAtual && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-cinza-100"><div className="h-full rounded-full bg-sucesso-700" style={{ width: `${progressoEtapaAtual.percentual}%` }} /></div>
                    <p className="mt-1 text-xs text-cinza-500">{progressoEtapaAtual.concluidas} de {plural(progressoEtapaAtual.total, 'tarefa concluída', 'tarefas concluídas')}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-cinza-500">{etapas.length ? 'Nenhuma etapa em andamento hoje.' : <>Nenhuma etapa definida ainda. <Link to="/planejamento" className="text-acao-700 hover:underline">Montar planejamento</Link></>}</p>
            )}
            {fontes.length > 0 && lidas === fontes.length && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-sucesso-700"><CheckCircle2 size={14} /> Todas as fontes já foram lidas.</p>
            )}
          </Cartao>
        </div>

    </>
  );
}
