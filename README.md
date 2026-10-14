# Organizador de TCC

Plataforma para organizar pesquisas bibliográficas e o desenvolvimento do TCC.
Modo local: os dados de cada pessoa ficam no próprio navegador, com backup em arquivo.

## Estado atual
- [x] Regras de negócio em `src/domain/` (sem dependências externas):
  - gerador de referências ABNT NBR 6023:2018 (artigo, livro, capítulo, tese/dissertação/TCC,
    evento, documento institucional, página web) com pendências e marcadores para dados ausentes;
  - citações NBR 10520:2023 (parentética e narrativa, et al., entidade, sem autoria);
  - detecção de duplicatas (DOI, URL, título + ano + autor) e extração de DOI.
- [x] Modelo de dados para uma futura sincronização em nuvem (`supabase/migrations/`, opcional).
- [ ] Interface (React + TypeScript) — aguardando liberação de acesso ao npm.

## Testes
```
node --test "src/domain/**/*.test.ts"
```
