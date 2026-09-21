# Installation et déploiement — Engagements & trésorerie (branche `vercel`)

Application de suivi des engagements du Groupe Toguna, hébergée sur Vercel comme site statique.
Durée du déploiement : quelques minutes, sans installation d'outils sur votre poste.

## Ce que cette branche change

Firebase a été retiré : plus de Cloud Firestore, plus de connexion Google, plus de
`firebase deploy`. L'application fonctionne en **mode autonome** — les données vivent dans le
stockage local du navigateur qui l'ouvre.

**À lire avant de déployer.** Cette architecture a une conséquence directe :

| | Branche `main` (Firebase) | Branche `vercel` |
| --- | --- | --- |
| Hébergement | Firebase Hosting | Vercel |
| Données | Cloud Firestore, partagées | Stockage du navigateur, par poste |
| Accès | Connexion Google, liste d'autorisés | Ouvert à qui a l'adresse |
| Travail à plusieurs | Oui, en temps réel | **Non** |
| Habilitations | Trois rôles appliqués | Tous droits pour chacun |
| Perte de données | Sauvegarde Firestore | Vider le cache du navigateur efface tout |

Autrement dit : chaque personne qui ouvre l'application a sa propre copie des données, et
personne ne voit les saisies des autres. Si les trois collaborateurs doivent partager le même
échéancier, c'est la branche `main` qu'il faut déployer, pas celle-ci.

Cette branche convient pour : une consultation individuelle, une démonstration, un poste de
travail unique, ou une mise en ligne rapide sans configuration.

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html` | L'application complète. Ne rien y modifier. |
| `vercel.json` | Paramètres d'hébergement. À laisser tel quel. |
| `donnees/engagements-toguna.json` | Vos 246 engagements, référentiels et taux. |

## Étape 1 — Déployer

1. Ouvrez [vercel.com](https://vercel.com) et connectez-vous avec votre compte GitHub.
2. **Add New** → **Project**, puis importez le dépôt `gbinef-ai/Suivis-engagement`.
3. Dans **Framework Preset**, laissez **Other**. Ne renseignez ni commande de build ni dossier
   de sortie : le site est déjà statique.
4. Dans les réglages du projet, section **Git**, choisissez `vercel` comme **Production Branch**.
5. **Deploy**.

Vercel affiche à la fin une adresse de la forme `https://suivis-engagement.vercel.app`.

Aucune clé, aucun jeton, aucune variable d'environnement n'est à fournir : l'application
n'appelle aucun service extérieur.

## Étape 2 — Vérifier

1. Ouvrez l'adresse affichée. Le tableau de bord s'affiche directement, sans écran de connexion.
2. Au premier chargement, l'application lit `donnees/engagements-toguna.json` et enregistre son
   contenu dans le navigateur. Le bandeau de gauche indique **mode autonome**.
3. Vérifiez les totaux : **246 engagements, 207 060 412 249 FCFA**.
4. Onglet Échéancier : 149 lignes vivantes.
5. Onglet En instance : 39 dossiers, dont 20 en négociation fournisseur.
6. Onglet Historique : 97 engagements soldés.

Cet amorçage n'a lieu qu'une fois par navigateur. Les modifications que vous saisissez ensuite ne
sont jamais écrasées par le fichier livré, et un engagement supprimé ne réapparaît pas.

## Sauvegardes — le point le plus important

En mode autonome, vider le cache du navigateur, changer de poste ou réinitialiser le profil
efface les données. La sauvegarde est la seule protection.

Chaque semaine, au minimum : onglet **Référentiels** → **Télécharger la sauvegarde**, et rangez le
fichier hors de l'application.

Pour repartir d'une sauvegarde : onglet **Référentiels** → section **Restaurer une sauvegarde**,
collez le contenu du fichier, puis **Restaurer**. La restauration remplace intégralement le
contenu présent.

## Mises à jour

Toute modification poussée sur la branche `vercel` est déployée automatiquement par Vercel.
Les données enregistrées dans les navigateurs ne sont pas touchées.

## Nom de domaine du Groupe

Pour une adresse du type `engagements.groupetoguna.com` : tableau de bord Vercel → projet →
**Settings** → **Domains** → **Add**. Vercel indique l'enregistrement DNS à créer chez votre
hébergeur de domaine et fournit le certificat HTTPS automatiquement.

## Accès

Le site est public : toute personne connaissant l'adresse voit l'application. Elle ne voit
cependant que les données de son propre navigateur, jamais les vôtres — le fichier livré est en
revanche lisible par tous.

Pour restreindre l'accès, deux possibilités côté Vercel : **Settings** → **Deployment
Protection** → **Vercel Authentication**, qui limite l'accès aux membres de votre équipe Vercel,
ou **Password Protection**, sur les offres payantes.

Si le contenu des 246 engagements ne doit pas être exposé publiquement, préférez la branche
`main` et son hébergement Firebase avec connexion Google.

## Coût

Le plan gratuit Hobby de Vercel suffit largement : 100 Go de transfert par mois pour un site de
175 Ko. Aucun moyen de paiement n'est demandé. Ce plan est réservé à un usage non commercial ;
pour un usage professionnel, Vercel demande le plan Pro.
