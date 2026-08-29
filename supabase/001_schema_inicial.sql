-- ============================================================
-- O DECISOR — Schema inicial (piloto interno A3)
-- Supabase / PostgreSQL
-- Referência: docs/produto.md, docs/regras-negocio.md, docs/arquitetura.md
-- ============================================================

-- ------------------------------------------------------------
-- 1. TIPOS
-- ------------------------------------------------------------
create type papel_usuario as enum ('decisor', 'gestor', 'admin');
create type estado_caso   as enum ('relato', 'entendimento', 'plano', 'aguardando_resultado',
                                   'resolvido', 'nao_resolvido', 'aberto', 'expirado');
create type quadrante_t   as enum ('Q1', 'Q2', 'Q3', 'Q4');
create type acao_admin_t  as enum ('descartar', 'retentar', 'reverter_descarte');

-- ------------------------------------------------------------
-- 2. ORGANIZAÇÕES (tenant — piloto usa apenas a A3)
-- ------------------------------------------------------------
create table organizacoes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  sla_horas   int  not null default 48 check (sla_horas in (24, 48, 72)),
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now()
);

insert into organizacoes (id, nome)
values ('00000000-0000-0000-0000-0000000000a3', 'A3 Condomínios');

-- ------------------------------------------------------------
-- 3. ESTRUTURA
-- ------------------------------------------------------------
create table clientes (            -- condomínios
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade
                 default '00000000-0000-0000-0000-0000000000a3',
  nome           text not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  unique (organizacao_id, nome)
);

create table equipes (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade
                 default '00000000-0000-0000-0000-0000000000a3',
  nome           text not null,
  unique (organizacao_id, nome)
);

