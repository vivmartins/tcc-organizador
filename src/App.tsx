import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProvedorAvisos } from './ui/componentes/dialogos.tsx';
import { ProvedorProjeto, useProjeto } from './ui/projetoAtivo.tsx';
import { Layout } from './ui/layout/Layout.tsx';
import { BoasVindas, EditarProjeto, NovoProjeto } from './ui/paginas/Projeto.tsx';
import { VisaoGeral } from './ui/paginas/VisaoGeral.tsx';
import { Biblioteca } from './ui/paginas/biblioteca/Biblioteca.tsx';
import { FormularioFonte } from './ui/paginas/biblioteca/FormularioFonte.tsx';
import { PaginaFonte } from './ui/paginas/biblioteca/PaginaFonte.tsx';
import { Dados } from './ui/paginas/Dados.tsx';
import { EmBreve } from './ui/paginas/EmBreve.tsx';

function Rotas() {
  const { carregando, projeto } = useProjeto();
  if (carregando) return null;
  if (!projeto) return <BoasVindas />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<VisaoGeral />} />
        <Route path="biblioteca" element={<Biblioteca />} />
        <Route path="biblioteca/nova" element={<FormularioFonte key="nova" />} />
        <Route path="biblioteca/:id" element={<PaginaFonte />} />
        <Route path="biblioteca/:id/editar" element={<FormularioFonte key="editar" />} />
        <Route path="fichamentos" element={<EmBreve titulo="Fichamentos" descricao="Aqui você vai registrar citações diretas e indiretas, resumos e ideias de cada fonte, com página e capítulo do TCC." />} />
        <Route path="planejamento" element={<EmBreve titulo="Planejamento" descricao="Etapas, tarefas, prazos e cronograma do seu TCC, com progresso calculado pelas tarefas concluídas." />} />
        <Route path="orientacoes" element={<EmBreve titulo="Orientações" descricao="Registro das orientações do seu orientador, com prazos, status e vínculo com tarefas." />} />
        <Route path="conferencia" element={<EmBreve titulo="Conferência final" descricao="Checklist editável para preparar a entrega do TCC." />} />
        <Route path="projeto" element={<EditarProjeto />} />
        <Route path="projeto/novo" element={<NovoProjeto />} />
        <Route path="dados" element={<Dados />} />
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
        <HashRouter>
          <Rotas />
        </HashRouter>
      </ProvedorProjeto>
    </ProvedorAvisos>
  );
}
