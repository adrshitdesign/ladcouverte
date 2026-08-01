# La Dcouverte — site du média

Site statique + back-office façon CRM. Aucun framework, aucune compilation : tu peux l'héberger n'importe où (Netlify, Vercel, GitHub Pages, OVH, un simple FTP).

## Les pages

| Fichier | Rôle |
|---|---|
| `index.html` | Accueil : bandeau, article à la une, actualités, coups de cœur, formats |
| `articles.html` | Liste des articles, recherche + filtres par rubrique |
| `article.html` | Article détaillé (blocs texte, image, vidéo, lien, widget d'écoute) |
| `histoire.html` | Le média : intro, mission, chiffres, frise chronologique, équipe |
| `forum.html` | Blog / FAQ : les visiteurs posent des questions, débattent, recommandent |
| `admin.html` | Back-office : édition de **toutes** les sections |
| `supabase.sql` | Le schéma de la base — **déjà exécuté**, gardé comme référence |

## Démarrer en local

Ouvre `index.html` dans ton navigateur. Pour éviter les limitations des fichiers locaux, mieux vaut lancer un mini serveur depuis le dossier :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

Admin : `http://localhost:8000/admin.html` — connexion avec l'email et le mot de passe du compte Supabase de la rédaction (voir ci-dessous).

## Le mode en ligne : déjà branché

Le site tourne sur un projet Supabase gratuit, déjà créé et configuré :

| | |
|---|---|
| Projet | `ladcouverte` (organisation adrshitdesign, région Europe) |
| URL | `https://pamblclzgkiqfkojnomp.supabase.co` |
| Tables | `site_content`, `forum_questions`, `forum_replies` |
| Sécurité | RLS activée — lecture publique, écriture réservée aux comptes connectés, les visiteurs peuvent seulement poser une question ou répondre |

**Il reste une seule chose à faire, et c'est à toi de la faire** (je ne crée pas de compte à ta place) :

1. [Authentication > Users](https://supabase.com/dashboard/project/pamblclzgkiqfkojnomp/auth/users) > **Add user > Create new user**
2. Mets l'email de la rédaction et un mot de passe solide, coche « Auto confirm user »
3. Ouvre `admin.html`, connecte-toi avec ces identifiants
4. Le tableau de bord affichera « Première mise en ligne du contenu » : clique sur **Enregistrer les modifications**. Le contenu part dans la base, le site est vivant.

À partir de là, tout ce que tu modifies dans l'admin est visible par tout le monde, et les questions des visiteurs arrivent directement dans la base.

Si Supabase est injoignable, le site rebascule tout seul en mode local plutôt que d'afficher une page blanche.

### Repasser en mode local
Vide `supabaseUrl` et `supabaseAnonKey` dans `assets/js/config.js`. Le contenu vit alors dans le navigateur, et pour publier tes modifications : **Admin > Sauvegarde > Télécharger seed.js**, puis remplace `data/seed.js`.

### Ajouter quelqu'un à la rédaction
Même manip qu'au point 1 : un compte Supabase = un accès admin. Pour retirer l'accès, supprime l'utilisateur.

## Écrire un article

Admin > **Articles** > Nouvel article. Un article est une pile de blocs, dans l'ordre que tu veux :

| Type de bloc | Ce que tu colles |
|---|---|
| Paragraphe / Sous-titre / Citation | du texte |
| Image | une URL d'image |
| Vidéo | YouTube, Vimeo, Dailymotion, TikTok, ou un `.mp4` |
| Écoute | **Spotify, Apple Music, Deezer, SoundCloud** — le widget est généré tout seul |
| Lien | n'importe quelle URL (carte cliquable) |

Un aperçu s'affiche sous les blocs vidéo et écoute pendant que tu colles le lien. Décoche « Publié » pour garder un brouillon invisible sur le site.

**Astuce pour les liens d'écoute** : sur Spotify → clic droit sur le morceau > Partager > Copier le lien. Sur Deezer et Apple Music, le lien de la page suffit. Un lien de *recherche* (`/search/…`) n'est pas embarquable : il s'affichera en carte-lien.

## Images et logo

Deux endroits, selon l'usage :

**`assets/img/` dans ce dépôt** — les visuels éditoriaux (couvertures d'articles, bandeau d'accueil, galerie). 21 images du Drive y sont déjà, redimensionnées et compressées pour le web (4,4 Mo au total). Pour en ajouter : *Add file > Upload files* dans `assets/img`, puis utilise `assets/img/mon-image.jpg` comme URL dans l'admin.

**Supabase Storage (bucket `medias`)** — les logos. 12 déclinaisons du bateau LaD y sont hébergées, publiques en lecture. Exemple d'URL :
`https://pamblclzgkiqfkojnomp.supabase.co/storage/v1/object/public/medias/logo-rond-orange.png`

Variantes disponibles : `logo-rond-orange`, `logo-rond-noir`, `logo-bateau-orange`, `logo-blason-blanc`, `logo-blason-orange`, `logo-rendu-02` à `07`, `favicon`.

Le logo et le favicon se changent dans Admin > **Identité du site**, avec les deux couleurs d'accent (l'orange actuel, `#FF6840`, est pipeté dans le logo). Si le champ logo est vide, un bateau dessiné en SVG prend le relais.

Un mot sur le Drive : Google bloque la copie automatique des fichiers qui ne sont pas partagés par lien. Pour ajouter d'autres images du Drive, télécharge-les puis dépose-les dans `assets/img`.

## Modération du blog

Admin > **Blog & FAQ** : répondre en tant que rédaction, épingler, masquer, supprimer un sujet ou une réponse. Pour que les questions passent en validation avant publication, mets `autoPublishQuestions: false` dans `assets/js/config.js`.

## Sécurité, en clair

- Le site est en **mode Supabase** : l'authentification est réelle et les droits d'écriture sont gérés par les politiques RLS. Vérifié : sans être connecté, on peut lire le contenu et poster une question, mais pas modifier une ligne du site.
- La clé `sb_publishable_…` dans `config.js` est faite pour être visible côté navigateur — ce n'est pas un secret. Ne colle jamais une clé `secret` / `service_role` dans le site.
- En **mode local**, le mot de passe de `config.js` est un simple verrou de confort, pas une protection.
- Le mot de passe de la base Postgres a été généré à la création du projet. Il ne sert pas au site ; si tu en as besoin un jour, régénère-le dans Project Settings > Database.

## Tests

Un test de rendu automatique vérifie les 6 pages, l'admin (connexion, édition, sauvegarde, modération) et la génération des widgets d'écoute :

```bash
npm install jsdom
node tests/render-test.js
```

## Le site en ligne

**https://adrshitdesign.github.io/ladcouverte/**

Hébergé par GitHub Pages depuis la branche `main` de ce dépôt (`adrshitdesign/ladcouverte`). Chaque modification poussée sur `main` est publiée automatiquement en une minute environ.

Pour mettre à jour un fichier sans passer par la ligne de commande : ouvre-le sur GitHub, clique sur le crayon, modifie, *Commit changes*. Pour remplacer plusieurs fichiers : *Add file > Upload files* dans le dossier concerné.

Attention : le contenu éditorial (articles, membres, blog) ne se met **pas** à jour par ce dépôt — il vit dans Supabase et se modifie depuis `admin.html`. Le dépôt ne contient que le code du site et le contenu de secours (`data/seed.js`).
