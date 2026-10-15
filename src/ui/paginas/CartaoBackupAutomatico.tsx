import { RefreshCw, FolderSync, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Botao, Cartao, Selo } from '../componentes/base.tsx';
import { Modal } from '../componentes/dialogos.tsx';
import { useBackupAutomatico } from '../backupAutomatico.tsx';
import { rotuloContagem } from '../../data/backup.ts';
import { dataCurta } from '../util.ts';

function dataHora(iso: string | null) {
  if (!iso) return 'ainda não';
  const d = new Date(iso);
  return `${dataCurta(iso)} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function CartaoBackupAutomatico() {
  const b = useBackupAutomatico();
  return (
    <Cartao className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><FolderSync size={16} className="text-acao-600" /> Backup automático</h2>
        {b.situacao === 'ativo' && <Selo tom="sucesso"><CheckCircle2 size={12} /> Ligado</Selo>}
        {(b.situacao === 'precisa_reautorizar' || b.situacao === 'erro') && <Selo tom="alerta"><AlertTriangle size={12} /> Pausado</Selo>}
      </div>

      {b.situacao === 'nao_suportado' && (
        <p className="mt-1.5 flex gap-2 text-sm leading-relaxed text-cinza-600">
          <Info size={16} className="mt-0.5 shrink-0" /> Este navegador não permite backup automático. Ele funciona no <strong className="font-medium text-marinho-700">Chrome</strong> e no <strong className="font-medium text-marinho-700">Edge</strong>, no computador. Aqui, use o backup manual acima.
        </p>
      )}

      {b.situacao === 'inativo' && (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-cinza-600">
            Escolha um arquivo no seu computador e o app vai atualizá-lo sozinho a cada alteração. <strong className="font-medium text-marinho-700">Dica:</strong> salve dentro da pasta do <strong className="font-medium text-marinho-700">Google Drive para computador</strong>; assim o Drive leva a cópia para a nuvem, sem custo e sem passar por nenhum servidor do app.
          </p>
          <Botao variante="primario" className="mt-4" onClick={b.escolher}><FolderSync size={15} /> Escolher onde salvar</Botao>
        </>
      )}

      {b.situacao === 'ativo' && (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-cinza-600">Cada alteração é gravada em <strong className="font-medium text-marinho-700">{b.nomeArquivo}</strong>, alguns segundos depois de feita.</p>
          <p className="mt-1 text-sm">Última gravação: <strong className="font-medium">{dataHora(b.ultimo)}</strong></p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao onClick={b.salvarAgora}><RefreshCw size={14} /> Salvar agora</Botao>
            <Botao variante="fantasma" onClick={b.escolher}>Trocar arquivo</Botao>
            <Botao variante="fantasma" onClick={b.desativar}>Desligar</Botao>
          </div>
        </>
      )}

      {b.situacao === 'precisa_reautorizar' && (
        <>
          <p className="mt-1.5 text-sm leading-relaxed text-alerta-700">Por segurança, o navegador pede a sua autorização de novo depois que a aba é fechada. Enquanto isso, o backup automático fica pausado.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Botao variante="primario" onClick={b.reativar}><RefreshCw size={14} /> Reativar backup automático</Botao>
            <Botao variante="fantasma" onClick={b.desativar}>Desligar</Botao>
          </div>
        </>
      )}

      {b.situacao === 'erro' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Botao variante="primario" onClick={b.escolher}>Escolher o arquivo de novo</Botao>
          <Botao variante="fantasma" onClick={b.desativar}>Desligar</Botao>
        </div>
      )}
      {b.erro && <p role="alert" className="mt-3 text-sm text-perigo-700">{b.erro}</p>}

      <Modal
        aberto={!!b.conflito}
        aoFechar={() => b.resolverConflito('cancelar')}
        titulo="Este arquivo já tem um backup"
        rodape={
          <>
            <Botao onClick={() => b.resolverConflito('cancelar')}>Cancelar</Botao>
            <Botao onClick={() => b.resolverConflito('substituir')}>Substituir pelo que está aqui</Botao>
            <Botao variante="primario" onClick={() => b.resolverConflito('restaurar')}>Restaurar este backup</Botao>
          </>
        }
      >
        {b.conflito && (
          <>
            <p>O arquivo escolhido tem um backup de <strong>{dataCurta(b.conflito.resumo.exportadoEm)}</strong> com:</p>
            <ul className="my-3 grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(b.conflito.resumo.contagens).filter(([, n]) => n > 0).map(([t, n]) => <li key={t}><strong>{n}</strong> {rotuloContagem(t as Parameters<typeof rotuloContagem>[0], n)}</li>)}
            </ul>
            <p className="text-cinza-600"><strong className="font-medium text-marinho-700">Restaurar</strong> traz esses dados para este navegador (por exemplo, num computador novo). <strong className="font-medium text-marinho-700">Substituir</strong> grava por cima com o que está aqui agora.</p>
          </>
        )}
      </Modal>
    </Cartao>
  );
}
