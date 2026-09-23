# Installation et exploitation — Engagements & trésorerie (branche `vercel`)

Application de suivi des engagements du Groupe Toguna. Site statique hébergé sur Vercel,
données et authentification sur Supabase.

## Architecture

| Élément | Où |
| --- | --- |
| Application | `index.html`, servi par Vercel |
| Comptes et mots de passe | Supabase Auth |
| Engagements, référentiels, journal | Supabase Postgres |
| Droits par module | Table `profils` + table `droits`, appliqués par Row Level Security |

Le partage est rétabli : les trois collaborateurs voient les mêmes données, et une saisie
apparaît chez les autres sans rechargement.

## Contenu du dossier

| Fichier | Rôle |
| --- | --- |
| `index.html` | L'application complète. Ne rien y modifier. |
| `supabase-config.js` | Adresse du projet et clé publique. |
| `supabase/schema.sql` | Tables, droits, politiques de sécurité et compte administrateur. |
| `vercel.json` | Paramètres d'hébergement. À laisser tel quel. |
| `donnees/engagements-toguna.json` | Les 246 engagements d'origine, pour un rechargement. |

## Le compte administrateur

**binef@groupetoguna.com**, rôle trésorier.

Le mot de passe initial est transmis à part, jamais dans ce dépôt : celui-ci est versionné
et son historique conserve tout ce qu'on y écrit, même après correction.

À la première connexion, l'application impose le choix d'un mot de passe personnel avant de
donner accès aux données. Tant que ce changement n'est pas fait, le compte n'ouvre rien.

## Rôles et droits par module

Trois rôles fixent les droits par défaut sur les dix modules. Le trésorier peut ensuite
lever ou retirer un module à une personne précise : c'est l'**exception**, qui remplace le
droit du rôle pour ce module seulement.

| Module | Trésorier | Gestionnaire | Consultation |
| --- | --- | --- | --- |
| Tableau de bord | Saisie | Consultation | Consultation |
| Échéancier | Saisie | Saisie | Consultation |
| Dossiers | Saisie | Saisie | Consultation |
| En instance | Saisie | Saisie | Consultation |
| Historique | Saisie | Consultation | Consultation |
| Nouvel engagement | Saisie | Saisie | Aucun accès |
| Contrôles | Saisie | Consultation | Consultation |
| Reprise Excel | Saisie | Saisie | Aucun accès |
| Référentiels | Saisie | Consultation | Aucun accès |
| Journal | Saisie | Consultation | Consultation |

Un module en « Aucun accès » n'apparaît pas dans la navigation de la personne.

**Où régler cela** : onglet **Référentiels**, encadré *Utilisateurs et habilitations*.
Le bouton **Droits** d'une ligne ouvre la matrice des dix modules pour cette personne.
Votre propre rôle et votre propre activation ne sont pas modifiables, pour éviter de vous
fermer l'accès par mégarde.

### Ce qui est réellement appliqué, et ce qui ne l'est pas

À connaître avant de vous reposer dessus : les engagements alimentent plusieurs modules à
la fois, donc le serveur ne sait pas distinguer plus finement que la table. Row Level
Security applique deux choses de façon inviolable :

- **la lecture** des engagements, ouverte à qui peut consulter l'un des modules qui les affichent ;
- **l'écriture**, réservée à qui peut saisir dans l'Échéancier, Nouvel engagement ou Reprise Excel.

Le fait qu'un onglet disparaisse de la navigation est, lui, une commodité d'interface. Une
personne en consultation ne peut rien modifier — le serveur refuse — mais le cloisonnement
module par module n'est pas une barrière étanche contre quelqu'un de déterminé. Pour une
séparation stricte, il faudrait éclater les engagements en tables distinctes par périmètre.

## Ajouter un collaborateur

1. La personne ouvre l'application et clique **Créer un compte**.
2. Son compte est créé **inactif** et en consultation seule : il n'ouvre rien.
3. Vous l'activez : onglet **Référentiels** → *Utilisateurs et habilitations* → case **Actif**,
   puis choisissez son rôle et, si besoin, ses exceptions.

L'inscription peut donc rester ouverte sans exposer les données : un compte non activé ne
lit rien, la politique de sécurité le refuse au niveau de la base.

Pour retirer l'accès à quelqu'un : décochez **Actif**. La coupure est immédiate côté serveur.

## Réinstaller depuis zéro