-- Perfil espelha auth.users (Supabase Auth cuida da senha, sempre em hash)
create table perfis (
  id             uuid primary key references auth.users(id) on delete cascade,
  organizacao_id uuid not null references organizacoes(id) on delete cascade
                 default '00000000-0000-0000-0000-0000000000a3',
  nome           text not null,
  papel          papel_usuario not null default 'decisor',
  equipe_id      uuid references equipes(id) on delete set null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

-- Vínculo usuário ↔ clientes (decisor e gestor podem ter vários)
create table perfis_clientes (
  perfil_id  uuid not null references perfis(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  primary key (perfil_id, cliente_id)
);

-- ------------------------------------------------------------
-- 4. PRINCÍPIOS (base controlada — 13 capítulos)
-- ------------------------------------------------------------
create table principios (
  id        int primary key,
  capitulo  text not null,
  nome      text not null,
  mensagem  text not null,
  aplicar_quando text not null
);

insert into principios (id, capitulo, nome, mensagem, aplicar_quando) values
(1,  'I · Avaliação',            'Vença antes de lutar',
     'A batalha se decide na avaliação prévia, não no combate. Quem calcula mais, vence.',
     'Decisão tomada no impulso, sem levantar dados que já existem.'),
(2,  'II · Do combate',          'Guerra longa não tem vencedor',
     'Operação prolongada consome recursos e desgasta quem a conduz, mesmo ganhando.',
     'Problema se arrasta há semanas; o custo de continuar já supera o de resolver.'),
(3,  'III · Estratégia ofensiva','Vencer sem combater',
     'O melhor resultado é obtido sem confronto — pela negociação, pelo acordo, pela mudança da regra.',
     'Conflito entre pessoas, disputa com fornecedor, imposição que geraria resistência.'),
(4,  'IV · Disposições',         'Primeiro impossibilite a derrota',
     'Torne-se invulnerável antes de buscar a vitória. A segurança depende de você; a oportunidade, do outro.',
     'Risco de dano, exposição legal ou operacional que precisa ser contido antes de qualquer avanço.'),
(5,  'V · Energia',              'Ordinário prende, extraordinário decide',
     'Use o método padrão para segurar a situação e um movimento fora do padrão para resolvê-la.',
     'O procedimento normal já foi tentado e não resolveu; falta um movimento diferente.'),
(6,  'VI · Vazio e cheio',       'Ataque onde não há resistência',
     'Concentre esforço no ponto fraco do problema, não onde ele é mais visível ou mais defendido.',
     'Muito esforço no sintoma mais barulhento em vez do ponto que realmente cede.'),
(7,  'VII · Manobra',            'O caminho indireto chega antes',
     'A rota aparentemente mais longa costuma ser a mais rápida quando a direta está bloqueada.',
     'Via direta travada por hierarquia, burocracia ou recusa de alguém.'),
(8,  'VIII · Variações',         'Nem toda ordem deve ser cumprida',
     'Há situações em que o padrão não se aplica. Saber quando não seguir a regra é parte do método.',
     'O procedimento existe mas não serve a este caso; insistir nele piora o resultado.'),
(9,  'IX · Marchas',             'Leia os sinais do terreno',
     'Comportamentos e detalhes revelam a intenção real de quem está do outro lado.',
     'Explicação recebida não bate com os fatos; alguém age de forma inconsistente.'),
(10, 'X · Terreno',              'Conheça o terreno antes de avançar',
     'Cada tipo de terreno exige uma tática. Avançar sem reconhecê-lo é como decidir vendado.',
     'Falta informação básica: histórico, contrato, custo real, quem decide o quê.'),
(11, 'XI · As nove situações',   'A situação define a tática',
     'Não existe resposta única. O que funciona em um contexto fracassa em outro.',
     'Solução que deu certo em outro lugar está sendo copiada sem ajuste.'),
(12, 'XII · Ataque pelo fogo',   'Não decida com raiva',
     'Ação movida por irritação é irreversível e o ressentimento não volta a ser confiança.',
     'Há desgaste emocional, conflito pessoal ou vontade de romper relação no calor do momento.'),
(13, 'XIII · Espionagem',        'Informação antecipada é o maior investimento',
     'Saber antes custa pouco perto do que custa descobrir tarde.',
     'O problema poderia ter sido evitado se alguém soubesse antes; falta monitoramento.');

-- ------------------------------------------------------------
-- 5. CASOS — o histórico imutável da jornada
-- ------------------------------------------------------------
create table casos (
  id             uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade
                 default '00000000-0000-0000-0000-0000000000a3',
  autor_id       uuid not null references perfis(id),
  cliente_id     uuid references clientes(id),      -- null = Interno/Externo
  contexto_livre text,                              -- 'Interno' | 'Externo' quando sem cliente
  equipe_id      uuid references equipes(id),
  caso_pai_id    uuid references casos(id),         -- retentativa

  estado         estado_caso not null default 'relato',

  -- Passo 1 (original e confirmado coexistem para sempre — regra §2)
  relato_original    text not null,
  relato_confirmado  text,
  interpretacao_ia   text,
  problema_real      text,
  interesses         text,

  -- Passo 2 (sugerido e escolhido coexistem — a divergência é métrica)
  quadrante_sugerido quadrante_t,
  quadrante_escolhido quadrante_t,
  explicacao_ia      text,

  -- Passo 3
  principio_id       int references principios(id),
  leitura_principio  text,
  erro_provavel      text,
  aprendizado_ia     text,

  -- Relógio (server-side)
  started_at     timestamptz,
  deadline_at    timestamptz,
  resultado_em   timestamptz,

  origem_admin   boolean not null default false,  -- caso criado por gestor/admin
  arquivado      boolean not null default false,
  criado_em      timestamptz not null default now()
);

create index on casos (organizacao_id, estado);
create index on casos (autor_id);
create index on casos (cliente_id);
create index on casos (caso_pai_id);

-- Ações do plano: entidade própria (comentários, evidências e atrasos no futuro)
create table acoes (
  id                uuid primary key default gen_random_uuid(),
  caso_id           uuid not null references casos(id) on delete cascade,
  ordem             int not null,
  descricao         text not null,
  responsavel       text,
  data_limite       date,
  evidencia_esperada text,
  concluida         boolean not null default false,
  unique (caso_id, ordem)
);

-- Classificação administrativa: domínio separado da jornada
create table classificacoes_admin (
  id        uuid primary key default gen_random_uuid(),
  caso_id   uuid not null references casos(id) on delete cascade,
  acao      acao_admin_t not null,
  admin_id  uuid not null references perfis(id),
  criado_em timestamptz not null default now()
);

create table auditoria (
  id        bigserial primary key,
  organizacao_id uuid not null default '00000000-0000-0000-0000-0000000000a3',
  ator_id   uuid references perfis(id),
  acao      text not null,
  alvo      text,
  detalhe   jsonb,
  criado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. FUNÇÕES DE APOIO (usadas pelo RLS)
-- ------------------------------------------------------------
create or replace function minha_org() returns uuid
language sql stable security definer set search_path = public as $$
  select organizacao_id from perfis where id = auth.uid()
$$;

create or replace function meu_papel() returns papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid() and ativo
$$;

create or replace function meus_clientes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cliente_id from perfis_clientes where perfil_id = auth.uid()
$$;

-- Expiração: aplicada pelo servidor, nunca pelo cliente (regra §1)
create or replace function expirar_casos() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update casos
     set estado = 'expirado'
   where estado = 'aguardando_resultado'
     and deadline_at is not null
     and now() > deadline_at;
  get diagnostics n = row_count;
  return n;
end $$;
-- Agende em Supabase: select cron.schedule('expirar','*/15 * * * *','select expirar_casos()');

-- Confirmação do plano dispara o relógio no servidor
create or replace function confirmar_plano(p_caso uuid) returns casos
language plpgsql security definer set search_path = public as $$
declare c casos; sla int;
begin
  select o.sla_horas into sla
    from casos k join organizacoes o on o.id = k.organizacao_id
   where k.id = p_caso;

  update casos
     set estado = 'aguardando_resultado',
         started_at = now(),
         deadline_at = now() + (sla || ' hours')::interval
   where id = p_caso
     and autor_id = auth.uid()
     and estado = 'plano'          -- transição válida apenas a partir de 'plano'
  returning * into c;

  if c.id is null then
    raise exception 'Transição inválida para o caso %', p_caso using errcode = '23514';
  end if;
  return c;
end $$;

-- Registro do desfecho pelo decisor
create or replace function registrar_resultado(p_caso uuid, p_estado estado_caso) returns casos
language plpgsql security definer set search_path = public as $$
declare c casos;
begin
  if p_estado not in ('resolvido','nao_resolvido','aberto') then
    raise exception 'Desfecho inválido';
  end if;

  update casos
     set estado = p_estado,
         resultado_em = now()
   where id = p_caso
     and autor_id = auth.uid()
     and (
       estado = 'aguardando_resultado' and now() <= deadline_at   -- dentro do prazo
       or estado = 'aberto'                                       -- aberta responde a qualquer momento
     )
  returning * into c;

  if c.id is null then
    raise exception 'Caso fora do prazo ou em estado inválido' using errcode = '23514';
  end if;
  return c;
end $$;

-- ------------------------------------------------------------
-- 7. RLS — o isolamento mora aqui, não na tela
-- ------------------------------------------------------------
alter table organizacoes        enable row level security;
alter table clientes            enable row level security;
alter table equipes             enable row level security;
alter table perfis              enable row level security;
alter table perfis_clientes     enable row level security;
alter table casos               enable row level security;
alter table acoes               enable row level security;
alter table classificacoes_admin enable row level security;
alter table auditoria           enable row level security;
alter table principios          enable row level security;

-- Princípios: leitura livre para autenticados
create policy p_principios_read on principios for select to authenticated using (true);

-- Estrutura: visível dentro da organização
create policy p_org_read      on organizacoes for select to authenticated
  using (id = minha_org());
create policy p_clientes_read on clientes     for select to authenticated
  using (organizacao_id = minha_org());
create policy p_equipes_read  on equipes      for select to authenticated
  using (organizacao_id = minha_org());

-- Só admin altera estrutura
create policy p_clientes_admin on clientes for all to authenticated
  using (organizacao_id = minha_org() and meu_papel() = 'admin')
  with check (organizacao_id = minha_org() and meu_papel() = 'admin');
create policy p_equipes_admin on equipes for all to authenticated
  using (organizacao_id = minha_org() and meu_papel() = 'admin')
  with check (organizacao_id = minha_org() and meu_papel() = 'admin');

-- Perfis: eu vejo a mim; gestor vê quem compartilha cliente; admin vê a organização
create policy p_perfis_read on perfis for select to authenticated using (
  id = auth.uid()
  or (organizacao_id = minha_org() and meu_papel() = 'admin')
  or (organizacao_id = minha_org() and meu_papel() = 'gestor'
      and exists (select 1 from perfis_clientes pc
                   where pc.perfil_id = perfis.id
                     and pc.cliente_id in (select meus_clientes())))
);
create policy p_perfis_admin on perfis for all to authenticated
  using (organizacao_id = minha_org() and meu_papel() = 'admin')
  with check (organizacao_id = minha_org() and meu_papel() = 'admin');

create policy p_pc_read on perfis_clientes for select to authenticated
  using (perfil_id = auth.uid() or meu_papel() in ('admin','gestor'));
create policy p_pc_admin on perfis_clientes for all to authenticated
  using (meu_papel() = 'admin') with check (meu_papel() = 'admin');

-- CASOS — a política central
create policy p_casos_read on casos for select to authenticated using (
  organizacao_id = minha_org() and (
    autor_id = auth.uid()                                         -- decisor: só os próprios
    or meu_papel() = 'admin'                                      -- admin: toda a organização
    or (meu_papel() = 'gestor' and cliente_id in (select meus_clientes()))
  )
);

-- Criação: só o próprio autor, e apenas em cliente ao qual está vinculado
create policy p_casos_insert on casos for insert to authenticated with check (
  organizacao_id = minha_org()
  and autor_id = auth.uid()
  and (cliente_id is null or cliente_id in (select meus_clientes()))
);

-- Atualização: apenas o autor, apenas antes do desfecho.
-- Estados terminais e o relógio são gravados pelas funções acima (security definer).
create policy p_casos_update on casos for update to authenticated
  using (
    autor_id = auth.uid()
    and estado in ('relato','entendimento','plano')
  )
  with check (
    autor_id = auth.uid()
    and estado in ('relato','entendimento','plano')
  );

-- Sem policy de DELETE: nada é apagado, nunca (regra §5)

create policy p_acoes_read on acoes for select to authenticated using (
  exists (select 1 from casos k where k.id = acoes.caso_id)   -- herda o RLS de casos
);
create policy p_acoes_insert on acoes for insert to authenticated with check (
  exists (select 1 from casos k where k.id = acoes.caso_id and k.autor_id = auth.uid())
);

-- Classificação: leitura por quem enxerga o caso; escrita só por gestor/admin
create policy p_class_read on classificacoes_admin for select to authenticated using (
  exists (select 1 from casos k where k.id = classificacoes_admin.caso_id)
);
create policy p_class_insert on classificacoes_admin for insert to authenticated with check (
  admin_id = auth.uid()
  and meu_papel() in ('admin','gestor')
  and exists (select 1 from casos k where k.id = caso_id)
);

create policy p_auditoria_read on auditoria for select to authenticated
  using (organizacao_id = minha_org() and meu_papel() = 'admin');
create policy p_auditoria_insert on auditoria for insert to authenticated
  with check (organizacao_id = minha_org());

-- ------------------------------------------------------------
-- 8. VISÃO DE INDICADORES (descartados fora — regra §6)
-- ------------------------------------------------------------
create or replace view casos_mensuraveis as
select k.*
  from casos k
 where k.arquivado = false
   and not exists (
     select 1 from classificacoes_admin ca
      where ca.caso_id = k.id and ca.acao = 'descartar'
   );

-- ------------------------------------------------------------
-- 9. SEED DA A3 (ajuste os nomes antes de rodar)
-- ------------------------------------------------------------
insert into equipes (nome) values ('Operação'), ('Manutenção'), ('Administrativo');
insert into clientes (nome) values
  ('Wonder Cidade Jardim'), ('Mirante Flamboyant'),
  ('Grand Splendor'), ('Vision Colinas');

-- Após criar o primeiro usuário no Supabase Auth, promova-o a admin:
-- insert into perfis (id, nome, papel) values ('<uuid-do-auth-user>', 'Rodrigo', 'admin');
