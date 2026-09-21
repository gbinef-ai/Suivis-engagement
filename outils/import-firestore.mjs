/* ---------------------------------------------------------------------------
   Import des engagements dans Firestore — Groupe Toguna

   Prérequis
     1. Console Firebase > Paramètres du projet > Comptes de service
        > "Générer une nouvelle clé privée" : téléchargez le fichier JSON
        et placez-le ici sous le nom cle-service.json
     2. Dans ce dossier :  npm install
     3. Puis :             node import-firestore.mjs

   Le script écrit les collections engagements et referentiels.
   Il est idempotent : relancé, il réécrit les mêmes documents.
--------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const CLE      = "./cle-service.json";
const DONNEES  = "../donnees/engagements-toguna.json";

const cle  = JSON.parse(readFileSync(CLE, "utf8"));
const snap = JSON.parse(readFileSync(DONNEES, "utf8"));

initializeApp({ credential: cert(cle) });
const db = getFirestore();

const eng = snap.engagements || {};
const ids = Object.keys(eng);
let lignes = 0, total = 0;

console.log(`Projet   : ${cle.project_id}`);
console.log(`Source   : ${DONNEES} (généré le ${snap.genere})`);
console.log(`Contenu  : ${ids.length} périodes, ${snap.resume?.lignes ?? "?"} engagements\n`);

for (const id of ids) {
  const doc = eng[id];
  await db.collection("engagements").doc(id).set(doc);
  const n = Object.keys(doc.items || {}).length;
  const m = Object.values(doc.items || {}).reduce((s, e) => s + (Number(e.montantXof) || 0), 0);
  lignes += n; total += m;
  console.log(`  ${id.padEnd(14)} ${String(n).padStart(3)} lignes  ${m.toLocaleString("fr-FR").padStart(16)} FCFA`);
}

if (snap.referentiels) {
  await db.collection("referentiels").doc("listes").set({ listes: snap.referentiels.listes });
  await db.collection("referentiels").doc("taux").set({
    taux:   snap.referentiels.taux   || [],
    params: snap.referentiels.params || {}
  });
  console.log("\n  referentiels/listes et referentiels/taux écrits");
}

console.log(`\nTerminé : ${lignes} engagements, ${total.toLocaleString("fr-FR")} FCFA.`);
console.log("Vérifiez dans la console Firebase > Firestore Database.");
process.exit(0);
