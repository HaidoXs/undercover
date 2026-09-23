# Undercover — bluff et enquête entre amis

Jeu Undercover multijoueur en temps réel, en français, jouable entre plusieurs appareils **sans inscription** :
salon privé, invitation par lien ou code court, cartes secrètes, tours d'indices, votes, égalités,
Mr. White, rôles spéciaux, revanche, 10 packs de mots (431 paires générales) et 9 univers précis
(League of Legends, Pokémon, Minecraft, One Piece, Naruto, Dragon Ball, Harry Potter, Star Wars, Marvel).
Thème clair ou sombre, avatars dessinés ou photo importée, comptes facultatifs (e-mail ou Google).

- **Serveur** : Node.js + Express + Socket.IO. Seule source de vérité (rôles, mots, votes, délais, transitions).
- **Client** : React 19 + Vite, CSS sur mesure, icônes Lucide, polices Fredoka et Nunito auto-hébergées, illustrations SVG maison.
- **Données** : base libSQL compatible SQLite (comptes, sessions, profils, photos), soit un fichier local dans
  `DATA_DIR`, soit une base **Turso gratuite** pour un hébergeur sans disque. Aucun service tiers n'est nécessaire
  pour jouer ; l'envoi d'e-mails (SMTP) et Google sont facultatifs.
