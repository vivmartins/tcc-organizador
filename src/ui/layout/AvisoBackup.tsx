import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle } from 'lucide-react';
import { db } from '../../data/db.ts';
import { obterUltimoBackup } from '../../data/backup.ts';
import { diasAte } from '../util.ts';

export const DIAS_PARA_LEMBRAR_BACKUP = 7;

/** Aparece no menu quando há dados e o último backup está antigo (ou nunca foi feito). */
export function AvisoBackup() {
  const estado = useLiveQuery(async () => {
    const [ultimo, fontes, projetos] = await Promise.all([obterUltimoBackup(), db.fontes.count(), db.projetos.count()]);
    return { ultimo, temDados: fontes > 0 || projetos > 1 };
  }, []);
  if (!estado?.temDados) return null;
  const dias = estado.ultimo ? -diasAte(estado.ultimo.slice(0, 10)) : null;
  if (dias !== null && dias < DIAS_PARA_LEMBRAR_BACKUP) return null;
  return (
    <Link to="/dados" className="flex gap-2 rounded-md border border-alerta-700/20 bg-alerta-50 px-3 py-2.5 text-xs leading-snug text-alerta-700 hover:border-alerta-700/40">
      <AlertTriangle size={15} className="mt-px shrink-0" />
      <span>{dias === null ? 'Você ainda não fez nenhum backup.' : `Último backup há ${dias} dias.`} Faça agora para não perder seus dados.</span>
    </Link>
  );
}
