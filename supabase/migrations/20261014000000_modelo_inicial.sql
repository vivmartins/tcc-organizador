-- =====================================================================
-- Organizador de TCC — modelo de dados inicial
-- ---------------------------------------------------------------------
-- Como ler este arquivo:
--  * Cada "create table" é uma tabela (como uma planilha com colunas fixas).
--  * Toda tabela está ligada a um PROJETO, e todo projeto a um USUÁRIO.
--  * No final, as regras de segurança (RLS) garantem que cada pessoa
--    só consegue ler e alterar os dados dos próprios projetos.
-- =====================================================================

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Busca em português sem acentos ("humanizacao" encontra "Humanização")
-- ---------------------------------------------------------------------
create or replace function public.immutable_unaccent(text)
returns text language sql immutable parallel safe
set search_path = public, extensions
as $$ select unaccent('unaccent', $1) $$;

do $$ begin
  if not exists (select 1 from pg_ts_config where cfgname = 'pt_sem_acento') then
    create text search configuration public.pt_sem_acento (copy = pg_catalog.portuguese);
    alter text search configuration public.pt_sem_acento
      alter mapping for hword, hword_part, word with unaccent, portuguese_stem;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Listas de valores fixos (enums)
-- ---------------------------------------------------------------------
create type public.status_leitura as enum ('nao_iniciado', 'lendo', 'lido', 'revisado');

create type public.tipo_publicacao as enum (
  'artigo_periodico', 'livro', 'capitulo_livro', 'tese', 'dissertacao',
  'tcc_monografia', 'trabalho_evento', 'documento_institucional',
  'legislacao', 'pagina_web', 'outro'
);

create type public.origem_metadados as enum ('manual', 'crossref', 'openalex', 'url', 'pdf');

create type public.tipo_autor as enum ('pessoa', 'entidade');

create type public.tipo_fichamento as enum (
  'citacao_direta', 'citacao_indireta', 'resumo', 'ideia', 'dado_relevante'
);

create type public.prioridade as enum ('baixa', 'media', 'alta');
create type public.status_tarefa as enum ('a_fazer', 'em_andamento', 'concluida');
create type public.status_orientacao as enum ('pendente', 'em_andamento', 'concluida');
create type public.origem_orientacao as enum ('reuniao', 'email', 'comentario_documento', 'outro');

-- Versões de norma que o gerador de referências sabe aplicar.
create type public.versao_norma as enum ('nbr6023_2018_10520_2023');

-- ---------------------------------------------------------------------
-- Atualiza "updated_at" automaticamente em toda edição
-- ---------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- PROJETOS
-- ---------------------------------------------------------------------
create table public.projetos (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome          text not null check (length(trim(nome)) > 0),
  tema          text,
  objetivo_geral text,
  data_inicio   date,
  prazo_final   date,
  versao_norma  public.versao_norma not null default 'nbr6023_2018_10520_2023',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (prazo_final is null or data_inicio is null or prazo_final >= data_inicio)
);
create index on public.projetos (owner_id);

-- Função usada pelas regras de segurança: "este projeto é meu?"
create or replace function public.projeto_e_meu(p uuid)
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.projetos where id = p and owner_id = auth.uid())
$$;