- **Comptes** : [Better Auth](https://www.better-auth.com) (mots de passe hachés, sessions en cookie httpOnly,
  vérification d'adresse, réinitialisation, limitation des tentatives). Photos vérifiées et réencodées par `sharp`.

---

## Démarrage rapide

Prérequis : **Node.js 20 ou plus** (testé avec Node 24).

```bash
npm install
npm run build
npm start
```

Ouvrir http://localhost:3000. Pour jouer depuis des téléphones sur le même Wi-Fi, ouvrir
`http://<adresse-IP-de-l-ordinateur>:3000` (le serveur écoute sur toutes les interfaces).

> Plusieurs joueurs sur un même ordinateur : chaque **onglet** est un joueur distinct
> (identité stockée par onglet). Une fenêtre privée ou un autre navigateur fonctionne aussi.

### Mode développement

```bash
npm run dev
```

- Interface avec rechargement à chaud : http://localhost:5180
- Serveur de jeu (redémarre à chaque modification) : port 3000, relayé par Vite (`/socket.io`, `/api`).

### Tests

```bash
npm test          # moteur, rôles spéciaux, tours d'indices, thème précis, packs, comptes, photos, multijoueur réel
npm run typecheck # vérification TypeScript de tout le projet
```

---

## Variables d'environnement

Toutes sont facultatives pour jouer (modèle commenté : `.env.example`, chargé avec `npm run start:env`).
`BETTER_AUTH_SECRET`, `SMTP_PASS` et `GOOGLE_CLIENT_SECRET` sont **secrètes** : jamais dans le dépôt ni dans le navigateur.

| Variable          | Défaut              | Rôle                                                                                     |
| ----------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `PORT`            | `3000`              | Port HTTP. Les hébergeurs le fournissent automatiquement.                                 |
| `HOST`            | `0.0.0.0`           | Interface d'écoute.                                                                      |
| `TRUST_PROXY`     | `0`                 | Mettre `1` derrière un hébergeur ou un proxy : la limitation de débit utilise la vraie IP. |
| `ALLOWED_ORIGINS` | _(vide)_            | Origines autorisées pour le temps réel, séparées par des virgules. Vide = même origine.  |
| `STATIC_DIR`      | `dist/client`       | Dossier de l'interface compilée.                                                         |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | _(vide)_ | Base Turso (`libsql://…`) et son jeton : indispensables sur un hébergeur sans disque. |
| `DATA_DIR`        | `./data`            | Sans `DATABASE_URL` : fichier local `undercover.db` (sur un disque persistant). Secret de dev. |
| `PUBLIC_URL`      | `http://localhost:PORT` | Adresse publique exacte : liens des e-mails et retour de Google.                     |
| `BETTER_AUTH_SECRET` | _(généré en dev)_ | Secret des sessions (32 caractères min.). Obligatoire en production, sinon comptes désactivés. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | _(vide)_ | Envoi des e-mails de compte. Sans SMTP : liens affichés dans le terminal en dev ; inscription par e-mail désactivée en production. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | _(vide)_ | Connexion Google ; le bouton n'apparaît que si les deux sont fournis. |

## Comptes, photos et thème

- **Sans compte**, tout fonctionne comme avant. Le compte garde pseudo, avatar (ou photo) et préférences
  (thème, musique, sons) d'un appareil à l'autre. L'adresse e-mail n'est jamais envoyée aux autres joueurs.
- **Connexion en pleine partie** : le socket est rouvert avec la session, la place est reprise par son jeton puis
  liée au compte — même joueur, même rôle, même progression. Un compte déjà assis dans un salon reprend sa place
  depuis un autre appareil (« Ta place t'attend ») au lieu de créer un second joueur.
- **Liaison Google** : jamais de fusion sur la seule adresse. Si l'adresse Google a déjà un compte, la connexion
  Google est refusée avec une explication ; on se connecte par mot de passe, puis « Lier mon compte Google ».
  Le nom et la photo Google ne remplacent jamais le profil de jeu.
- **Photos** : JPEG, PNG ou WebP, 5 Mo maximum, recadrage carré dans le navigateur. Le serveur vérifie la signature
  et le décodage réels, applique le recadrage, réduit à 256 × 256, réencode en WebP et supprime toutes les
  métadonnées (EXIF, GPS), puis la stocke dans la base (environ 15 Ko). Adresse non listée (identifiant aléatoire de 128 bits), non indexée. Propriété : le compte
  connecté, ou pour un invité une clé remise à l'import et gardée sur son appareil. Environ 8 envois par IP et par
  10 minutes. Une photo remplacée reste servie un jour (le temps qu'un salon cesse de l'afficher), puis est supprimée.
- **Thème** : clair ou sombre, suit l'appareil au premier accès puis mémorise le choix ; appliqué avant le premier
  affichage (`client/public/theme-init.js`), sans flash.

### Configurer Google (facultatif)

1. [Google Cloud Console](https://console.cloud.google.com/) → créer un projet → **API et services →
   Écran de consentement OAuth** : type « Externe », nom de l'application, adresse d'assistance, domaine autorisé
   (celui de `PUBLIC_URL`), champs d'application `openid`, `email`, `profile` ; publier l'application.
2. **Identifiants → Créer des identifiants → ID client OAuth → Application Web** :
   - origine JavaScript autorisée : `PUBLIC_URL` (ex. `https://undercover.example.com`) ;
   - URI de redirection autorisé : **`<PUBLIC_URL>/api/auth/callback/google`**
     (en local : `http://localhost:3000/api/auth/callback/google`, ou `http://localhost:5180/api/auth/callback/google`
     avec `npm run dev`).
3. Renseigner `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`, puis redémarrer. Sans eux, aucun bouton Google n'est affiché.

### Configurer l'envoi d'e-mails

Renseigner les variables `SMTP_*` et `MAIL_FROM` avec n'importe quel fournisseur SMTP (Brevo, Resend, Mailjet,
Postmark, Amazon SES, ou le SMTP de votre hébergeur de domaine). Pour une bonne délivrabilité, utiliser une adresse
d'expédition sur un domaine à vous, avec les enregistrements SPF et DKIM indiqués par le fournisseur.

---

## Déploiement

L'état des parties vit **en mémoire** : déployez **une seule instance** (pas de mise à l'échelle horizontale)
sur un hébergeur qui accepte les WebSockets et fournit le HTTPS (indispensable pour « Copier le lien »
sur mobile, qui exige un contexte sécurisé ; un repli existe mais il est moins fiable).

### Render gratuit + Turso gratuit (recommandé, 0 €)

`render.yaml` vise l'offre **gratuite** de Render, qui n'a pas de disque : les données vont dans une base
**Turso** gratuite. Étapes détaillées :

1. **Turso** : créer un compte sur [turso.tech](https://turso.tech), puis une base (région la plus proche de celle
   choisie sur Render, par exemple Francfort). Avec l'outil en ligne de commande :
   `turso db create undercover`, `turso db show undercover --url` (→ `DATABASE_URL`, commence par `libsql://`),
   `turso db tokens create undercover` (→ `DATABASE_AUTH_TOKEN`). Les tables se créent seules au premier démarrage.
2. **Render** : pousser ce dossier sur GitHub, puis **New + → Blueprint** et choisir le dépôt. Renseigner
   `DATABASE_URL`, `DATABASE_AUTH_TOKEN` et `PUBLIC_URL` (l'adresse `https://….onrender.com` du service, sans barre
   finale). `BETTER_AUTH_SECRET` est généré automatiquement.
3. **Google** : voir « Configurer Google » ci-dessus, avec `PUBLIC_URL` comme origine et
   `PUBLIC_URL/api/auth/callback/google` comme URI de redirection ; renseigner les deux identifiants sur Render.
4. Vérifier dans les journaux Render la ligne `données : base distante undercover-….turso.io`.

L'offre gratuite de Render met le service **en veille** après environ 15 minutes sans visite : le premier chargement
prend alors une trentaine de secondes, et une partie abandonnée par tout le monde est perdue. Les comptes, profils et
photos, eux, restent dans Turso. L'offre Starter de Render (payante) supprime la mise en veille.

### Docker (Fly.io, Railway, VPS, etc.)

```bash
docker build -t undercover .
docker run -p 3000:3000 -v undercover-data:/app/data -e PUBLIC_URL=https://mon-domaine -e BETTER_AUTH_SECRET=... undercover
```

- **Fly.io** : `fly launch` (détecte le Dockerfile, port interne 3000), puis `fly scale count 1`.
- **Railway** : nouveau projet depuis le dépôt ; le Dockerfile est détecté automatiquement.
- **VPS** : `docker run` derrière Nginx/Caddy avec HTTPS et la mise à niveau WebSocket activée.

### Services externes et coûts

Tout peut fonctionner **gratuitement** : Render gratuit pour le jeu, Turso gratuit pour les comptes et les photos,
Google gratuit pour la connexion. Payer sert seulement à supprimer la mise en veille ou à dépasser les quotas. Ordres de grandeur **à vérifier sur les pages de tarifs**,
qui évoluent :

| Hébergeur | Offre adaptée                  | Coût indicatif | À savoir                                                                                   |
| --------- | ------------------------------ | -------------- | ------------------------------------------------------------------------------------------ |
| Render    | Free                           | 0 €            | Mise en veille après ~15 min sans trafic : réveil lent et **salons en cours perdus**.       |
| Render    | Starter                        | ~7 $/mois      | Toujours actif.                                                                            |
| Fly.io    | Plus petite machine partagée   | quelques $/mois | Garder une seule machine et désactiver l'arrêt automatique pendant les soirées de jeu.     |
| Railway   | Hobby                          | ~5 $/mois      | Facturation à l'usage incluse dans l'abonnement ; volumes persistants disponibles.          |
| Turso     | Gratuite                       | 0 €            | Quotas gratuits (stockage de l'ordre du Go, lectures en centaines de millions par mois) très au-dessus des besoins d'un groupe d'amis. |
| Render    | Disque persistant (alternative à Turso) | ~0,25 $/Go/mois | Seulement avec une offre payante.                                              |
| SMTP      | Offres gratuites (Brevo, Resend…) | 0 € jusqu'à quelques centaines d'e-mails par jour | Suffisant pour les vérifications et réinitialisations d'un groupe d'amis. |
| Google    | Connexion OAuth                | 0 €            | Gratuit ; demande seulement la configuration décrite plus haut.                             |

Un nom de domaine est facultatif (sous-domaine fourni par l'hébergeur).

---

## Ajouter ou enrichir un pack de mots

Le contenu est organisé par **pack → univers → mots → paires** (`server/packs/types.ts`) :

- l'univers `general` (precise: false) sert en partie normale ;
- un univers précis (precise: true), comme « League of Legends », est proposé par l'option **Thème précis**
  dès qu'il compte au moins 10 paires ; ses paires ne sont jamais mêlées aux autres ;
- chaque mot est décrit **une fois** ; les paires le référencent par clé, ce qui permet plusieurs
  partenaires choisis à la main (4 au plus, jamais toutes les combinaisons).

```ts
import { definePack, p, universe, w } from './types';

export default definePack({
  id: 'mon-pack',            // identifiant stable, ne plus le changer
  name: 'Mon pack',
  description: 'Une phrase courte pour la carte du salon.',
  icon: 'sparkles',          // icône Lucide (kebab-case)
  universes: [
    universe({
      id: 'general',
      name: 'Mon pack',
      precise: false,
      words: {
        sushi: w('Sushi', 'Bouchée japonaise de riz vinaigré surmontée de poisson cru.'),
        poke: w('Poké bowl', 'Bol hawaïen de riz garni de poisson cru mariné et de légumes.'),
        ramen: w('Ramen', 'Soupe japonaise de nouilles de blé dans un bouillon riche.'),
      },
      pairs: [
        p('sushi', 'poke', 'Cuisine du monde'),   // thème large, vu seulement par Mr. White
        p('poke', 'ramen', 'Cuisine du monde'),
      ],
    }),
  ],
});
```

1. L'ajouter à la liste `PACKS` de `server/packs/index.ts` ; une icône nouvelle va dans `PACK_ICONS`
   (`client/src/components/icons.ts`).
2. Vérifier : `npx tsx scripts/check-pack.ts mon-pack`, puis `npm test`. Le serveur refuse de démarrer si une règle
   est violée : au moins 30 paires générales ; pas de doublon ; tous les mots utilisés ; descriptions de 25 à
   110 caractères, sans comparaison, sans citer un partenaire ni un rôle, et de longueur comparable dans une paire ;
   thème de Mr. White de 4 à 40 caractères, sans mot de la paire ni nom de l'univers ; au moins 20 % des mots avec
   plusieurs partenaires.
3. Critères de qualité (non vérifiables automatiquement, à relire) : deux mots réellement proches, avec plusieurs
   indices communs plausibles, de précision et de notoriété comparables ; pas de duo figé où l'un appelle l'autre
   (Batman/Robin, sel/poivre) ; pas de références obscures ajoutées seulement pour la difficulté.

---

## Règles appliquées (identiques dans l'aide du jeu et côté serveur)

- 3 à 12 joueurs. Par défaut : 1 Undercover, pas de Mr. White (activable dès 5 joueurs).
  Les Civils doivent être strictement majoritaires au départ.
- La paire est tirée uniquement parmi les packs sélectionnés, sans répétition dans le salon tant que la
  réserve n'est pas épuisée ; le mot des Civils est tiré au sort dans la paire.
- Civils et Undercover ne voient que leur mot (pas leur rôle), accompagné d'une courte description privée ;
  Mr. White sait qu'il n'a pas de mot et reçoit seulement un thème général commun à la paire.
- Ordre de passage fixé par le serveur ; Mr. White ne commence jamais le premier tour.
- **Tours d'indices avant le vote** (réglage de l'hôte, 1 à 5, 1 par défaut) : chaque joueur encore en jeu donne
  autant d'indices avant chaque scrutin ; le bloc recommence après chaque vote et chaque résolution.
- **Thème précis** (réglage de l'hôte, désactivé par défaut) : toutes les paires viennent de l'univers choisi parmi
  ceux des packs sélectionnés, annoncé à tous ; impossible à activer si aucun univers n'est disponible.
- Tic-tac discret pendant les 10 dernières secondes d'un indice ou de la tentative de Mr. White
  (plus rapide sur les 5 dernières), pour le seul joueur qui doit agir.
- Petit « toc » discret à l'activation d'un bouton (jamais au survol ni sur un bouton désactivé) ; un seul bouton
  coupe ou rétablit tous les sons (clics et tic-tac), choix mémorisé.
- Indice interdit s'il donne le mot (égalité après normalisation, ou mot contenu dans l'indice).
  Temps écoulé ou joueur absent : « Passé ».
- Vote secret et définitif, pas contre soi-même ; on voit qui a voté, jamais contre qui avant la clôture.
  Absence de vote = abstention. Égalité : second scrutin limité aux ex æquo, tous les joueurs en jeu votent.
  Égalité persistante ou aucun vote : personne n'est éliminé, nouveau tour d'indices.
- L'éliminé voit son rôle révélé (jamais son mot) et suit la manche sans jouer.
- Un éliminé qui n'a plus d'influence sur la manche voit, lui seul, le rôle de chaque joueur encore en vie (le serveur ne transmet ces rôles qu'à lui). Le Fantôme et la Justice n'y ont accès qu'en fin de manche ; la Vengeuse après sa décision ; Mr. White après sa tentative.
- Mr. White éliminé : une tentative chronométrée ; casse, accents, espaces superflus, tirets et
  apostrophes typographiques ignorés, sans correspondance approximative. Réussite = victoire immédiate.
- Puis : plus d'intrus → victoire des Civils ; intrus en jeu ≥ Civils restants → victoire des intrus.
- Fin de manche : les deux mots, tous les rôles et les gagnants sont révélés ; « Rejouer » conserve salon et paramètres.

## Rôles spéciaux (optionnels, tous désactivés par défaut)

L'hôte les active dans le salon (verrouillés pendant la manche). Un seul rôle spécial par joueur, en plus
de son camp et de son mot ; le lancement est refusé, avec une explication, s'il manque des joueurs ou des places.
Chaque rôle a une fiche ⓘ (pouvoir, objectif, victoire, restrictions) dans le salon, en jeu et dans l'aide.
Les textes font foi dans `shared/specialRoles.ts`.

| Rôle | Min. | Résumé |
| ---- | ---- | ------ |
| Déesse de la Justice | 3 | Identité publique. Tranche les égalités parmi les ex æquo (15 s), même éliminée ; sinon second scrutin. |
| Les Amoureux | 5 | Couple formé par le serveur, mort liée. Gagnent seuls s'ils sont les deux derniers en vie. |
| Mr. Meme | 3 | À chaque tour d'indices, un joueur différent sans autre rôle mime son indice (« Mime terminé »). |
| La Vengeuse | 5 | Éliminée, emporte un joueur en vie (15 s) ; sans choix, elle renonce. |
| Les Duellistes | 5 | Ne gagnent jamais avec leur camp. Un Duelliste gagne seul s'il vote contre son adversaire lors du scrutin qui l'élimine ; toute autre chute de l'un des deux clôt le duel sans vainqueur. |
| Le Fantôme | 3 | Éliminé, il discute et vote encore, sans jamais compter comme vivant ni être ciblé. |
| Le Vendeur de Falafels | 4 | Offre un falafel au début : protection (annule une élimination par scrutin) ou sabotage (prive de vote au prochain scrutin), tiré à 50/50. |
| Le Boomerang | 3 | Une fois : les votes contre lui reviennent à leurs auteurs, un seul recalcul. |
| Le Fou de joie | 3 | Gagne seul s'il est éliminé directement lors de la **première phase de vote** (départage compris), quel que soit le nombre de tours d'indices qui la précèdent. |

Ordre de résolution d'un vote, entièrement côté serveur : scrutin → Boomerang → égalités (Justice) →
protection du falafel → victoire du Fou de joie → éliminations liées et Vengeuse (chaque pouvoir une fois) →
tentative de chaque Mr. White éliminé → victoire du couple → victoires classiques → manche nulle si personne ne survit.

## Fiabilité et confidentialité

- Chaque joueur reçoit une **vue construite pour lui** (`Room.viewFor`) : son mot, jamais celui des autres ;
  les rôles uniquement après élimination ou en fin de manche ; son propre vote uniquement.
  Les tests inspectent **tous les messages réseau** reçus par chaque session pour le vérifier.
- Session individuelle : jeton aléatoire de 256 bits (le serveur n'en garde que l'empreinte SHA-256),
  stocké par onglet (rafraîchissement) et localement (bouton « Reprendre ma place »).
  Le code du salon permet de rejoindre, jamais de reprendre une identité ou de devenir hôte.
- Chaque action est vérifiée : appartenance, rôle d'hôte, phase, joueur actif, cible valide, et un
  identifiant de tour/scrutin/tentative qui rend caduque toute action rejouée ou tardive.
- Délais calculés par le serveur (échéances absolues) ; le client corrige le décalage d'horloge.
- Joueur déconnecté : place conservée, tours passés et votes en abstention après 10 s, retour possible.
  Hôte absent plus de 60 s : rôle transmis au joueur connecté arrivé le plus tôt.
  Tout le monde déconnecté : pause ; salon supprimé après 30 min sans joueur connecté.
- Limitation de débit par IP (recherche de code, création de salon, envoi de photos, connexion, inscription,
  réinitialisation) et par connexion (actions). L'IP vient de la connexion ou du proxy de confiance, jamais d'un
  en-tête choisi par le client.
- Comptes : mots de passe hachés (scrypt), cookie de session httpOnly et SameSite=Lax (Secure en HTTPS), jetons de
  vérification et de réinitialisation valables une heure et à usage unique, sessions révoquées après réinitialisation,
  requêtes de modification refusées depuis une autre origine.
- Pseudos (2–16 caractères) et indices (30 caractères) nettoyés et affichés comme du texte brut ;
  en-têtes de sécurité (CSP stricte, anti-iframe) via Helmet.

## Limites connues

- État des parties en mémoire : un redémarrage ou une mise en veille de l'hébergeur efface les salons en cours
  (les comptes, profils et photos, eux, sont conservés dans `DATA_DIR`). Passer à plusieurs instances demanderait
  un stockage partagé (Redis, base réseau).
- Pas de suppression de compte en libre-service pour l'instant.
- Un seul Mr. White par manche.
- La vérification « ne pas donner son mot » ne détecte pas les synonymes, traductions ou fautes volontaires.

## Structure

```
shared/         types, constantes, règles de composition, rôles spéciaux et avatars (communs client/serveur)
server/
  app.ts        Express + Socket.IO : routes, limitation de débit, validation des messages
  game/Room.ts  machine à états d'une partie + vues par joueur (confidentialité)
  game/RoomManager.ts  codes, sessions, reconnexions, diffusion, expiration
  packs/        10 packs (univers général + univers précis), registre, tirage et contrôles (validate.ts)
  auth.ts       comptes (Better Auth) · routes.ts : profil, préférences, photos · mail.ts : e-mails
  storage/      base libSQL (fichier local ou Turso) et photos
  text.ts       nettoyage des saisies et normalisation des comparaisons
client/src/
  screens/      accueil, code, profil, salon, et les écrans de jeu (Phases.tsx)
  components/   avatars (16 personnages), photo et recadrage, compte, carte secrète, minuteur, fenêtres, aide
  net/          connexion temps réel, reprise de session, compte, photos
  lib/theme.ts  thème clair / sombre
tests/          moteur, packs, parcours multijoueurs (sessions Socket.IO indépendantes)
```
