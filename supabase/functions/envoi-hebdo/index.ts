// ---------------------------------------------------------------------------
// Suivi des engagements — Groupe Toguna
// Fonction Edge « envoi-hebdo » : situation des échéances à moins d'un mois.
//
// Appelée de deux façons :
//   - par la tâche pg_cron du lundi matin, avec l'en-tête x-cron-secret ;
//   - depuis l'application, par un trésorier connecté (jeton de session),
//     pour un aperçu ({ apercu: true }) ou un envoi immédiat.
//
// Chaque destinataire reçoit sa propre situation : tout le Groupe pour la
// direction, une seule entité pour son comptable.
//
// Variables d'environnement (secrets de la fonction) :
//   CRON_SECRET      secret partagé avec la tâche planifiée
//   RESEND_API_KEY   clé du fournisseur d'e-mail ; absente → rien n'est envoyé
//   EMAIL_FROM       expéditeur, ex. « Trésorerie Groupe Toguna <tresorerie@groupetoguna.com> »
// ---------------------------------------------------------------------------
import { createClient } from "npm:@supabase/supabase-js@2";

type Reglement = { montant?: number | string };
type Engagement = {
  id: string; entite?: string; contrepartie?: string; fournisseur?: string;
  refCredit?: string; objet?: string; rang?: string; dateEcheance?: string;
  devise?: string; montantDevise?: number | string; montantXof?: number | string;
  mode?: string; brouillon?: boolean; reglements?: Reglement[];
};
type Ligne = Engagement & { reste: number; jours: number };
type Destinataire = { email: string; nom: string; entite: string | null; actif: boolean };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, "Content-Type": "application/json" } });