-- ---------------------------------------------------------------------
-- FONTES (publicações) e AUTORES
-- ---------------------------------------------------------------------
create table public.fontes (
  id               uuid primary key default gen_random_uuid(),
  projeto_id       uuid not null references public.projetos(id) on delete cascade,
  tipo             public.tipo_publicacao not null default 'artigo_periodico',
  titulo           text not null check (length(trim(titulo)) > 0),
  subtitulo        text,
  ano              smallint check (ano between 1000 and 2100),
  veiculo          text,          -- periódico, livro (no caso de capítulo), evento ou instituição
  edicao           text,
  local_publicacao text,
  editora          text,
  volume           text,
  numero           text,
  paginas          text,          -- ex.: "45-67"
  numero_artigo    text,          -- ex.: "e20230012"
  doi              text,
  url              text,
  isbn             text,
  issn             text,
  data_acesso      date,          -- exigida pela ABNT para documentos online
  palavras_chave   text[] not null default '{}',
  status_leitura   public.status_leitura not null default 'nao_iniciado',
  observacoes      text,
  -- Resumo do estudo (todos opcionais)
  resumo_objetivo   text,
  resumo_conceitos  text,
  resumo_metodo     text,
  resumo_resultados text,
  resumo_conclusoes text,
  -- Rastreabilidade dos dados
  origem_metadados public.origem_metadados not null default 'manual',
  -- Situação de cada campo: {"titulo":"verificado","paginas":"importado", ...}
  -- valores possíveis: importado | manual_nao_conferido | verificado
  status_campos    jsonb not null default '{}'::jsonb,
  arquivo_pdf      text,          -- caminho no Storage
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Campo calculado para a busca (título, subtítulo, veículo, palavras-chave, observações)
  busca tsvector generated always as (
    setweight(to_tsvector('public.pt_sem_acento', coalesce(titulo, '') || ' ' || coalesce(subtitulo, '')), 'A') ||
    setweight(to_tsvector('public.pt_sem_acento', coalesce(veiculo, '')), 'C') ||
    setweight(to_tsvector('public.pt_sem_acento', coalesce(observacoes, '')), 'D')
  ) stored
);
create index on public.fontes (projeto_id);
create index on public.fontes using gin (busca);
create index on public.fontes (projeto_id, lower(doi)) where doi is not null;

create table public.autores_fonte (
  id         uuid primary key default gen_random_uuid(),
  fonte_id   uuid not null references public.fontes(id) on delete cascade,
  ordem      smallint not null,
  tipo       public.tipo_autor not null default 'pessoa',
  sobrenome  text not null check (length(trim(sobrenome)) > 0),  -- ou nome da entidade
  prenomes   text,
  unique (fonte_id, ordem)
);
create index on public.autores_fonte (fonte_id);

-- ---------------------------------------------------------------------
-- FICHAMENTOS
-- ---------------------------------------------------------------------
create table public.fichamentos (
  id              uuid primary key default gen_random_uuid(),
  fonte_id        uuid not null references public.fontes(id) on delete cascade,
  projeto_id      uuid not null references public.projetos(id) on delete cascade,
  tipo            public.tipo_fichamento not null,
  trecho_original text,           -- preservado exatamente como digitado
  pagina          text,           -- ex.: "p. 15" ou "15-16" ou "seção 3"
  parafrase       text,
  interpretacao   text,
  capitulo_secao  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (coalesce(trecho_original, parafrase, interpretacao) is not null),
  busca tsvector generated always as (
    to_tsvector('public.pt_sem_acento',
      coalesce(trecho_original, '') || ' ' || coalesce(parafrase, '') || ' ' ||
      coalesce(interpretacao, '') || ' ' || coalesce(capitulo_secao, ''))
  ) stored
);
create index on public.fichamentos (fonte_id);
create index on public.fichamentos (projeto_id);
create index on public.fichamentos using gin (busca);

-- ---------------------------------------------------------------------
-- TAGS
-- ---------------------------------------------------------------------
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  nome       text not null check (length(trim(nome)) > 0),
  cor        text,
  created_at timestamptz not null default now()
);
create unique index tags_nome_unico on public.tags (projeto_id, lower(nome));

create table public.fontes_tags (
  fonte_id uuid not null references public.fontes(id) on delete cascade,
  tag_id   uuid not null references public.tags(id) on delete cascade,
  primary key (fonte_id, tag_id)
);

create table public.fichamentos_tags (
  fichamento_id uuid not null references public.fichamentos(id) on delete cascade,
  tag_id        uuid not null references public.tags(id) on delete cascade,
  primary key (fichamento_id, tag_id)
);

