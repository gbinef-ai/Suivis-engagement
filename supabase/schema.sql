-- ---------------------------------------------------------------------------
-- Suivi des engagements — Groupe Toguna
-- Schéma, droits et compte administrateur.
--
-- À exécuter une seule fois, dans Supabase : SQL Editor > New query,
-- coller tout ce fichier, puis Run.
--
-- Ce fichier crée le compte administrateur avec son mot de passe initial.
-- Il s'exécute côté serveur, avec le rôle de service : le mot de passe
-- n'apparaît jamais dans le code de l'application.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- ===========================================================================
-- 1. Données de l'application
--    Un document par ligne, contenu en jsonb : la même forme que celle
--    attendue par l'application (engagements/<periode>, referentiels/<cle>,
--    journal/<periode>), pour ne rien changer à sa logique de calcul.
-- ===========================================================================

create table if not exists public.engagements (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  maj         timestamptz not null default now(),
  maj_par     uuid references auth.users(id)
);

create table if not exists public.referentiels (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  maj         timestamptz not null default now(),
  maj_par     uuid references auth.users(id)
);

create table if not exists public.journal (
  id          text primary key,
  data        jsonb not null default '{}'::jsonb,
  maj         timestamptz not null default now()
);

-- ===========================================================================
-- 2. Utilisateurs, rôles et exceptions par module
-- ===========================================================================

do $$ begin
  create type public.role_app as enum ('tresorier','gestionnaire','lecture');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.niveau_droit as enum ('aucun','lecture','ecriture');
exception when duplicate_object then null; end $$;

create table if not exists public.profils (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null unique,
  nom               text not null default '',
  role              public.role_app not null default 'lecture',
  actif             boolean not null default true,
  doit_changer_mdp  boolean not null default true,
  vu                timestamptz,
  cree              timestamptz not null default now()
);

-- Exceptions : une ligne seulement quand le droit s'écarte du rôle.
create table if not exists public.droits (
  profil_id   uuid not null references public.profils(id) on delete cascade,
  module      text not null,
  niveau      public.niveau_droit not null,
  primary key (profil_id, module)
);

-- ===========================================================================
-- 3. Droits par défaut de chaque rôle
--    tresorier    : écriture partout
--    gestionnaire : saisie et règlements, consultation du reste
--    lecture      : consultation, sans les modules de paramétrage
-- ===========================================================================

create or replace function public.droit_du_role(r public.role_app, m text)
returns public.niveau_droit
language sql immutable as $$
  select case
    when r = 'tresorier' then 'ecriture'::public.niveau_droit
    when r = 'gestionnaire' then case
      when m in ('echeancier','dossiers','instance','nouveau','import')
        then 'ecriture'::public.niveau_droit
      when m in ('dashboard','historique','controles','referentiels','journal')
        then 'lecture'::public.niveau_droit
      else 'aucun'::public.niveau_droit end
    when r = 'lecture' then case
      when m in ('dashboard','echeancier','dossiers','instance','historique','controles','journal')
        then 'lecture'::public.niveau_droit
      else 'aucun'::public.niveau_droit end
    else 'aucun'::public.niveau_droit
  end;
$$;

-- Droit effectif : l'exception si elle existe, sinon le droit du rôle.
-- security definer pour que la fonction puisse lire profils et droits
-- sans être bloquée par les politiques qui l'appellent.
create or replace function public.droit_effectif(u uuid, m text)
returns public.niveau_droit
language plpgsql stable security definer set search_path = public as $$
declare
  p public.profils;
  e public.niveau_droit;
begin
  select * into p from public.profils where id = u;
  if p.id is null or not p.actif then return 'aucun'; end if;
  select niveau into e from public.droits where profil_id = u and module = m;
  if e is not null then return e; end if;
  return public.droit_du_role(p.role, m);
end $$;

create or replace function public.peut_lire(u uuid, m text)
returns boolean language sql stable as $$
  select public.droit_effectif(u, m) in ('lecture','ecriture');
$$;

create or replace function public.peut_ecrire(u uuid, m text)
returns boolean language sql stable as $$
  select public.droit_effectif(u, m) = 'ecriture';
$$;

create or replace function public.est_tresorier(u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profils
                 where id = u and actif and role = 'tresorier');
$$;

-- ===========================================================================
-- 4. Row Level Security
--
--    Limite à connaître : les engagements alimentent plusieurs modules à la
--    fois, donc le serveur ne peut pas distinguer plus finement que la table.
--    La lecture est ouverte à qui peut consulter l'un des modules qui les
--    affichent ; l'écriture, à qui peut saisir dans l'un de ceux qui les
--    modifient. Le cloisonnement module par module de la navigation reste,
--    lui, une commodité d'interface.
-- ===========================================================================

alter table public.engagements  enable row level security;
alter table public.referentiels enable row level security;
alter table public.journal      enable row level security;
alter table public.profils      enable row level security;
alter table public.droits       enable row level security;

-- Engagements
drop policy if exists eng_lire on public.engagements;
create policy eng_lire on public.engagements for select to authenticated
using (
  public.peut_lire(auth.uid(),'echeancier') or public.peut_lire(auth.uid(),'dossiers')
  or public.peut_lire(auth.uid(),'historique') or public.peut_lire(auth.uid(),'instance')
  or public.peut_lire(auth.uid(),'dashboard')
);

