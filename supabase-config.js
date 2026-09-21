// ---------------------------------------------------------------------------
// Configuration Supabase — Groupe Toguna
//
// Dans Supabase : Project Settings > API.
//   SUPABASE_URL      = « Project URL »
//   SUPABASE_ANON_KEY = clé « anon public »
//
// Ces deux valeurs sont publiques par conception : la clé anon ne donne accès
// qu'à ce que les politiques Row Level Security de supabase/schema.sql
// autorisent, une fois la personne authentifiée. Ne jamais mettre ici la clé
// « service_role », qui contourne toutes ces politiques.
//
// Tant que les valeurs restent à A_REMPLACER, l'application démarre en mode
// autonome : données dans le navigateur, sans authentification ni partage.
// ---------------------------------------------------------------------------

export const SUPABASE_URL      = "https://iuudwexaqkkmgoyhihdc.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1dWR3ZXhhcWtrbWdveWhpaGRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5OTczNDIsImV4cCI6MjEwNTU3MzM0Mn0.4GStXS2u3zafHAH42nHbnuYeY9PFsSw-frSXeSHfwIk";

export const configure = () =>
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
