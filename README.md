# Organizador de TCC

Plataforma para organizar pesquisas bibliográficas e o desenvolvimento do TCC.

**Modo local:** os dados de cada pessoa ficam no próprio navegador (IndexedDB). Nada é enviado
para servidores. A cópia de segurança é feita pelo backup em arquivo (Backup e dados).

## Como rodar no computador
Requer [Node.js](https://nodejs.org) 20 ou mais recente.

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

## Testes
```bash
npm test           # regras ABNT, duplicatas, banco local e backup
npm run typecheck  # verificação de tipos
npm run build      # gera a versão final em dist/
```

## Organização do código
```
src/
  domain/   regras puras (ABNT NBR 6023:2018 e 10520:2023, duplicatas, busca, validação)
  data/     banco no navegador (Dexie/IndexedDB), projetos, fontes, tags e backup
  ui/       telas e componentes (React + Tailwind)
supabase/   modelo de dados para uma futura sincronização em nuvem (opcional, não usado)
```

## Andamento
- [x] Etapa 1 — estrutura, menu lateral, projetos, visão geral com dados reais, backup
- [x] Etapa 2 — biblioteca: cadastro manual, busca sem acento, filtros, ordenação, duplicatas, tags
- [x] Etapa 3 — referências e citações ABNT, com pendências e dados conferidos
- [x] Etapa 5 — fichamentos (registro, busca, filtros, cópia da ficha completa)
- [x] Etapa 4 — importação por DOI, link e PDF (Crossref + OpenAlex, direto do navegador)
- [x] Etapa 6 — planejamento: etapas, tarefas, cronograma, progresso e planejamento sugerido
- [x] Etapa 7 — orientações (registro, status, prazos e vínculo com tarefas)
- [x] Etapa 8a — conferência final (checklist editável com situação do projeto)
- [ ] Etapa 8b — backup automático
