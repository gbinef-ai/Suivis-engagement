# Installation et déploiement — Engagements & trésorerie

Application de suivi des engagements du Groupe Toguna, sur Firebase Hosting et Cloud Firestore.
Durée totale : environ une heure, dont une quarantaine de minutes d'attente et d'installation.

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html` | L'application complète. Ne rien y modifier. |
| `firebase-config.js` | **À remplir** : les identifiants de votre projet Firebase. |
| `firestore.rules` | **À remplir** : les adresses e-mail autorisées. |
| `firebase.json` | Paramètres d'hébergement. À laisser tel quel. |
| `.firebaserc` | **À remplir** : l'identifiant de votre projet. |
| `donnees/engagements-toguna.json` | Vos 246 engagements, référentiels et taux. |
| `outils/import-firestore.mjs` | Script d'import des données. |

---

## Étape 1 — Remplir la configuration

Dans la console Firebase : **Paramètres du projet** → section **Vos applications** → votre application web.
Copiez les valeurs du bloc `firebaseConfig` affiché et reportez-les dans `firebase-config.js`, à la place des `A_REMPLACER`.

Dans le même fichier, renseignez votre adresse e-mail dans `ADMINS`.

Ouvrez ensuite `.firebaserc` et remplacez `A_REMPLACER_PAR_VOTRE_PROJECT_ID` par la valeur de `projectId`.

## Étape 2 — Déclarer les personnes autorisées

Ouvrez `firestore.rules` et remplissez deux listes :

- `utilisateurs()` — toutes les adresses e-mail qui peuvent ouvrir l'application, la vôtre et celles de vos deux collaborateurs ;
- `administrateurs()` — celles qui peuvent modifier les habilitations et restaurer une sauvegarde, en principe la vôtre seule.

Les adresses doivent être en minuscules et correspondre exactement aux comptes Google utilisés pour se connecter.

Pour ajouter quelqu'un plus tard : ajoutez son adresse dans `utilisateurs()`, puis relancez `firebase deploy --only firestore:rules`.

## Étape 3 — Installer les outils

Installez Node.js depuis `nodejs.org` (version LTS), puis, dans un terminal :

```
npm install -g firebase-tools
firebase login
```

La commande `firebase login` ouvre le navigateur : connectez-vous avec le compte Google propriétaire du projet.

## Étape 4 — Importer les 246 engagements

Dans la console Firebase : **Paramètres du projet** → onglet **Comptes de service** → **Générer une nouvelle clé privée**. Un fichier JSON se télécharge.

Renommez-le `cle-service.json` et placez-le dans le dossier `outils/`, puis :

```
cd outils
npm install
node import-firestore.mjs
```

Le script affiche chaque période importée avec son nombre de lignes et son montant, et se termine sur le total : **246 engagements, 207 060 412 249 FCFA**. Vérifiez dans la console, section **Firestore Database**, que la collection `engagements` contient bien 28 documents.

> **Important** : `cle-service.json` donne un accès complet à votre base. Ne le mettez jamais en ligne, ne l'envoyez à personne, et supprimez-le après l'import.

## Étape 5 — Déployer

Revenez à la racine du dossier, puis :

```
firebase deploy
```

La commande publie l'application et les règles de sécurité. Elle affiche à la fin l'adresse de votre application, de la forme `https://votre-projet.web.app`.

Pour ne déployer que les règles après une modification : `firebase deploy --only firestore:rules`.
Pour ne déployer que l'application : `firebase deploy --only hosting`.

## Étape 6 — Vérifier

1. Ouvrez l'adresse affichée. L'écran de connexion apparaît avec le logo du Groupe.
2. Connectez-vous avec votre compte Google. Le tableau de bord doit s'afficher avec vos encours.
3. Vérifiez l'onglet Échéancier : 149 lignes vivantes.
4. Vérifiez l'onglet En instance : 39 dossiers, dont 20 en négociation fournisseur.
5. Vérifiez l'onglet Historique : 97 engagements soldés.
6. Faites saisir un règlement à un collaborateur, puis vérifiez qu'il apparaît à votre écran et dans le Journal.

Si la connexion est refusée avec un message de permissions, c'est presque toujours une adresse absente de `utilisateurs()` dans `firestore.rules`, ou une casse différente.

---

## Nom de domaine du Groupe

Pour une adresse du type `engagements.groupetoguna.com` : console Firebase → **Hosting** → **Ajouter un domaine personnalisé**. Firebase indique alors deux enregistrements DNS à créer chez votre hébergeur de domaine, et fournit le certificat HTTPS automatiquement.

## Coût

Le plan gratuit Spark suffit : 10 Go d'hébergement, 360 Mo de transfert par jour, 1 Gio de données, 50 000 lectures et 20 000 écritures par jour, authentification gratuite. À trois utilisateurs, une ouverture de l'application consomme une trentaine de lectures ; vous resterez très en deçà des plafonds. Aucun moyen de paiement n'est demandé.

## Sauvegardes

Le plan gratuit ne comprend pas de sauvegarde automatique. Conservez le rythme prévu : chaque semaine, onglet **Référentiels** → **Télécharger la sauvegarde**, et rangez le fichier hors de l'application. C'est aussi lui qui permettrait de reconstruire la base ailleurs en cas de besoin.

## Mises à jour

Pour toute évolution de l'application, il suffira de remplacer `index.html` et de relancer `firebase deploy --only hosting`. Les données ne sont pas touchées.