1. Créez un projet Supabase, puis **SQL Editor** → **New query** → collez tout
   `supabase/schema.sql` → **Run**. Cela crée les tables, les politiques de sécurité, le
   déclencheur de création de profil et le compte administrateur.
2. Dans **Project Settings → API**, relevez *Project URL* et la clé *anon public*, et
   reportez-les dans `supabase-config.js`.
3. Chargez les 246 engagements : `donnees/engagements-toguna.json` contient les périodes et
   les référentiels, à écrire dans les tables `engagements` et `referentiels` sous la forme
   `{ id, data }` — une ligne par période.
4. Déployez sur Vercel.

`supabase-config.js` ne contient que des valeurs publiques : la clé *anon* n'ouvre que ce
que les politiques autorisent, une fois la personne authentifiée. N'y mettez jamais la clé
*service_role*, qui contourne toute la sécurité.

Si les valeurs restent à `A_REMPLACER`, l'application démarre en mode autonome : données
dans le navigateur, sans authentification ni partage. Le pied du bandeau l'indique.

## Reprise Excel : ce que l'analyse accepte, corrige et signale

Copiez les lignes depuis Excel **en-tête compris** et collez-les dans le module Reprise Excel.

- **Colonnes** : reconnues à leur intitulé (sans accents ni casse), dans n'importe quel ordre.
  Sans en-tête, l'ordre par défaut s'applique : Entité · Banque · Fournisseur · Réf. crédit ·
  Opération · Création · Échéance · Montant devise · Devise · Montant XOF · Mode · Date
  paiement · Montant payé · Reste à payer · % · Statut · Observations. L'écran affiche la
  correspondance retenue.
- **Cellules fusionnées** : une entité, banque, fournisseur ou référence vide reprend la valeur
  de la ligne du dessus, et le dit.
- **Devises** : EUR / € / EURO, USD / $ / DOLLAR, XOF / CFA / FCFA ; à défaut, déduite du rapport
  des montants ou de l'objet, et signalée.
- **Dates** : `jj/mm/aaaa`, `aaaa-mm-jj`, « 15 sept. 2026 », « 15-sept-26 », numéro de série
  Excel. Une échéance illisible met la ligne en attente d'échéance, sans la rejeter.
- **Montants** : formats français, portugais et anglais, devise accolée. Le séparateur décimal
  est celui qui vient en dernier.
- **Contre-valeur** : celle du fichier est **conservée** ; l'écart avec la parité EUR ou les
  bornes USD est signalé. Si elle manque, elle est calculée au taux de référence.
- **Cohérence** : règlement supérieur au montant plafonné ; ligne « soldée » sans règlement
  complétée à l'échéance ; reste du fichier comparé au calcul ; entité ou banque hors
  référentiel signalée.
- **Doublons** : avec l'application et au sein du collage, signalés et **non enregistrés**. On
  peut donc recoller un fichier entier : seules les lignes nouvelles s'ajoutent.
- **Lignes ignorées** : chacune est listée avec son numéro, son motif et un extrait — total,
  en-tête répété, ligne tronquée, libellé de groupe, montant absent, entité introuvable.

Les observations d'analyse sont graduées : ⓘ information (rien à faire), ▲ attention (à
vérifier avant d'enregistrer).

## Livrables : rapports et envoi hebdomadaire

Onglet **Tableau de bord → Rapports**. Trois livrables, calculés sur la situation du jour.

| Livrable | Destinataire | Forme | Contenu |
| --- | --- | --- | --- |
| 1. Analyse croisée | Direction générale | PDF paysage, 5 pages | Les neuf sections du modèle de la Direction Financière et la lecture de l'analyse |
| 2. Situation par entité | Service comptable de chaque entité | Un PDF par entité | Échéancier détaillé, par banque, par fournisseur, échéancier mensuel, attente de BL |
| 3. Échéances à moins d'un mois | Direction et comptables | E-mail, chaque lundi 07:00 | Tableau des échéances à venir sous l'horizon réglé, une situation par destinataire |

**L'échéancier lui-même s'exporte en PDF** (module Échéancier → *Exporter en PDF*) : le
document reprend exactement la vue à l'écran — filtres appliqués rappelés dans le cartouche,
indicateurs, lignes regroupées par mois avec sous-totaux, total général. Filtrer d'abord sur
une entité, une banque ou un statut donne un échéancier ciblé prêt à transmettre.

**Colonnes de l'échéancier** : chaque en-tête porte une poignée à son bord droit ; la glisser
à la souris ajuste la largeur de la colonne (les autres ne bougent pas). Les largeurs sont
mémorisées dans le navigateur ; un double-clic sur une poignée remet tout en automatique. La
case *Commentaires* ajoute une colonne facultative avec son propre filtre.

