import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProvedorAvisos } from './ui/componentes/dialogos.tsx';
import { ProvedorBackupAutomatico } from './ui/backupAutomatico.tsx';
import { ProvedorProjeto, useProjeto } from './ui/projetoAtivo.tsx';
import { Layout } from './ui/layout/Layout.tsx';
import { BoasVindas, EditarProjeto, NovoProjeto } from './ui/paginas/Projeto.tsx';
import { VisaoGeral } from './ui/paginas/VisaoGeral.tsx';
import { Biblioteca } from './ui/paginas/biblioteca/Biblioteca.tsx';
import { FormularioFonte } from './ui/paginas/biblioteca/FormularioFonte.tsx';
import { PaginaFonte } from './ui/paginas/biblioteca/PaginaFonte.tsx';
import { Dados } from './ui/paginas/Dados.tsx';
import { Fichamentos } from './ui/paginas/fichamentos/Fichamentos.tsx';
import { Orientacoes } from './ui/paginas/Orientacoes.tsx';
import { ComoFunciona } from './ui/ajuda/ComoFunciona.tsx';
import { Planejamento } from './ui/paginas/planejamento/Planejamento.tsx';
import { Conferencia } from './ui/paginas/Conferencia.tsx';

/** Cada navegação para "Cadastrar fonte" começa com um formulário limpo. */
function NovaFonte() {
  const { key, search } = useLocation();
  return <FormularioFonte key={`nova-${key}-${search}`} />;
}

function Rotas() {
  const { carregando, projeto } = useProjeto();
  if (carregando) return null;
  if (!projeto) return <BoasVindas />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<VisaoGeral />} />
        <Route path="biblioteca" element={<Biblioteca />} />
        <Route path="biblioteca/nova" element={<NovaFonte />} />
        <Route path="biblioteca/:id" element={<PaginaFonte />} />
        <Route path="biblioteca/:id/editar" element={<FormularioFonte key="editar" />} />
        <Route path="fichamentos" element={<Fichamentos />} />
        <Route path="planejamento" element={<Planejamento />} />
        <Route path="orientacoes" element={<Orientacoes />} />
        <Route path="conferencia" element={<Conferencia />} />
        <Route path="projeto" element={<EditarProjeto />} />
        <Route path="projeto/novo" element={<NovoProjeto />} />
        <Route path="dados" element={<Dados />} />
        <Route path="como-funciona" element={<ComoFunciona />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ProvedorAvisos>
      <ProvedorProjeto>
        {/* HashRouter: os endereços ficam como site.com/#/biblioteca, o que funciona em
            qualquer hospedagem gratuita sem configuração extra. */}
        <ProvedorBackupAutomatico>
          <HashRouter>
            <Rotas />
          </HashRouter>
        </ProvedorBackupAutomatico>
      </ProvedorProjeto>
    </ProvedorAvisos>
  );
}
