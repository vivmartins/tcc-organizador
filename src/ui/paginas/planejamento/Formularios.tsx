import { useState, type FormEvent } from 'react';
import type { Etapa, Tarefa } from '../../../data/db.ts';
import { ErroDeValidacao } from '../../../data/fontes.ts';
import { criarEtapa, atualizarEtapa, criarTarefa, atualizarTarefa } from '../../../data/planejamento.ts';
import { ROTULO_PRIORIDADE, ROTULO_STATUS_TAREFA, type Prioridade, type StatusTarefa } from '../../../domain/planejamento.ts';
import { AreaTexto, Botao, Campo, Entrada, Selecao } from '../../componentes/base.tsx';
import { Modal, useAvisos } from '../../componentes/dialogos.tsx';

export function FormularioTarefa({ projetoId, etapas, tarefa, etapaInicial, aoFechar }: { projetoId: string; etapas: Etapa[]; tarefa?: Tarefa; etapaInicial?: string; aoFechar: () => void }) {
  const avisar = useAvisos();
  const [titulo, setTitulo] = useState(tarefa?.titulo ?? '');
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? '');
  const [etapaId, setEtapaId] = useState(tarefa?.etapaId ?? etapaInicial ?? '');
  const [prazo, setPrazo] = useState(tarefa?.prazo ?? '');
  const [prioridade, setPrioridade] = useState<Prioridade>(tarefa?.prioridade ?? 'media');
  const [status, setStatus] = useState<StatusTarefa>(tarefa?.status ?? 'a_fazer');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const d = { titulo, descricao, etapaId, prazo, prioridade, status };
      if (tarefa) await atualizarTarefa(tarefa.id, d);
      else await criarTarefa(projetoId, d);
      avisar('sucesso', tarefa ? 'Tarefa atualizada.' : 'Tarefa criada.');
      aoFechar();
    } catch (err) {
      if (err instanceof ErroDeValidacao) setErros(err.erros);
      else avisar('erro', `Não foi possível salvar: ${(err as Error).message}`);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={tarefa ? 'Editar tarefa' : 'Nova tarefa'} rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-tarefa" disabled={salvando}>{tarefa ? 'Salvar' : 'Criar tarefa'}</Botao></>}>
      <form id="form-tarefa" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <Campo rotulo="Título" id="tarefa-titulo" obrigatorio erro={erros.titulo}>
          <Entrada id="tarefa-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-invalid={!!erros.titulo} autoFocus placeholder="Ex.: Ler os artigos sobre comunicação" />
        </Campo>
        <Campo rotulo="Descrição" id="tarefa-descricao">
          <AreaTexto id="tarefa-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Etapa" id="tarefa-etapa">
            <Selecao id="tarefa-etapa" value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
              <option value="">Sem etapa</option>
              {etapas.map((et) => <option key={et.id} value={et.id}>{et.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Prazo" id="tarefa-prazo">
            <Entrada id="tarefa-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </Campo>
          <Campo rotulo="Prioridade" id="tarefa-prioridade">
            <Selecao id="tarefa-prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
              {(['alta', 'media', 'baixa'] as Prioridade[]).map((p) => <option key={p} value={p}>{ROTULO_PRIORIDADE[p]}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Status" id="tarefa-status">
            <Selecao id="tarefa-status" value={status} onChange={(e) => setStatus(e.target.value as StatusTarefa)}>
              {(['a_fazer', 'em_andamento', 'concluida'] as StatusTarefa[]).map((s) => <option key={s} value={s}>{ROTULO_STATUS_TAREFA[s]}</option>)}
            </Selecao>
          </Campo>
        </div>
      </form>
    </Modal>
  );
}

export function FormularioEtapa({ projetoId, etapa, aoFechar }: { projetoId: string; etapa?: Etapa; aoFechar: () => void }) {
  const avisar = useAvisos();
  const [nome, setNome] = useState(etapa?.nome ?? '');
  const [dataInicio, setDataInicio] = useState(etapa?.dataInicio ?? '');
  const [dataFim, setDataFim] = useState(etapa?.dataFim ?? '');
  const [erros, setErros] = useState<Record<string, string>>({});

  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      if (etapa) await atualizarEtapa(etapa.id, { nome, dataInicio, dataFim });
      else await criarEtapa(projetoId, { nome, dataInicio, dataFim });
      avisar('sucesso', etapa ? 'Etapa atualizada.' : 'Etapa criada.');
      aoFechar();
    } catch (err) {
      if (err instanceof ErroDeValidacao) setErros(err.erros);
      else avisar('erro', `Não foi possível salvar: ${(err as Error).message}`);
    }
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={etapa ? 'Editar etapa' : 'Nova etapa'} largura="max-w-md" rodape={<><Botao onClick={aoFechar}>Cancelar</Botao><Botao variante="primario" type="submit" form="form-etapa">{etapa ? 'Salvar' : 'Criar etapa'}</Botao></>}>
      <form id="form-etapa" onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <Campo rotulo="Nome da etapa" id="etapa-nome" obrigatorio erro={erros.nome}>
          <Entrada id="etapa-nome" value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={!!erros.nome} autoFocus placeholder="Ex.: Leitura e fichamento" />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Início" id="etapa-inicio">
            <Entrada id="etapa-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </Campo>
          <Campo rotulo="Entrega (fim)" id="etapa-fim" erro={erros.dataFim} dica="Use para entregas intermediárias.">
            <Entrada id="etapa-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} aria-invalid={!!erros.dataFim} />
          </Campo>
        </div>
      </form>
    </Modal>
  );
}
