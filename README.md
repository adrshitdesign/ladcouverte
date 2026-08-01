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

Le site n'embarque pas de fichiers image : tu colles des URL. Trois options :

- **Le plus simple** : dépose tes images dans un dossier `assets/img/` à côté du site et utilise `assets/img/mon-image.jpg` comme URL.
- Supabase Storage (bucket public) si tu es en mode en ligne.
- N'importe quel hébergeur d'images.

Pour le logo : Admin > **Identité du site** > Logo (URL d'image). Tant que c'est vide, un logo typographique avec un bateau est utilisé (rappel du logo bateau de LaD). Les couleurs d'accent sont aussi modifiables là.

Les logos officiels sont dans le Drive : *Drive LaD > RESSOURCES > Logos* (`logo LaD.png`, `LOGO-BATEAU-BLANC.png`, `LOGO-COULEUR-BATEAU.png`).

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

## Mise en ligne

Glisse le dossier entier sur [Netlify Drop](https://app.netlify.com/drop) ou pousse-le sur GitHub Pages. Rien à compiler.
