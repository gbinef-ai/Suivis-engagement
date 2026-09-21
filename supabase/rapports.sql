-- ---------------------------------------------------------------------------
-- Suivi des engagements — Groupe Toguna
-- Envoi hebdomadaire des échéances à moins d'un mois (livrable 3).
--
-- À exécuter après schema.sql. Idempotent : peut être relancé sans dommage.
--
-- Ce que ce fichier met en place :
--   1. les extensions pg_cron (planification) et pg_net (appel HTTP) ;
--   2. la table des destinataires, gérée depuis l'application ;
--   3. le journal des envois et les réglages (seuil en jours) ;
--   4. la tâche planifiée : chaque lundi à 07:00 UTC — l'heure de Bamako —
--      elle appelle la fonction Edge « envoi-hebdo », qui compose et envoie
--      les e-mails.
--
-- Le secret partagé entre la tâche et la fonction est stocké dans Vault sous
-- le nom cron_secret. Il est posé par le script d'installation, jamais écrit
-- ici : ce fichier est versionné.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;
grant usage on schema cron to postgres;

-- ===========================================================================
-- 1. Destinataires
--    entite NULL  : reçoit la situation de tout le Groupe (direction) ;
--    entite 'TMO' : reçoit seulement les lignes de cette entité (comptable).
-- ===========================================================================

create table if not exists public.destinataires (
  id      uuid primary key default gen_random_uuid(),
  email   text not null unique check (email = lower(email)),
  nom     text not null default '',
  entite  text,
  actif   boolean not null default true,
  cree    timestamptz not null default now()
);
alter table public.destinataires enable row level security;

drop policy if exists dest_admin on public.destinataires;
create policy dest_admin on public.destinataires for all to authenticated
using (public.est_tresorier(auth.uid()))
with check (public.est_tresorier(auth.uid()));

-- ===========================================================================
-- 2. Réglages et journal des envois
-- ===========================================================================

create table if not exists public.reglages_envoi (
  id               int primary key default 1 check (id = 1),
  seuil_jours      int not null default 30 check (seuil_jours between 1 and 120),
  inclure_retards  boolean not null default true,
  maj              timestamptz not null default now()
);
insert into public.reglages_envoi (id) values (1) on conflict (id) do nothing;
alter table public.reglages_envoi enable row level security;

drop policy if exists reg_lire on public.reglages_envoi;
create policy reg_lire on public.reglages_envoi for select to authenticated using (true);
drop policy if exists reg_admin on public.reglages_envoi;
create policy reg_admin on public.reglages_envoi for update to authenticated
using (public.est_tresorier(auth.uid())) with check (public.est_tresorier(auth.uid()));

create table if not exists public.envois (
  id             bigserial primary key,
  quand          timestamptz not null default now(),
  declencheur    text not null,          -- cron | manuel
  statut         text not null,          -- envoye | partiel | vide | non_configure | echec
  destinataires  int not null default 0,
  lignes         int not null default 0,
  montant        numeric not null default 0,
  detail         text
);
alter table public.envois enable row level security;

drop policy if exists env_lire on public.envois;
create policy env_lire on public.envois for select to authenticated
using (public.est_tresorier(auth.uid()));

-- ===========================================================================
-- 3. Tâche planifiée
--    cron.schedule() avec un nom existant met la tâche à jour : relancer ce
--    fichier ne crée pas de doublon.
-- ===========================================================================

select cron.schedule(
  'envoi-hebdo-engagements',
  '0 7 * * 1',
  $job$
  select net.http_post(
    url     := 'https://iuudwexaqkkmgoyhihdc.supabase.co/functions/v1/envoi-hebdo',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body    := '{"declencheur":"cron"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