const num = (n: number) => Math.round(n).toLocaleString("fr-FR");
const md = (n: number) => (Math.round(n / 1e6) / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " Md";
const dfr = (iso?: string) => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "—";
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function joursAvant(iso: string): number {
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  return Math.round((new Date(iso + "T00:00:00").getTime() - auj.getTime()) / 86400000);
}
function paye(e: Engagement): number {
  return (e.reglements ?? []).reduce((s, r) => s + (Number(r.montant) || 0), 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "POST attendu" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const corps = await req.json().catch(() => ({})) as { declencheur?: string; apercu?: boolean; entite?: string | null };

  // ---- qui appelle ? ------------------------------------------------------
  let declencheur = "manuel";
  const secret = req.headers.get("x-cron-secret");
  if (secret && Deno.env.get("CRON_SECRET") && secret === Deno.env.get("CRON_SECRET")) {
    declencheur = "cron";
  } else {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ erreur: "Authentification requise" }, 401);
    const { data: { user }, error } = await admin.auth.getUser(jwt);
    if (error || !user) return json({ erreur: "Session invalide" }, 401);
    const { data: p } = await admin.from("profils").select("role, actif").eq("id", user.id).maybeSingle();
    if (!p || !p.actif || p.role !== "tresorier") return json({ erreur: "Réservé au trésorier" }, 403);
  }

  // ---- réglages et données ------------------------------------------------
  const { data: reg } = await admin.from("reglages_envoi").select("*").eq("id", 1).maybeSingle();
  const seuil = reg?.seuil_jours ?? 30;
  const inclureRetards = reg?.inclure_retards ?? true;

  const { data: docs, error: errEng } = await admin.from("engagements").select("id, data");
  if (errEng) return json({ erreur: errEng.message }, 500);

  const lignes: Ligne[] = [];
  for (const d of docs ?? []) {
    const items = (d.data?.items ?? {}) as Record<string, Engagement>;
    for (const [id, e] of Object.entries(items)) {
      if (e.brouillon || !e.dateEcheance) continue;
      const reste = Math.max(0, Math.round((Number(e.montantXof) || 0) - paye(e)));
      if (reste <= 0) continue;
      const jours = joursAvant(e.dateEcheance);
      if (jours > seuil) continue;
      if (jours < 0 && !inclureRetards) continue;
      lignes.push({ ...e, id, reste, jours });
    }
  }
  lignes.sort((a, b) => (a.dateEcheance! < b.dateEcheance! ? -1 : a.dateEcheance! > b.dateEcheance! ? 1 : 0));

  // ---- aperçu : on rend la situation demandée sans rien envoyer ----------
  if (corps.apercu) {
    const filtre = corps.entite ? lignes.filter(l => l.entite === corps.entite) : lignes;
    return new Response(composer(filtre, corps.entite ?? null, seuil), { headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" } });
  }

  // ---- destinataires ------------------------------------------------------
  const { data: dests } = await admin.from("destinataires").select("email, nom, entite, actif").eq("actif", true);
  const actifs = (dests ?? []) as Destinataire[];
  const total = lignes.reduce((s, l) => s + l.reste, 0);

  const journal = async (statut: string, detail: string, n = 0) => {
    await admin.from("envois").insert({ declencheur, statut, destinataires: n, lignes: lignes.length, montant: total, detail });
  };

  if (!actifs.length) { await journal("vide", "Aucun destinataire actif."); return json({ statut: "vide", message: "Aucun destinataire actif." }); }

  const cle = Deno.env.get("RESEND_API_KEY");
  if (!cle) {
    await journal("non_configure", "RESEND_API_KEY absente : fournisseur d'e-mail non configuré.", actifs.length);
    return json({ statut: "non_configure", message: "Fournisseur d'e-mail non configuré : la clé RESEND_API_KEY manque dans les secrets de la fonction." }, 503);
  }
  const from = Deno.env.get("EMAIL_FROM") ?? "Trésorerie Groupe Toguna <onboarding@resend.dev>";

  // ---- envoi, un message par destinataire ---------------------------------
  const resultats: string[] = [];
  let ok = 0;
  for (const d of actifs) {
    const siennes = d.entite ? lignes.filter(l => l.entite === d.entite) : lignes;
    const sujet = `Échéances à moins de ${seuil} jours` + (d.entite ? ` — ${d.entite}` : " — Groupe Toguna")
      + ` · ${siennes.length} ligne${siennes.length > 1 ? "s" : ""}, ${md(siennes.reduce((s, l) => s + l.reste, 0))} FCFA`;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [d.email], subject: sujet, html: composer(siennes, d.entite, seuil) }),
    });
    if (r.ok) { ok++; resultats.push(`${d.email} : envoyé (${siennes.length} lignes)`); }
    else resultats.push(`${d.email} : ÉCHEC ${r.status} ${(await r.text()).slice(0, 160)}`);
  }
  const statut = ok === actifs.length ? "envoye" : ok ? "partiel" : "echec";
  await journal(statut, resultats.join("\n"), ok);
  return json({ statut, envoyes: ok, sur: actifs.length, lignes: lignes.length, detail: resultats }, statut === "echec" ? 502 : 200);
});