-- ---------------------------------------------------------------------
-- PLANEJAMENTO: etapas e tarefas
-- ---------------------------------------------------------------------
create table public.etapas (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null references public.projetos(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  ordem       smallint not null default 0,
  data_inicio date,
  data_fim    date,            -- entrega intermediária, se houver
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.etapas (projeto_id);

create table public.tarefas (
  id           uuid primary key default gen_random_uuid(),
  projeto_id   uuid not null references public.projetos(id) on delete cascade,
  etapa_id     uuid references public.etapas(id) on delete set null,
  titulo       text not null check (length(trim(titulo)) > 0),
  descricao    text,
  prazo        date,
  prioridade   public.prioridade not null default 'media',
  status       public.status_tarefa not null default 'a_fazer',
  concluida_em timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.tarefas (projeto_id);
create index on public.tarefas (etapa_id);

-- Mantém "concluida_em" coerente com o status
create or replace function public.ajustar_conclusao_tarefa()
returns trigger language plpgsql as $$
begin
  if new.status = 'concluida' and new.concluida_em is null then
    new.concluida_em = now();
  elsif new.status <> 'concluida' then
    new.concluida_em = null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- ORIENTAÇÕES
-- ---------------------------------------------------------------------
create table public.orientacoes (
  id                    uuid primary key default gen_random_uuid(),
  projeto_id            uuid not null references public.projetos(id) on delete cascade,
  titulo                text not null check (length(trim(titulo)) > 0),
  descricao             text,
  data_feedback         date,
  origem                public.origem_orientacao not null default 'reuniao',
  capitulo_secao        text,
  prioridade            public.prioridade not null default 'media',
  prazo                 date,
  status                public.status_orientacao not null default 'pendente',
  observacoes_alteracao text,
  tarefa_id             uuid references public.tarefas(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on public.orientacoes (projeto_id);

-- ---------------------------------------------------------------------
-- CONFERÊNCIA FINAL (checklist)
-- ---------------------------------------------------------------------
create table public.checklist_itens (
  id         uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos(id) on delete cascade,
  categoria  text not null,
  texto      text not null check (length(trim(texto)) > 0),
  concluido  boolean not null default false,
  ordem      smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.checklist_itens (projeto_id);

-- ---------------------------------------------------------------------
-- Gatilhos de updated_at e de conclusão
-- ---------------------------------------------------------------------
create trigger t_projetos_upd    before update on public.projetos        for each row execute function public.tocar_updated_at();
create trigger t_fontes_upd      before update on public.fontes          for each row execute function public.tocar_updated_at();
create trigger t_fichamentos_upd before update on public.fichamentos     for each row execute function public.tocar_updated_at();
create trigger t_etapas_upd      before update on public.etapas          for each row execute function public.tocar_updated_at();
create trigger t_tarefas_upd     before update on public.tarefas         for each row execute function public.tocar_updated_at();
create trigger t_orientacoes_upd before update on public.orientacoes     for each row execute function public.tocar_updated_at();
create trigger t_checklist_upd   before update on public.checklist_itens for each row execute function public.tocar_updated_at();
create trigger t_tarefas_conclusao before insert or update on public.tarefas for each row execute function public.ajustar_conclusao_tarefa();

-- Um fichamento sempre pertence ao mesmo projeto da sua fonte
create or replace function public.validar_projeto_fichamento()
returns trigger language plpgsql as $$
begin
  if new.projeto_id <> (select projeto_id from public.fontes where id = new.fonte_id) then
    raise exception 'O fichamento deve pertencer ao mesmo projeto da fonte';
  end if;
  return new;
end $$;
create trigger t_fichamento_projeto before insert or update on public.fichamentos
  for each row execute function public.validar_projeto_fichamento();

-- =====================================================================
-- SEGURANÇA (Row Level Security)
-- Cada pessoa só enxerga e altera linhas dos próprios projetos.
-- =====================================================================
alter table public.projetos         enable row level security;
alter table public.fontes           enable row level security;
alter table public.autores_fonte    enable row level security;
alter table public.fichamentos      enable row level security;
alter table public.tags             enable row level security;
alter table public.fontes_tags      enable row level security;
alter table public.fichamentos_tags enable row level security;
alter table public.etapas           enable row level security;
alter table public.tarefas          enable row level security;
alter table public.orientacoes      enable row level security;
alter table public.checklist_itens  enable row level security;

create policy "dono do projeto" on public.projetos
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "dono do projeto" on public.fontes          for all to authenticated using (public.projeto_e_meu(projeto_id)) with check (public.projeto_e_meu(projeto_id));
create policy "dono do projeto" on public.fichamentos     for all to authenticated using (public.projeto_e_meu(projeto_id)) with check (public.projeto_e_meu(projeto_id));
create policy "dono do projeto" on public.tags            for all to authenticated using (public.projeto_e_meu(projeto_id)) with check (public.projeto_e_meu(projeto_id));
create policy "dono do projeto" on public.etapas          for all to authenticated using (public.projeto_e_meu(projeto_id)) with check (public.projeto_e_meu(projeto_id));
create policy "dono do projeto" on public.tarefas         for all to authenticated using (public.projeto_e_meu(projeto_id)) with check (public.projeto_e_meu(projeto_id));
create policy "dono do projeto" on public.orientacoes     for all to authenticated using (public.projeto_e_meu(projeto_id)) with check (public.projeto_e_meu(projeto_id));
create policy "dono do projeto" on public.checklist_itens for all to authenticated using (public.projeto_e_meu(projeto_id)) with check (public.projeto_e_meu(projeto_id));

create policy "dono da fonte" on public.autores_fonte for all to authenticated
  using      (exists (select 1 from public.fontes f where f.id = fonte_id and public.projeto_e_meu(f.projeto_id)))
  with check (exists (select 1 from public.fontes f where f.id = fonte_id and public.projeto_e_meu(f.projeto_id)));

create policy "dono da fonte e da tag" on public.fontes_tags for all to authenticated
  using      (exists (select 1 from public.fontes f where f.id = fonte_id and public.projeto_e_meu(f.projeto_id)))
  with check (
    exists (select 1 from public.fontes f join public.tags t on t.projeto_id = f.projeto_id
            where f.id = fonte_id and t.id = tag_id and public.projeto_e_meu(f.projeto_id)));

create policy "dono do fichamento e da tag" on public.fichamentos_tags for all to authenticated
  using      (exists (select 1 from public.fichamentos f where f.id = fichamento_id and public.projeto_e_meu(f.projeto_id)))
  with check (
    exists (select 1 from public.fichamentos f join public.tags t on t.projeto_id = f.projeto_id
            where f.id = fichamento_id and t.id = tag_id and public.projeto_e_meu(f.projeto_id)));

-- Vínculos entre tabelas também precisam ficar dentro do mesmo projeto
create or replace function public.validar_etapa_da_tarefa()
returns trigger language plpgsql as $$
begin
  if new.etapa_id is not null
     and new.projeto_id <> (select projeto_id from public.etapas where id = new.etapa_id) then
    raise exception 'A etapa pertence a outro projeto';
  end if;
  return new;
end $$;

create or replace function public.validar_tarefa_da_orientacao()
returns trigger language plpgsql as $$
begin
  if new.tarefa_id is not null
     and new.projeto_id <> (select projeto_id from public.tarefas where id = new.tarefa_id) then
    raise exception 'A tarefa vinculada pertence a outro projeto';
  end if;
  return new;
end $$;
create trigger t_tarefas_vinculo     before insert or update on public.tarefas     for each row execute function public.validar_etapa_da_tarefa();
create trigger t_orientacoes_vinculo before insert or update on public.orientacoes for each row execute function public.validar_tarefa_da_orientacao();

-- =====================================================================
-- ARQUIVOS PDF (Storage) — bucket privado; cada usuário só acessa
-- a própria pasta: pdfs/<id do usuário>/<arquivo>.pdf
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdfs', 'pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "pdfs do próprio usuário" on storage.objects for all to authenticated
  using      (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
