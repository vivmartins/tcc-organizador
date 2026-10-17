# Organizador de TCC

Aplicação web para organizar a pesquisa bibliográfica e o desenvolvimento do TCC:
biblioteca de fontes com referências ABNT, fichamentos, planejamento, orientações e conferência final.

**Endereços:**
- Página de apresentação: https://vivmartins.github.io/tcc-organizador/
- Plataforma (direto): https://vivmartins.github.io/tcc-organizador/app/

Endereços antigos da plataforma (com `#/…`) são levados automaticamente para `/app/`.

## Como os dados são guardados

O app funciona em **modo local**: tudo o que a pessoa cadastra fica no **próprio navegador**
(banco IndexedDB). Não há servidor, conta nem custo, e quem publica o app não tem acesso aos dados
de ninguém.

Para não perder dados:
- **Backup manual** (Backup e dados → Baixar backup agora): gera um arquivo `.json` com tudo.
- **Backup automático** (Chrome/Edge no computador): o app grava uma cópia num arquivo escolhido
  pela pessoa a cada alteração. Salvo na pasta do Google Drive para computador, vai para a nuvem.
  - Se o arquivo escolhido já tiver um backup, o app pergunta se deve restaurar ou substituir.
  - O app nunca grava um banco vazio por cima de um backup.
- **Restaurar backup**: traz os dados de volta ou leva para outro computador.

Serviços externos usados, sempre a partir do navegador de quem usa:
- **Crossref** e **OpenAlex**: dados bibliográficos pelo DOI (sem chave, gratuitos).
- **Tradução de palavras-chave e tópicos** para o português: primeiro o tradutor embutido do
  Chrome/Edge (no próprio computador); se ele não existir ou não responder, o serviço gratuito
  **MyMemory**, que recebe só esses termos curtos do artigo. Sem tradução, termos em outro idioma não são usados.

## Funcionalidades

| Seção | O que faz |
|---|---|
| Início (sem projeto) | Entrada livre: a pessoa vê cada seção, abre um projeto de exemplo fictício ou inicia o próprio projeto quando quiser |
| Visão geral | Indicadores calculados dos dados reais, prazo, próximas tarefas, atalhos |
| Biblioteca | Cadastro manual ou por DOI/link/PDF, busca sem acento, filtros, duplicatas, temas sugeridos |
| Página da fonte | Referência ABNT (NBR 6023:2025) com pendências, citação (NBR 10520:2023), resumo, fichas |
| Fichamentos | Citações (trecho original preservado), paráfrases, ideias, com página e capítulo |
| Planejamento | Etapas, tarefas, cronograma, progresso por tarefas concluídas, planejamento sugerido |
| Orientações | Pedidos do orientador, prazos, status e vínculo com tarefas |
| Auditoria do TCC | Lê o TCC (Word ou PDF) e aponta: citações sem referência, ano diferente, referências não citadas, citações diretas sem página ou diferentes do fichamento/fonte, trechos iguais às fontes sem aspas e paráfrases muito próximas |
| Conferência final | Checklist editável e situação atual do projeto |
| Como funciona | Explicação de cada seção (também há ajuda dentro de cada aba) |

### Auditoria do TCC

- O arquivo do TCC é lido no navegador (Word com `fflate` + leitor XML; PDF com pdf.js) e **não é guardado**.
- Para a comparação, cada fonte pode ter o **texto do PDF** (ou o resumo do OpenAlex) guardado no navegador
  (tabela `textos`, incluída no backup); o arquivo PDF em si não é guardado. Os trechos originais dos
  fichamentos também entram.
- A checagem de cópia usa sequências de 8 palavras como sementes, junta trechos iguais de 12+ palavras e
  mede a sobreposição de sequências de 3 palavras por frase para paráfrases próximas.
- Compara só com as fontes cadastradas, não com a internet. O resultado é apresentado como pontos para conferir.

Ainda não incluído: conferência da formatação do Word (margens, fonte, espaçamento) e da formatação de cada referência da lista.

## Rodar no computador (para desenvolvimento)

Requer [Node.js](https://nodejs.org) 20 ou mais recente.

```bash
npm install        # instala as bibliotecas (uma vez)
npm run dev        # apresentação em http://localhost:5173 e plataforma em http://localhost:5173/app/
```

## Testar

```bash
npm test           # testes automáticos: ABNT, duplicatas, busca, banco local, backup,
                   # planejamento, orientações, importação, palavras-chave, tradução e auditoria
npm run typecheck  # verificação de tipos (TypeScript)
npm run build      # gera a versão final em dist/
npm run preview    # abre a versão final em http://localhost:4173
```

## Publicar

A publicação é automática pelo **GitHub Pages** (gratuito):

1. Envie as alterações para a branch `main` do repositório.
2. O GitHub Actions (`.github/workflows/publicar.yml`) instala, **roda os testes** e gera o site.
3. Se algum teste falhar, nada é publicado e o site anterior continua no ar.
4. Em 1 a 2 minutos o endereço acima mostra a versão nova (recarregue a página).

Configuração única, já feita: em *Settings → Pages → Source*, escolher **GitHub Actions**.

Para publicar em outro lugar (Netlify, Vercel…), basta servir a pasta `dist/` gerada por
`npm run build`: o app usa endereços com `#` e caminhos relativos, então funciona em qualquer endereço.

## Organização do código

```
src/
  domain/        regras puras, sem banco nem internet (fáceis de testar):
                 ABNT (referências e citações), duplicatas, busca, validação,
                 fichamentos, planejamento, orientações, palavras-chave,
                 auditoria/ (citações, referências, comparação de trechos, cópia)
  data/          banco no navegador (Dexie/IndexedDB): projetos, fontes, tags, fichas,
                 etapas, tarefas, orientações, checklist, backup manual e automático
  integrations/  serviços externos: Crossref/OpenAlex, leitura de PDF (pdf.js), tradução,
                 leitura do arquivo do TCC (.docx e PDF)
  ui/            telas e componentes (React + Tailwind), textos de ajuda em ui/ajuda/textos.ts
index.html       página de apresentação (HTML estático; imagens em public/apresentacao/)
app/index.html   entrada da plataforma
supabase/        modelo de dados para uma possível sincronização em nuvem (não usado)
```

## Decisões principais

- **Modo local em vez de servidor**: custo zero e nenhuma responsabilidade sobre dados de terceiros.
  A troca é que os dados não sincronizam sozinhos entre aparelhos (o backup resolve).
- **Normas ABNT**: Estilo Vancouver (ICMJE/NLM, termos em português) como opção do projeto: referência, chamada numérica (sobrescrito, parênteses ou colchetes) e auditoria dos números. NBR 6023:2025 para referências (DOI como endereço completo, https://doi.org/...) e NBR 10520:2023 para citações, com opção no projeto para o sobrenome em MAIÚSCULAS entre parênteses — (SILVA, 2021) —, padrão anterior que algumas instituições ainda pedem.
  Uma referência formatada não é automaticamente correta: o app mostra o que falta ou precisa ser
  conferido, e cada dado pode ser marcado como "conferido".
- **Nada é inventado**: dados ausentes aparecem como pendência (ex.: `[ANO?]`), nunca preenchidos por suposição.
