-- ===========================================================================
-- La Dcouverte — schéma Supabase
-- À copier-coller dans Supabase > SQL Editor > New query > Run
-- ===========================================================================

-- 1. Contenu du site (une seule ligne, éditée depuis l'admin) -------------
create table if not exists site_content (
  id          int primary key default 1,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint site_content_singleton check (id = 1)
);

insert into site_content (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;

alter table site_content enable row level security;

-- Tout le monde peut lire le contenu du site
drop policy if exists "lecture publique du contenu" on site_content;
create policy "lecture publique du contenu"
  on site_content for select using (true);

-- Seuls les comptes connectés (la rédaction) peuvent modifier
drop policy if exists "modification par la redaction" on site_content;
create policy "modification par la redaction"
  on site_content for update to authenticated using (true) with check (true);


-- 2. Sujets du blog / FAQ ------------------------------------------------
create table if not exists forum_questions (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'Question',
  author      text not null default 'Anonyme',
  title       text not null,
  body        text not null default '',
  status      text not null default 'published',  -- published | pending | hidden
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table forum_questions enable row level security;

-- Les visiteurs voient les sujets publiés ; la rédaction voit tout
drop policy if exists "lecture des sujets publies" on forum_questions;
create policy "lecture des sujets publies"
  on forum_questions for select using (status = 'published' or auth.role() = 'authenticated');

-- Les visiteurs peuvent poser une question
drop policy if exists "creation de sujet par les visiteurs" on forum_questions;
create policy "creation de sujet par les visiteurs"
  on forum_questions for insert with check (
    char_length(title) between 3 and 140 and char_length(body) <= 2000
  );

-- Modération réservée à la rédaction
drop policy if exists "moderation des sujets" on forum_questions;
create policy "moderation des sujets"
  on forum_questions for update to authenticated using (true) with check (true);

drop policy if exists "suppression des sujets" on forum_questions;
create policy "suppression des sujets"
  on forum_questions for delete to authenticated using (true);


-- 3. Réponses ------------------------------------------------------------
create table if not exists forum_replies (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references forum_questions(id) on delete cascade,
  author       text not null default 'Anonyme',
  body         text not null,
  is_team      boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table forum_replies enable row level security;

drop policy if exists "lecture publique des reponses" on forum_replies;
create policy "lecture publique des reponses"
  on forum_replies for select using (true);

-- Un visiteur peut répondre, mais pas se faire passer pour la rédaction
drop policy if exists "reponse des visiteurs" on forum_replies;
create policy "reponse des visiteurs"
  on forum_replies for insert with check (
    is_team = false and char_length(body) between 1 and 1200
  );

drop policy if exists "reponse de la redaction" on forum_replies;
create policy "reponse de la redaction"
  on forum_replies for insert to authenticated with check (true);

drop policy if exists "suppression des reponses" on forum_replies;
create policy "suppression des reponses"
  on forum_replies for delete to authenticated using (true);

create index if not exists forum_replies_question_idx on forum_replies (question_id);
create index if not exists forum_questions_order_idx on forum_questions (pinned desc, created_at desc);

-- ===========================================================================
-- Ensuite :
--   1. Authentication > Users > Add user : crée le compte de la rédaction
--      (email + mot de passe). C'est avec ça que tu te connecteras à /admin.
--   2. Project Settings > API : copie "Project URL" et la clé "anon public"
--      dans assets/js/config.js.
--   3. Ouvre admin.html, connecte-toi, puis Sauvegarde > Importer ton JSON
--      (ou modifie directement : le premier enregistrement remplira la base).
-- ===========================================================================