// ---------------------------------------------------------------------------
// Le message : lisible sur téléphone, tableau simple, chiffres alignés.
// ---------------------------------------------------------------------------
function composer(lignes: Ligne[], entite: string | null, seuil: number): string {
  const total = lignes.reduce((s, l) => s + l.reste, 0);
  const retards = lignes.filter(l => l.jours < 0);
  const totalRetard = retards.reduce((s, l) => s + l.reste, 0);
  const sept = lignes.filter(l => l.jours >= 0 && l.jours <= 7);
  const auj = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const tuile = (k: string, v: string, s: string, rouge = false) =>
    `<td style="padding:0 6px 0 0;width:25%"><div style="border:1px solid #e3e6e1;border-radius:6px;padding:10px 12px;background:#fff${rouge ? ";border-color:#b3261e;background:#fbeeed" : ""}">
       <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7680">${k}</div>
       <div style="font-size:18px;font-weight:700;margin:3px 0 1px${rouge ? ";color:#b3261e" : ""}">${v}</div>
       <div style="font-size:11px;color:#6b7680">${s}</div></div></td>`;

  const rang = (l: Ligne) => {
    if (l.jours < 0) return `<span style="color:#b3261e;font-weight:700">Retard ${-l.jours} j</span>`;
    if (l.jours === 0) return `<span style="color:#b3261e;font-weight:700">Aujourd'hui</span>`;
    if (l.jours <= 7) return `<span style="color:#9a6700;font-weight:700">J-${l.jours}</span>`;
    return `J-${l.jours}`;
  };
  const td = 'style="padding:6px 8px;border-bottom:1px solid #eceeea;font-size:12px;vertical-align:top"';
  const tdr = 'style="padding:6px 8px;border-bottom:1px solid #eceeea;font-size:12px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums"';
  const th = 'style="padding:7px 8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:#12202f;text-align:left"';
  const thr = th.replace("text-align:left", "text-align:right");

  const rangees = lignes.length ? lignes.map(l => `
    <tr>
      <td ${td}><b>${dfr(l.dateEcheance)}</b><br>${rang(l)}</td>
      ${entite ? "" : `<td ${td}>${esc(l.entite)}</td>`}
      <td ${td}>${esc(l.contrepartie)}</td>
      <td ${td}>${esc(l.fournisseur)}<br><span style="color:#6b7680">${esc(l.refCredit)}${l.rang ? " · tr. " + esc(l.rang) : ""}</span></td>
      <td ${td}>${esc((l.objet ?? "").slice(0, 70))}${(l.objet ?? "").length > 70 ? "…" : ""}<br><span style="color:#6b7680">${esc(l.mode)}</span></td>
      <td ${tdr}>${l.devise && l.devise !== "XOF" ? esc(l.devise) + " " + Number(l.montantDevise || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + "<br>" : ""}<b>${num(l.reste)}</b></td>
    </tr>`).join("")
    : `<tr><td colspan="6" ${td}>Aucune échéance à moins de ${seuil} jours.</td></tr>`;

  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f5f2;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1c2126">
  <div style="max-width:860px;margin:0 auto;padding:18px 12px">
    <div style="background:#12202f;color:#fff;border-radius:8px 8px 0 0;padding:14px 18px">
      <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.75">Groupe Toguna · Trésorerie</div>
      <div style="font-size:18px;font-weight:700;margin-top:2px">Échéances à moins de ${seuil} jours${entite ? " — " + esc(entite) : ""}</div>
      <div style="font-size:12px;opacity:.8;margin-top:2px">Situation au ${auj}. Montants en FCFA, reste à payer.</div>
    </div>
    <div style="background:#fff;border:1px solid #e3e6e1;border-top:0;padding:14px 18px 18px;border-radius:0 0 8px 8px">
      <table role="presentation" style="border-collapse:collapse;width:100%;margin-bottom:14px"><tr>
        ${tuile("À décaisser", md(total), lignes.length + " échéance" + (lignes.length > 1 ? "s" : ""))}
        ${tuile("Sous 7 jours", md(sept.reduce((s, l) => s + l.reste, 0)), sept.length + " échéance" + (sept.length > 1 ? "s" : ""))}
        ${tuile("Déjà en retard", md(totalRetard), retards.length + " échéance" + (retards.length > 1 ? "s" : ""), retards.length > 0)}
        ${tuile("Horizon", seuil + " jours", "jusqu'au " + dfr(new Date(Date.now() + seuil * 86400000).toISOString().slice(0, 10)))}
      </tr></table>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr><th ${th}>Échéance</th>${entite ? "" : `<th ${th}>Entité</th>`}<th ${th}>Banque</th><th ${th}>Fournisseur · réf.</th><th ${th}>Opération</th><th ${thr}>Reste à payer</th></tr></thead>
        <tbody>${rangees}</tbody>
        <tfoot><tr><td colspan="${entite ? 4 : 5}" style="padding:8px;font-weight:700;border-top:2px solid #12202f">TOTAL</td><td style="padding:8px;font-weight:700;text-align:right;border-top:2px solid #12202f;white-space:nowrap">${num(total)}</td></tr></tfoot>
      </table>
      <p style="font-size:11px;color:#6b7680;margin:16px 0 0">Message automatique du suivi des engagements — <a href="https://suivis-engagement.vercel.app" style="color:#0b6b4c">ouvrir l'application</a>. Document interne, usage strictement confidentiel.</p>
    </div>
  </div></body></html>`;
}
