import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, ShieldCheck, ShieldAlert, HardDrive } from 'lucide-react';
import { Botao, CabecalhoPagina, Cartao } from '../componentes/base.tsx';
import { Confirmacao, useAvisos } from '../componentes/dialogos.tsx';
import {
  gerarBackup, lerArquivoDeBackup, restaurarBackup, nomeDoArquivoDeBackup, registrarBackupFeito,
  obterUltimoBackup, pedirArmazenamentoPersistente, rotuloContagem, type ArquivoBackup, type ResumoBackup,
} from '../../data/backup.ts';
import { dataCurta } from '../util.ts';
import { AjudaSecao } from '../ajuda/AjudaSecao.tsx';
import { CartaoBackupAutomatico } from './CartaoBackupAutomatico.tsx';
import { CartaoSincronizacao } from './CartaoSincronizacao.tsx';

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Dados() {
  const avisar = useAvisos();
  const entrada = useRef<HTMLInputElement>(null);
  const ultimo = useLiveQuery(obterUltimoBackup, []);
  const [persistente, setPersistente] = useState<boolean | null | undefined>(undefined);
  const [paraRestaurar, setParaRestaurar] = useState<{ arquivo: ArquivoBackup; resumo: ResumoBackup } | null>(null);

  useEffect(() => {
    void pedirArmazenamentoPersistente().then(setPersistente);
  }, []);

  async function exportar() {
    try {
      const backup = await gerarBackup();
      baixar(nomeDoArquivoDeBackup(), JSON.stringify(backup, null, 2));
      await registrarBackupFeito();
      avisar('sucesso', 'Backup baixado. Guarde o arquivo no seu Google Drive ou em outro lugar seguro.');
    } catch (e) {
      avisar('erro', `Não foi possível gerar o backup: ${(e as Error).message}`);
    }
  }

  async function escolherArquivo(arquivo?: File) {
    if (!arquivo) return;
    try {
      setParaRestaurar(lerArquivoDeBackup(await arquivo.text()));
    } catch (e) {
      avisar('erro', (e as Error).message);
    } finally {
      if (entrada.current) entrada.current.value = '';
    }
  }

  return (
    <div className="max-w-3xl">
      <CabecalhoPagina titulo="Backup e dados" descricao="Seus dados ficam neste navegador e, se você ligar a sincronização, no seu Google Drive. O backup é a sua cópia de segurança." />
      <AjudaSecao secao="dados" />

      <div className="flex flex-col gap-4">
        <CartaoSincronizacao />
        <Cartao className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Download size={16} className="text-acao-600" /> Fazer backup</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-cinza-600">
            Baixa um arquivo com todos os seus projetos, fontes, fichamentos e tarefas. Salve-o no Google Drive, num pendrive ou envie para o seu e-mail.
          </p>
          <p className="mt-2 text-sm">
            Último backup: <strong className="font-medium">{ultimo ? dataCurta(ultimo) : 'nunca feito'}</strong>
          </p>
          <Botao variante="primario" className="mt-4" onClick={exportar}><Download size={15} /> Baixar backup agora</Botao>
        </Cartao>

        <CartaoBackupAutomatico />

        <Cartao className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Upload size={16} className="text-acao-600" /> Restaurar backup</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-cinza-600">
            Use para recuperar seus dados ou passá-los para outro computador. <strong className="font-medium text-marinho-700">Os dados atuais deste navegador serão substituídos</strong> pelos do arquivo; antes disso, você verá o que há nele.
          </p>
          <input ref={entrada} type="file" accept=".json,application/json" className="hidden" onChange={(e) => escolherArquivo(e.target.files?.[0])} />
          <Botao className="mt-4" onClick={() => entrada.current?.click()}><Upload size={15} /> Escolher arquivo de backup</Botao>
        </Cartao>

        <Cartao className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><HardDrive size={16} className="text-acao-600" /> Proteção do navegador</h2>
          {persistente === true && (
            <p className="mt-1.5 flex gap-2 text-sm text-sucesso-700"><ShieldCheck size={17} className="shrink-0" /> O navegador marcou seus dados como permanentes: ele não vai apagá-los sozinho quando o espaço do computador ficar baixo.</p>
          )}
          {persistente === false && (
            <p className="mt-1.5 flex gap-2 text-sm text-alerta-700"><ShieldAlert size={17} className="shrink-0" /> O navegador não confirmou a proteção permanente dos dados. Isso é comum até você usar o site com frequência. Mantenha os backups em dia.</p>
          )}
          {persistente === null && <p className="mt-1.5 text-sm text-cinza-600">Este navegador não informa se protege os dados. Mantenha os backups em dia.</p>}
          <p className="mt-3 text-xs leading-relaxed text-cinza-500">
            Limpar os “dados de navegação” ou “cookies e dados de sites” do navegador apaga o que está guardado aqui. Usar uma janela anônima também não guarda nada.
          </p>
        </Cartao>
      </div>

      <Confirmacao
        aberto={!!paraRestaurar}
        titulo="Restaurar este backup?"
        textoConfirmar="Substituir e restaurar"
        perigoso
        aoCancelar={() => setParaRestaurar(null)}
        aoConfirmar={async () => {
          if (!paraRestaurar) return;
          try {
            await restaurarBackup(paraRestaurar.arquivo);
            avisar('sucesso', 'Backup restaurado.');
          } catch (e) {
            avisar('erro', `Não foi possível restaurar: ${(e as Error).message}`);
          } finally {
            setParaRestaurar(null);
          }
        }}
      >
        {paraRestaurar && (
          <>
            <p>Backup feito em <strong>{dataCurta(paraRestaurar.resumo.exportadoEm)}</strong>, com:</p>
            <ul className="my-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(paraRestaurar.resumo.contagens).map(([t, n]) => (
                <li key={t}><strong>{n}</strong> {rotuloContagem(t as Parameters<typeof rotuloContagem>[0], n)}</li>
              ))}
            </ul>
            {paraRestaurar.resumo.projetos.length > 0 && <p className="text-cinza-600">Projetos: {paraRestaurar.resumo.projetos.join(', ')}</p>}
            <p className="mt-3 font-medium text-perigo-700">Tudo o que está neste navegador agora será substituído.</p>
          </>
        )}
      </Confirmacao>
    </div>
  );
}
