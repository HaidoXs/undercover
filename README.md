# Undercover — bluff et enquête entre amis

Jeu Undercover multijoueur en temps réel, en français, jouable entre plusieurs appareils sans inscription :
salon privé, invitation par lien ou code court, cartes secrètes, tours d'indices, votes, égalités,
Mr. White, revanche, et 10 packs de mots (375 paires).

- **Serveur** : Node.js + Express + Socket.IO. Seule source de vérité (rôles, mots, votes, délais, transitions).
- **Client** : React 19 + Vite, CSS sur mesure, icônes Lucide, polices Fraunces et Manrope auto-hébergées.
- **Aucun service externe** : ni base de données, ni API tierce, ni compte. Un seul processus Node suffit.

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
npm test          # 53 tests : moteur, packs de mots, parcours multijoueurs réels
npm run typecheck # vérification TypeScript de tout le projet
```

---

## Variables d'environnement

Aucune n'est secrète, toutes sont facultatives (modèle : `.env.example`, chargé avec `npm run start:env`).

| Variable          | Défaut              | Rôle                                                                                     |
| ----------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `PORT`            | `3000`              | Port HTTP. Les hébergeurs le fournissent automatiquement.                                 |
| `HOST`            | `0.0.0.0`           | Interface d'écoute.                                                                      |
| `TRUST_PROXY`     | `0`                 | Mettre `1` derrière un hébergeur ou un proxy : la limitation de débit utilise la vraie IP. |
| `ALLOWED_ORIGINS` | _(vide)_            | Origines autorisées pour le temps réel, séparées par des virgules. Vide = même origine.  |
| `STATIC_DIR`      | `dist/client`       | Dossier de l'interface compilée.                                                         |

---

## Déploiement

L'état des parties vit **en mémoire** : déployez **une seule instance** (pas de mise à l'échelle horizontale)
sur un hébergeur qui accepte les WebSockets et fournit le HTTPS (indispensable pour « Copier le lien »
sur mobile, qui exige un contexte sécurisé ; un repli existe mais il est moins fiable).

### Render (le plus simple)

1. Pousser ce dossier sur un dépôt GitHub/GitLab.
2. Sur Render : **New + → Blueprint**, choisir le dépôt : `render.yaml` configure tout
   (build `npm ci && npm run build`, démarrage `npm start`, contrôle de santé `/api/health`, `TRUST_PROXY=1`).

### Docker (Fly.io, Railway, VPS, etc.)

```bash
docker build -t undercover .
docker run -p 3000:3000 undercover
```

- **Fly.io** : `fly launch` (détecte le Dockerfile, port interne 3000), puis `fly scale count 1`.
- **Railway** : nouveau projet depuis le dépôt ; le Dockerfile est détecté automatiquement.
- **VPS** : `docker run` derrière Nginx/Caddy avec HTTPS et la mise à niveau WebSocket activée.

### Services externes et coûts

Le jeu n'utilise **aucun service payant** : seul l'hébergement d'un petit processus Node est nécessaire
(environ 80 Mo de mémoire au repos, mesurés). Ordres de grandeur **à vérifier sur les pages de tarifs**, qui évoluent :

| Hébergeur | Offre adaptée                  | Coût indicatif | À savoir                                                                                   |
| --------- | ------------------------------ | -------------- | ------------------------------------------------------------------------------------------ |
| Render    | Free                           | 0 €            | Mise en veille après ~15 min sans trafic : réveil lent et **salons en cours perdus**.       |
| Render    | Starter                        | ~7 $/mois      | Toujours actif.                                                                            |
| Fly.io    | Plus petite machine partagée   | quelques $/mois | Garder une seule machine et désactiver l'arrêt automatique pendant les soirées de jeu.     |
| Railway   | Hobby                          | ~5 $/mois      | Facturation à l'usage incluse dans l'abonnement.                                           |

Un nom de domaine est facultatif (sous-domaine fourni par l'hébergeur).

---

## Ajouter un pack de mots

1. Créer `server/packs/mon-pack.ts` sur le modèle des autres :

   ```ts
   import { definePack } from './types';

   export default definePack({
     id: 'mon-pack',            // identifiant stable, ne plus le changer
     name: 'Mon pack',
     description: 'Une phrase courte pour la carte du salon.',
     icon: 'sparkles',          // icône Lucide (kebab-case)
     pairs: [
       ['Mot A', 'Mot B'],       // deux éléments proches, de notoriété comparable
       // … au moins 30 paires, ajoutées en fin de liste
     ],
   });
   ```

2. L'ajouter à la liste `PACKS` de `server/packs/index.ts`.
3. Si l'icône est nouvelle, l'ajouter à `PACK_ICONS` dans `client/src/components/icons.ts`
   (sinon une icône par défaut s'affiche).
4. `npm test` vérifie : ≥ 30 paires, aucune paire identique, aucun doublon (même inversé) entre packs,
   aucun mot réutilisé dans deux paires. Le serveur refuse aussi de démarrer si une règle est violée.

---

## Règles appliquées (identiques dans l'aide du jeu et côté serveur)

- 3 à 12 joueurs. Par défaut : 1 Undercover, pas de Mr. White (activable dès 5 joueurs).
  Les Civils doivent être strictement majoritaires au départ.
- La paire est tirée uniquement parmi les packs sélectionnés, sans répétition dans le salon tant que la
  réserve n'est pas épuisée ; le mot des Civils est tiré au sort dans la paire.
- Civils et Undercover ne voient que leur mot (pas leur rôle) ; Mr. White sait qu'il n'a pas de mot.
- Ordre de passage fixé par le serveur ; Mr. White ne commence jamais le premier tour.
- Indice interdit s'il donne le mot (égalité après normalisation, ou mot contenu dans l'indice).
  Temps écoulé ou joueur absent : « Passé ».
- Vote secret et définitif, pas contre soi-même ; on voit qui a voté, jamais contre qui avant la clôture.
  Absence de vote = abstention. Égalité : second scrutin limité aux ex æquo, tous les joueurs en jeu votent.
  Égalité persistante ou aucun vote : personne n'est éliminé, nouveau tour d'indices.
- L'éliminé voit son rôle révélé (jamais son mot) et suit la manche sans jouer.
- Mr. White éliminé : une tentative chronométrée ; casse, accents, espaces superflus, tirets et
  apostrophes typographiques ignorés, sans correspondance approximative. Réussite = victoire immédiate.
- Puis : plus d'intrus → victoire des Civils ; intrus en jeu ≥ Civils restants → victoire des intrus.
- Fin de manche : les deux mots, tous les rôles et les gagnants sont révélés ; « Rejouer » conserve salon et paramètres.

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
- Limitation de débit par IP (recherche de code, création de salon) et par connexion (actions).
- Pseudos (2–16 caractères) et indices (30 caractères) nettoyés et affichés comme du texte brut ;
  en-têtes de sécurité (CSP stricte, anti-iframe) via Helmet.

## Limites connues

- État en mémoire : un redémarrage ou une mise en veille de l'hébergeur efface les salons en cours.
  Passer à plusieurs instances demanderait un stockage partagé (Redis) et des sessions persistantes.
- Un seul Mr. White par manche.
- La vérification « ne pas donner son mot » ne détecte pas les synonymes, traductions ou fautes volontaires.

## Structure

```
shared/         types, constantes, règles de composition et avatars (communs client/serveur)
server/
  app.ts        Express + Socket.IO : routes, limitation de débit, validation des messages
  game/Room.ts  machine à états d'une partie + vues par joueur (confidentialité)
  game/RoomManager.ts  codes, sessions, reconnexions, diffusion, expiration
  packs/        10 packs de mots + registre et tirage
  text.ts       nettoyage des saisies et normalisation des comparaisons
client/src/
  screens/      accueil, code, profil, salon, et les écrans de jeu (Phases.tsx)
  components/   avatars, carte secrète, minuteur, feuilles modales, aide
  net/          connexion temps réel, reprise de session, actions
tests/          moteur, packs, parcours multijoueurs (sessions Socket.IO indépendantes)
```
