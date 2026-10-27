import type React from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ProvedorAvisos } from './ui/componentes/dialogos.tsx';
import { ProvedorBackupAutomatico } from './ui/backupAutomatico.tsx';
import { ProvedorSincronizacaoDrive } from './ui/sincronizacaoDrive.tsx';
import { ProvedorProjeto, useProjeto } from './ui/projetoAtivo.tsx';
import { Layout } from './ui/layout/Layout.tsx';
import { EditarProjeto, NovoProjeto } from './ui/paginas/Projeto.tsx';
import { ExigeProjeto, Inicio } from './ui/paginas/Inicio.tsx';
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
import { Auditoria } from './ui/paginas/Auditoria.tsx';

/** Cada navegação para "Cadastrar fonte" começa com um formulário limpo. */
function NovaFonte() {
  const { key, search } = useLocation();
  return <FormularioFonte key={`nova-${key}-${search}`} />;
}

function Rotas() {
  const { carregando, projeto } = useProjeto();
  if (carregando) return null;
  const exige = (secao: Parameters<typeof ExigeProjeto>[0]['secao'], titulo: string, el: React.ReactNode) => (
    <ExigeProjeto secao={secao} titulo={titulo}>{el}</ExigeProjeto>
  );
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={projeto ? <VisaoGeral /> : <Inicio />} />
        <Route path="biblioteca" element={exige('biblioteca', 'Biblioteca', <Biblioteca />)} />
        <Route path="biblioteca/nova" element={exige('biblioteca', 'Biblioteca', <NovaFonte />)} />
        <Route path="biblioteca/:id" element={exige('biblioteca', 'Biblioteca', <PaginaFonte />)} />
        <Route path="biblioteca/:id/editar" element={exige('biblioteca', 'Biblioteca', <FormularioFonte key="editar" />)} />
        <Route path="fichamentos" element={exige('fichamentos', 'Fichamentos', <Fichamentos />)} />
        <Route path="planejamento" element={exige('planejamento', 'Planejamento', <Planejamento />)} />
        <Route path="orientacoes" element={exige('orientacoes', 'Orientações', <Orientacoes />)} />
        <Route path="auditoria" element={exige('auditoria', 'Auditoria do TCC', <Auditoria />)} />
        <Route path="conferencia" element={exige('conferencia', 'Conferência final', <Conferencia />)} />
        <Route path="projeto" element={projeto ? <EditarProjeto /> : <Navigate to="/projeto/novo" replace />} />
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
          <ProvedorSincronizacaoDrive>
            <HashRouter>
              <Rotas />
            </HashRouter>
          </ProvedorSincronizacaoDrive>
        </ProvedorBackupAutomatico>
      </ProvedorProjeto>
    </ProvedorAvisos>
  );
}
