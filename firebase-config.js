// ---------------------------------------------------------------------------
// Configuration Firebase — Groupe Toguna
// Remplacez les valeurs ci-dessous par celles affichées dans la console
// Firebase : Paramètres du projet > Vos applications > application web.
// Ces valeurs sont publiques par conception ; la sécurité vient des règles
// Firestore (firestore.rules) et de l'authentification Google.
// ---------------------------------------------------------------------------

export const firebaseConfig = {
  apiKey:            "A_REMPLACER",
  authDomain:        "A_REMPLACER.firebaseapp.com",
  projectId:         "A_REMPLACER",
  storageBucket:     "A_REMPLACER.firebasestorage.app",
  messagingSenderId: "A_REMPLACER",
  appId:             "A_REMPLACER"
};

// Adresses e-mail des administrateurs de l'application : elles seules
// peuvent modifier les habilitations et restaurer une sauvegarde.
// Ces mêmes adresses doivent figurer dans utilisateurs() de firestore.rules.
export const ADMINS = [
  "adresse.tresorier@exemple.com"
];