drop policy if exists eng_ecrire on public.engagements;
create policy eng_ecrire on public.engagements for all to authenticated
using (
  public.peut_ecrire(auth.uid(),'echeancier') or public.peut_ecrire(auth.uid(),'nouveau')
  or public.peut_ecrire(auth.uid(),'import')
)
with check (
  public.peut_ecrire(auth.uid(),'echeancier') or public.peut_ecrire(auth.uid(),'nouveau')
  or public.peut_ecrire(auth.uid(),'import')
);

-- Référentiels : tout le monde doit pouvoir les lire, l'application en a
-- besoin pour afficher les listes et convertir les devises.
drop policy if exists ref_lire on public.referentiels;
create policy ref_lire on public.referentiels for select to authenticated
using (true);

drop policy if exists ref_ecrire on public.referentiels;
create policy ref_ecrire on public.referentiels for all to authenticated
using (public.peut_ecrire(auth.uid(),'referentiels'))
with check (public.peut_ecrire(auth.uid(),'referentiels'));

-- Journal : consultable selon le module, mais toute personne qui écrit doit
-- pouvoir y ajouter sa trace, sinon l'audit aurait des trous.
drop policy if exists jou_lire on public.journal;
create policy jou_lire on public.journal for select to authenticated
using (public.peut_lire(auth.uid(),'journal'));

drop policy if exists jou_ecrire on public.journal;
create policy jou_ecrire on public.journal for all to authenticated
using (true) with check (true);

-- Profils : chacun voit le sien ; le trésorier voit et modifie tout.
drop policy if exists pro_lire on public.profils;
create policy pro_lire on public.profils for select to authenticated
using (id = auth.uid() or public.est_tresorier(auth.uid()));

drop policy if exists pro_maj_soi on public.profils;
create policy pro_maj_soi on public.profils for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profils where id = auth.uid()));

drop policy if exists pro_admin on public.profils;
create policy pro_admin on public.profils for all to authenticated
using (public.est_tresorier(auth.uid()))
with check (public.est_tresorier(auth.uid()));

-- Exceptions de droits : le trésorier seul.
drop policy if exists dro_lire on public.droits;
create policy dro_lire on public.droits for select to authenticated
using (profil_id = auth.uid() or public.est_tresorier(auth.uid()));

drop policy if exists dro_admin on public.droits;
create policy dro_admin on public.droits for all to authenticated
using (public.est_tresorier(auth.uid()))
with check (public.est_tresorier(auth.uid()));

-- ===========================================================================
-- 5. Création automatique du profil à l'inscription
-- ===========================================================================

-- Un compte créé depuis l'écran de connexion arrive inactif et en
-- consultation seule : il ne donne accès à rien avant que le trésorier ne
-- l'active. C'est ce qui permet de laisser l'inscription ouverte sans
-- ouvrir les données.
create or replace function public.creer_profil()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin boolean := lower(new.email) = 'binef@groupetoguna.com';
begin
  insert into public.profils (id, email, nom, role, actif, doit_changer_mdp)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'nom',''),
    case when admin then 'tresorier'::public.role_app
                    else 'lecture'::public.role_app end,
    admin,   -- seul l'administrateur est actif d'emblée
    admin    -- lui seul a un mot de passe imposé à changer
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_creer_profil on auth.users;
create trigger trg_creer_profil after insert on auth.users
for each row execute function public.creer_profil();

-- ===========================================================================
-- 6. Compte administrateur
--    binef@groupetoguna.com, mot de passe initial Toguna2010.
--    doit_changer_mdp reste à true : l'application impose le changement
--    avant de donner accès aux données.
-- ===========================================================================

do $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = 'binef@groupetoguna.com';

  if uid is null then
    uid := gen_random_uuid();
    -- Les colonnes de jetons doivent valoir la chaîne vide et non NULL :
    -- le service d'authentification refuse sinon de lire le compte, avec
    -- l'erreur « Database error querying schema ».
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'binef@groupetoguna.com', crypt('Toguna2010', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"nom":"Administrateur"}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text, 'email',
      json_build_object('sub', uid::text, 'email', 'binef@groupetoguna.com',
                        'email_verified', true)::jsonb,
      now(), now(), now()
    );
  end if;

  -- Réparation, au cas où le compte aurait déjà été créé avec des jetons NULL.
  update auth.users set
    confirmation_token         = coalesce(confirmation_token, ''),
    recovery_token             = coalesce(recovery_token, ''),
    email_change               = coalesce(email_change, ''),
    email_change_token_new     = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change               = coalesce(phone_change, ''),
    phone_change_token         = coalesce(phone_change_token, ''),
    reauthentication_token     = coalesce(reauthentication_token, '')
  where id = uid;

  insert into public.profils (id, email, nom, role, actif, doit_changer_mdp)
  values (uid, 'binef@groupetoguna.com', 'Administrateur', 'tresorier', true, true)
  on conflict (id) do update
    set role = 'tresorier', actif = true;
end $$;

-- ===========================================================================
-- 7. Diffusion en temps réel, pour que les saisies apparaissent
--    immédiatement chez les autres utilisateurs
-- ===========================================================================

do $$ begin
  alter publication supabase_realtime add table public.engagements;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.journal;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.referentiels;
exception when duplicate_object then null; end $$;