**Convention des rapports** : les analyses croisées portent sur les engagements échéancés ;
les dossiers sans échéance (en cours d'ouverture, attente de BL) sont présentés à part et
n'entrent pas dans les totaux échéancés. Toutes les répartitions sont calculées sur le reste
à payer.

### L'envoi hebdomadaire

Il s'exécute sur le serveur : une tâche `pg_cron` appelle chaque lundi à 07:00 UTC — l'heure
de Bamako — la fonction Edge `envoi-hebdo`, qui lit les engagements, compose un message par
destinataire et l'envoie. Chaque destinataire reçoit **sa** situation : tout le Groupe pour la
direction, une seule entité pour son comptable. Le tableau est dans le message, lisible sur
téléphone, avec un lien vers l'application.

Depuis l'onglet Rapports, le trésorier gère les destinataires (adresse, nom, périmètre,
actif), l'horizon en jours et l'inclusion des retards, consulte un **aperçu** du message,
déclenche un **envoi immédiat**, et lit le journal des derniers envois.

**Fournisseur d'e-mail.** La fonction envoie par [Resend](https://resend.com). Tant que sa
clé n'est pas renseignée, l'envoi ne part pas : la tentative est journalisée avec le statut
*Fournisseur d'e-mail non configuré*, sans erreur silencieuse. Pour l'activer :

1. Créez un compte Resend, puis dans **Domains** ajoutez `groupetoguna.com` et créez chez
   votre hébergeur DNS les enregistrements indiqués. Sans domaine vérifié, Resend n'accepte
   d'envoyer qu'à l'adresse du titulaire du compte, depuis `onboarding@resend.dev`.
2. Dans **API Keys**, créez une clé.
3. Dans Supabase : **Edge Functions → envoi-hebdo → Secrets**, ajoutez `RESEND_API_KEY` avec
   cette clé, et remplacez `EMAIL_FROM` par l'expéditeur souhaité, par exemple
   `Trésorerie Groupe Toguna <tresorerie@groupetoguna.com>`.

Aucun redéploiement n'est nécessaire : la fonction lit ses secrets à chaque appel.

**Fichiers** : `supabase/rapports.sql` (tables `destinataires`, `reglages_envoi`, `envois`,
tâche planifiée) et `supabase/functions/envoi-hebdo/index.ts` (la fonction). Le secret partagé
entre la tâche et la fonction est dans Vault sous le nom `cron_secret` ; il n'est jamais écrit
dans le dépôt.

## Déploiement

Le projet Vercel est `suivis-engagement`, branche de production `vercel`.
Alias stable : https://suivis-engagement.vercel.app

Une fois le dépôt GitHub connecté à Vercel, tout `git push` sur la branche `vercel`
redéploie. Tant qu'il ne l'est pas, le déploiement se fait en ligne de commande :

```
vercel deploy --prod --yes --scope essaie3
```

## Sauvegardes

Les données vivent maintenant sur Supabase, qui conserve des sauvegardes quotidiennes sur
les sept derniers jours dans l'offre gratuite. Cela ne dispense pas de la sauvegarde
applicative : onglet **Référentiels** → **Télécharger la sauvegarde**, chaque semaine, et
rangez le fichier hors de l'application. C'est elle qui permet de repartir ailleurs.

## Vérification après installation

1. L'adresse ouvre un écran de connexion, pas l'application.
2. Connexion administrateur : le changement de mot de passe est demandé.
3. Après changement : tableau de bord, **246 échéances, 207 060 412 249 FCFA**.
4. Échéancier : 149 lignes vivantes. En instance : 39 dossiers. Historique : 97 soldés.
5. Créez un compte de test, vérifiez qu'il n'ouvre rien avant activation, puis passez-le en
   consultation seule et vérifiez que Nouvel engagement, Reprise Excel et Référentiels
   n'apparaissent pas dans sa navigation.

## Coût

Supabase, offre gratuite : 500 Mo de base, 50 000 utilisateurs actifs par mois. Les 246
engagements pèsent moins de 1 Mo. Un projet gratuit est mis en pause après une semaine
sans aucune requête — à trois utilisateurs quotidiens, cela n'arrivera pas.

Vercel, offre Hobby : réservée à un usage non commercial. Pour une application de trésorerie
du Groupe, Vercel attend en principe l'offre Pro.
