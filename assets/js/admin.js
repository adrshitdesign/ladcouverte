/* ==========================================================================
   La Dcouverte — Admin / CRM
   ========================================================================== */
(function () {
  var U = LAD.util, S = LAD.store, CFG = window.LAD_CONFIG || {};
  var view = "dashboard", editing = null, questions = [];

  /* -------------------------------------------------- chemins & data-bind */
  function get(path) {
    return path.split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, S.content);
  }
  function set(path, val) {
    var ks = path.split("."), last = ks.pop();
    var t = ks.reduce(function (o, k) {
      if (o[k] == null) o[k] = /^\d+$/.test(k) ? [] : {};
      return o[k];
    }, S.content);
    t[last] = val;
  }
  function bind(root) {
    [].forEach.call(root.querySelectorAll("[data-path]"), function (el) {
      var p = el.dataset.path;
      var v = get(p);
      if (el.type === "checkbox") el.checked = !!v; else el.value = v == null ? "" : v;
      var ev = el.tagName === "SELECT" || el.type === "checkbox" || el.type === "color" ? "change" : "input";
      el.addEventListener(ev, function () {
        var nv = el.type === "checkbox" ? el.checked : el.value;
        if (el.dataset.list === "1") nv = String(nv).split(",").map(function (x) { return x.trim(); }).filter(Boolean);
        set(p, nv);
        dirty(true);
        if (el.dataset.rerender === "1") render();
      });
    });
  }

  var isDirty = false;
  function dirty(v) {
    isDirty = v;
    var b = document.getElementById("save-btn");
    if (b) { b.textContent = v ? "Enregistrer les modifications" : "Tout est enregistré"; b.disabled = !v; }
  }
  function save() {
    return S.saveContent().then(function () { dirty(false); U.toast("Enregistré"); })
      .catch(function (e) { U.toast("Erreur : " + e.message); });
  }
  window.addEventListener("beforeunload", function (e) {
    if (isDirty) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ----------------------------------------------------------- composants */
  function field(label, path, opts) {
    opts = opts || {};
    var id = "f_" + path.replace(/[^a-z0-9]/gi, "_");
    var attrs = 'id="' + id + '" data-path="' + path + '"' +
      (opts.rerender ? ' data-rerender="1"' : "") +
      (opts.list ? ' data-list="1"' : "") +
      (opts.placeholder ? ' placeholder="' + U.esc(opts.placeholder) + '"' : "") +
      (opts.type ? ' type="' + opts.type + '"' : "");
    var input;
    if (opts.textarea) input = "<textarea " + attrs + (opts.rows ? ' rows="' + opts.rows + '"' : "") + "></textarea>";
    else if (opts.options) {
      input = "<select " + attrs + ">" + opts.options.map(function (o) {
        var val = typeof o === "string" ? o : o.value, lab = typeof o === "string" ? o : o.label;
        return '<option value="' + U.esc(val) + '">' + U.esc(lab) + "</option>";
      }).join("") + "</select>";
    } else input = "<input " + attrs + ">";
    return '<div class="field"><label for="' + id + '">' + U.esc(label) +
      (opts.hint ? ' <span style="text-transform:none;letter-spacing:0;font-weight:400">— ' + U.esc(opts.hint) + "</span>" : "") +
      "</label>" + input + "</div>";
  }
  function head(title, right) {
    return '<div class="admin-head"><h2>' + U.esc(title) + "</h2><div style='display:flex;gap:10px;align-items:center;flex-wrap:wrap'>" +
      (right || "") + '<button class="btn accent" id="save-btn" disabled>Tout est enregistré</button></div></div>';
  }
  function addBtn(label, action, arg) {
    return '<button class="btn ghost sm" data-act="' + action + '"' + (arg ? ' data-arg="' + U.esc(arg) + '"' : "") + ">+ " + U.esc(label) + "</button>";
  }
  function rowActs(action, i, extra) {
    return '<div class="acts">' + (extra || "") +
      '<button class="btn ghost sm" data-act="' + action + '-up" data-arg="' + i + '">↑</button>' +
      '<button class="btn ghost sm" data-act="' + action + '-down" data-arg="' + i + '">↓</button>' +
      '<button class="btn danger sm" data-act="' + action + '-del" data-arg="' + i + '">Supprimer</button></div>';
  }
  function move(arr, i, d) {
    var j = i + d;
    if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }

  /* --------------------------------------------------------------- vues */
  var views = {};

  views.dashboard = function () {
    var C = S.content;
    var pub = (C.articles || []).filter(function (a) { return a.published !== false; }).length;
    var mode = S.remote
      ? '<span class="status-pill live">● En ligne (Supabase) — visible par tous</span>'
      : '<span class="status-pill">● Mode local — modifications sur ce navigateur uniquement</span>';
    return head("Tableau de bord", mode) +
      (S.needsSeed ? '<div class="panel" style="margin-bottom:22px;border-color:var(--accent)">' +
        '<h3 style="margin:0 0 8px;font-size:19px">Première mise en ligne du contenu</h3>' +
        '<p class="muted" style="margin:0;font-size:14.5px">La base est encore vide. Clique sur ' +
        '<strong>Enregistrer les modifications</strong> ci-dessus pour y envoyer le contenu actuel du site. ' +
        'Ensuite, tout ce que tu modifies ici est visible par tout le monde.</p></div>' : "") +
      '<div class="grid c4" style="margin-bottom:24px">' +
      [[pub, "Articles publiés"], [(C.articles || []).length, "Articles au total"],
       [((C.histoire || {}).members || []).length, "Membres"], [questions.length, "Sujets sur le blog"]]
        .map(function (x) { return '<div class="stat"><div class="v">' + x[0] + '</div><div class="l">' + x[1] + "</div></div>"; }).join("") +
      "</div>" +
      '<div class="panel"><h3 style="margin:0 0 14px;font-size:19px">Raccourcis</h3><div class="chip-row">' +
      '<button class="chip" data-act="go" data-arg="articles">Écrire un article</button>' +
      '<button class="chip" data-act="go" data-arg="home">Modifier l\'accueil</button>' +
      '<button class="chip" data-act="go" data-arg="forum">Modérer le blog</button>' +
      '<button class="chip" data-act="go" data-arg="data">Exporter une sauvegarde</button>' +
      '<a class="chip" href="index.html" target="_blank">Voir le site ↗</a>' +
      "</div></div>" +
      (S.remote ? "" : '<div class="panel" style="margin-top:18px"><h3 style="margin:0 0 8px;font-size:17px">Passer le site en ligne</h3>' +
        '<p class="muted" style="margin:0;font-size:14.5px">Pour que tes modifications et les questions des visiteurs soient visibles par tout le monde, ' +
        'crée un projet gratuit sur supabase.com, lance le script <code>supabase.sql</code> fourni, puis renseigne l\'URL et la clé dans ' +
        '<code>assets/js/config.js</code>. Tout est expliqué dans le README.</p></div>');
  };

  views.settings = function () {
    return head("Identité du site") +
      '<div class="panel">' +
      '<div class="row">' + field("Nom du média", "settings.siteName") + field("Accroche courte", "settings.tagline") + "</div>" +
      field("Baseline (pied de page)", "settings.baseline", { textarea: true, rows: 2 }) +
      '<div class="row">' + field("Logo (URL d'image)", "settings.logoUrl", { hint: "laisse vide pour le logo typographique" }) +
      field("Favicon (URL d'image)", "settings.faviconUrl", { hint: "l'icône dans l'onglet du navigateur" }) + "</div>" +
      field("Email de contact", "settings.email") +
      '<div class="row c3">' + field("Couleur d'accent", "settings.accent", { type: "color" }) +
      field("Couleur secondaire", "settings.accent2", { type: "color" }) +
      field("Mention légale (pied de page)", "settings.footerNote") + "</div>" +
      "</div>" +
      '<div class="panel" style="margin-top:18px"><div class="admin-head" style="margin-bottom:14px">' +
      '<h3 style="margin:0;font-size:19px">Réseaux sociaux</h3>' + addBtn("Ajouter un réseau", "social") + "</div>" +
      (S.content.settings.socials || []).map(function (x, i) {
        return '<div class="block-edit"><div class="row">' +
          field("Nom", "settings.socials." + i + ".label") + field("Lien", "settings.socials." + i + ".url") +
          '</div><div style="margin-top:10px">' + rowActs("social", i) + "</div></div>";
      }).join("") + "</div>";
  };

  views.home = function () {
    var h = S.content.home || {};
    var arts = (S.content.articles || []).map(function (a) { return { value: a.slug, label: a.title }; });
    return head("Page d'accueil", '<a class="btn ghost" href="index.html" target="_blank">Aperçu ↗</a>') +
      '<div class="panel"><h3 style="margin:0 0 14px;font-size:19px">Bandeau principal</h3>' +
      '<div class="row">' + field("Sur-titre", "home.heroKicker") +
      field("Article mis en avant", "home.featuredSlug", { options: arts }) + "</div>" +
      field("Titre", "home.heroTitle", { textarea: true, rows: 2 }) +
      field("Texte", "home.heroText", { textarea: true }) +
      '<div class="row c3">' + field("Libellé du bouton", "home.heroCtaLabel") +
      field("Lien du bouton", "home.heroCtaUrl") +
      field("Image du bandeau (URL)", "home.heroImage") + "</div></div>" +

      '<div class="panel" style="margin-top:18px"><div class="admin-head" style="margin-bottom:14px">' +
      '<h3 style="margin:0;font-size:19px">Nos actualités</h3>' + addBtn("Ajouter une actu", "actu") + "</div>" +
      (h.actus || []).map(function (a, i) {
        return '<div class="block-edit"><div class="row">' +
          field("Date", "home.actus." + i + ".date", { type: "date" }) +
          field("Titre", "home.actus." + i + ".title") + "</div>" +
          field("Texte", "home.actus." + i + ".text", { textarea: true, rows: 2 }) +
          field("Lien (optionnel)", "home.actus." + i + ".url") +
          '<div style="margin-top:10px">' + rowActs("actu", i) + "</div></div>";
      }).join("") + "</div>" +

      '<div class="panel" style="margin-top:18px"><div class="admin-head" style="margin-bottom:14px">' +
      '<h3 style="margin:0;font-size:19px">Coups de cœur</h3>' + addBtn("Ajouter un coup de cœur", "pick") + "</div>" +
      (h.coupsDeCoeur || []).map(function (c, i) {
        return '<div class="block-edit"><div class="row">' +
          field("Artiste", "home.coupsDeCoeur." + i + ".artist") +
          field("Titre du morceau", "home.coupsDeCoeur." + i + ".title") + "</div>" +
          field("Pourquoi on aime", "home.coupsDeCoeur." + i + ".why", { textarea: true, rows: 2 }) +
          '<div class="row">' + field("Pochette (URL)", "home.coupsDeCoeur." + i + ".cover") +
          field("Lien d'écoute", "home.coupsDeCoeur." + i + ".listenUrl") + "</div>" +
          '<div style="margin-top:10px">' + rowActs("pick", i) + "</div></div>";
      }).join("") + "</div>" +

      '<div class="panel" style="margin-top:18px"><div class="admin-head" style="margin-bottom:14px">' +
      '<h3 style="margin:0;font-size:19px">Nos formats</h3>' + addBtn("Ajouter un format", "rubrique") + "</div>" +
      (h.rubriques || []).map(function (r, i) {
        return '<div class="block-edit"><div class="row">' +
          field("Nom", "home.rubriques." + i + ".name") +
          field("Description", "home.rubriques." + i + ".desc") + "</div>" +
          '<div style="margin-top:10px">' + rowActs("rubrique", i) + "</div></div>";
      }).join("") + "</div>";
  };

  views.articles = function () {
    if (editing != null) return articleEditor(editing);
    var list = (S.content.articles || []);
    return head("Articles", addBtn("Nouvel article", "new-article")) +
      (list.length ? list.map(function (a, i) {
        return '<div class="list-item"><div style="min-width:0">' +
          '<div class="t">' + U.esc(a.title) + (a.published === false ? ' <span class="badge grey">Brouillon</span>' : "") + "</div>" +
          '<div class="s">' + U.esc(a.kicker || "—") + " · " + U.date(a.date) + " · " + ((a.blocks || []).length) + " blocs</div></div>" +
          '<div class="acts">' +
          '<a class="btn ghost sm" href="article.html?a=' + U.esc(a.slug) + '" target="_blank">Voir</a>' +
          '<button class="btn sm" data-act="edit-article" data-arg="' + i + '">Modifier</button>' +
          '<button class="btn ghost sm" data-act="dup-article" data-arg="' + i + '">Dupliquer</button>' +
          '<button class="btn danger sm" data-act="del-article" data-arg="' + i + '">Supprimer</button>' +
          "</div></div>";
      }).join("") : '<p class="muted">Aucun article. Clique sur « Nouvel article ».</p>');
  };

  var BLOCK_TYPES = [
    { value: "text", label: "Paragraphe" },
    { value: "heading", label: "Sous-titre" },
    { value: "quote", label: "Citation" },
    { value: "image", label: "Image (URL)" },
    { value: "video", label: "Vidéo (YouTube, Vimeo, TikTok, MP4…)" },
    { value: "audio", label: "Écoute (Spotify, Apple Music, Deezer, SoundCloud)" },
    { value: "link", label: "Lien / ressource" }
  ];

  function articleEditor(i) {
    var a = S.content.articles[i];
    var p = "articles." + i + ".";
    var blocks = (a.blocks || []).map(function (b, j) {
      var bp = p + "blocks." + j + ".";
      var needsCaption = ["image", "video", "audio", "link"].indexOf(b.type) > -1;
      var valueField = (b.type === "text" || b.type === "quote")
        ? field("Contenu", bp + "value", { textarea: true, rows: b.type === "text" ? 5 : 3 })
        : field(b.type === "heading" ? "Sous-titre" : "URL", bp + "value",
            { placeholder: b.type === "audio" ? "https://open.spotify.com/track/…" : b.type === "video" ? "https://www.youtube.com/watch?v=…" : "" });
      return '<div class="block-edit"><div class="bh">' +
        '<select data-path="' + bp + 'type" data-rerender="1">' + BLOCK_TYPES.map(function (t) {
          return '<option value="' + t.value + '"' + (t.value === b.type ? " selected" : "") + ">" + U.esc(t.label) + "</option>";
        }).join("") + "</select>" +
        '<span class="muted" style="font-size:12.5px">bloc ' + (j + 1) + "</span>" +
        '<div class="acts" style="margin-left:auto">' +
        '<button class="btn ghost sm" data-act="block-up" data-arg="' + j + '">↑</button>' +
        '<button class="btn ghost sm" data-act="block-down" data-arg="' + j + '">↓</button>' +
        '<button class="btn danger sm" data-act="block-del" data-arg="' + j + '">✕</button></div></div>' +
        valueField +
        (needsCaption ? field("Légende (optionnel)", bp + "caption") : "") +
        (b.type === "audio" || b.type === "video" ? '<div style="margin-top:10px" class="prev" data-prev="' + j + '"></div>' : "") +
        "</div>";
    }).join("");

    return head("Modifier l'article",
      '<button class="btn ghost" data-act="back">← Retour à la liste</button>' +
      '<a class="btn ghost" href="article.html?a=' + U.esc(a.slug) + '" target="_blank">Aperçu ↗</a>') +
      '<div class="panel">' +
      '<div class="row">' + field("Titre", p + "title") + field("Identifiant URL (slug)", p + "slug", { hint: "sans espace ni accent" }) + "</div>" +
      '<div class="row c3">' + field("Format / rubrique", p + "kicker", { placeholder: "Interview, Le Dbat…" }) +
      field("Auteur", p + "author") + field("Date", p + "date", { type: "date" }) + "</div>" +
      field("Chapô (résumé)", p + "excerpt", { textarea: true, rows: 2 }) +
      '<div class="row">' + field("Image de couverture (URL)", p + "cover") +
      field("Tags", p + "tags", { list: true, hint: "séparés par des virgules" }) + "</div>" +
      '<div class="field"><label><input type="checkbox" data-path="' + p + 'published" style="width:auto;margin-right:8px">Publié sur le site</label></div>' +
      "</div>" +
      '<div class="admin-head" style="margin:24px 0 14px"><h3 style="margin:0;font-size:20px">Contenu de l\'article</h3>' +
      addBtn("Ajouter un bloc", "block") + "</div>" +
      (blocks || '<p class="muted">Aucun bloc. Ajoute un paragraphe, une vidéo, un widget d\'écoute…</p>');
  }

  views.histoire = function () {
    var hi = S.content.histoire || {};
    return head("Le média & l'équipe", '<a class="btn ghost" href="histoire.html" target="_blank">Aperçu ↗</a>') +
      '<div class="panel">' +
      field("Introduction", "histoire.intro", { textarea: true, rows: 4 }) +
      field("Mission", "histoire.mission", { textarea: true, rows: 3 }) +
      field("Image de bandeau (URL)", "histoire.image", { hint: "photo large affichée sous l'introduction" }) + "</div>" +

      '<div class="panel" style="margin-top:18px"><div class="admin-head" style="margin-bottom:14px">' +
      '<h3 style="margin:0;font-size:19px">Galerie « En images »</h3>' + addBtn("Ajouter une photo", "gal") + "</div>" +
      (hi.gallery || []).map(function (g, i) {
        return '<div class="block-edit"><div class="row">' +
          field("URL de l'image", "histoire.gallery." + i + ".url") +
          field("Légende", "histoire.gallery." + i + ".caption") +
          '</div><div style="margin-top:10px">' + rowActs("gal", i) + "</div></div>";
      }).join("") + "</div>" +

      '<div class="panel" style="margin-top:18px"><div class="admin-head" style="margin-bottom:14px">' +
      '<h3 style="margin:0;font-size:19px">Chiffres clés</h3>' + addBtn("Ajouter un chiffre", "stat") + "</div>" +
      (hi.stats || []).map(function (x, i) {
        return '<div class="block-edit"><div class="row">' +
          field("Valeur", "histoire.stats." + i + ".value") + field("Libellé", "histoire.stats." + i + ".label") +
          '</div><div style="margin-top:10px">' + rowActs("stat", i) + "</div></div>";
      }).join("") + "</div>" +

      '<div class="panel" style="margin-top:18px"><div class="admin-head" style="margin-bottom:14px">' +
      '<h3 style="margin:0;font-size:19px">Frise chronologique</h3>' + addBtn("Ajouter une étape", "tl") + "</div>" +
      (hi.timeline || []).map(function (t, i) {
        return '<div class="block-edit"><div class="row">' +
          field("Année", "histoire.timeline." + i + ".year") + field("Titre", "histoire.timeline." + i + ".title") + "</div>" +
          field("Texte", "histoire.timeline." + i + ".text", { textarea: true, rows: 2 }) +
          '<div style="margin-top:10px">' + rowActs("tl", i) + "</div></div>";
      }).join("") + "</div>" +

      '<div class="panel" style="margin-top:18px"><div class="admin-head" style="margin-bottom:14px">' +
      '<h3 style="margin:0;font-size:19px">Membres</h3>' + addBtn("Ajouter un membre", "member") + "</div>" +
      (hi.members || []).map(function (m, i) {
        var mp = "histoire.members." + i + ".";
        return '<div class="block-edit"><div class="row">' +
          field("Nom", mp + "name") + field("Rôle", mp + "role") + "</div>" +
          field("Bio courte", mp + "bio", { textarea: true, rows: 2 }) +
          field("Photo (URL)", mp + "photo") +
          (m.links || []).map(function (l, k) {
            return '<div class="row" style="margin-top:10px">' + field("Lien " + (k + 1) + " — nom", mp + "links." + k + ".label") +
              field("Lien " + (k + 1) + " — URL", mp + "links." + k + ".url") + "</div>";
          }).join("") +
          '<div style="margin-top:10px">' + rowActs("member", i,
            '<button class="btn ghost sm" data-act="member-link" data-arg="' + i + '">+ lien</button>') + "</div></div>";
      }).join("") + "</div>";
  };

  views.forum = function () {
    var F = S.content.forum || {};
    return head("Blog & FAQ", '<a class="btn ghost" href="forum.html" target="_blank">Aperçu ↗</a>') +
      '<div class="panel">' + field("Texte d'introduction", "forum.intro", { textarea: true, rows: 2 }) +
      field("Catégories", "forum.categories", { list: true, hint: "séparées par des virgules" }) + "</div>" +
      '<div class="admin-head" style="margin:24px 0 14px"><h3 style="margin:0;font-size:20px">Sujets (' + questions.length + ")</h3>" +
      addBtn("Ajouter un sujet / une FAQ", "new-question") + "</div>" +
      (questions.length ? questions.map(function (q) {
        return '<div class="panel" style="margin-bottom:12px">' +
          '<div class="thread-head">' +
          '<span class="badge grey">' + U.esc(q.category || "Sujet") + "</span>" +
          (q.pinned ? '<span class="badge">Épinglé</span>' : "") +
          (q.status === "published" ? "" : '<span class="badge blue">' + U.esc(q.status) + "</span>") +
          '<span class="muted" style="font-size:13px">' + U.esc(q.author || "Anonyme") + " · " + U.date(q.date) + "</span></div>" +
          '<h3 style="margin:8px 0 6px;font-size:19px">' + U.esc(q.title) + "</h3>" +
          '<p class="muted" style="margin:0;font-size:14.5px">' + U.esc(q.body).replace(/\n/g, "<br>") + "</p>" +
          ((q.replies || []).length ? '<div class="replies">' + q.replies.map(function (r) {
            return '<div class="reply' + (r.isTeam ? " team" : "") + '"><div class="av">' + U.esc(r.isTeam ? "LD" : U.initials(r.author)) + "</div>" +
              '<div><div class="who">' + U.esc(r.author) + ' <span class="muted" style="font-weight:400">· ' + U.dateShort(r.date) + "</span>" +
              ' <button class="btn danger sm" data-act="del-reply" data-arg="' + U.esc(q.id + "|" + r.id) + '">✕</button></div>' +
              '<div class="txt">' + U.esc(r.body).replace(/\n/g, "<br>") + "</div></div></div>";
          }).join("") + "</div>" : "") +
          '<div class="field" style="margin-top:14px"><textarea class="team-reply" placeholder="Répondre en tant que rédaction…" rows="2"></textarea></div>' +
          '<div class="thread-foot">' +
          '<button class="btn accent sm" data-act="team-reply" data-arg="' + U.esc(q.id) + '">Répondre</button>' +
          '<button class="btn ghost sm" data-act="pin" data-arg="' + U.esc(q.id) + '">' + (q.pinned ? "Désépingler" : "Épingler") + "</button>" +
          '<button class="btn ghost sm" data-act="toggle-pub" data-arg="' + U.esc(q.id) + '">' +
          (q.status === "published" ? "Masquer" : "Publier") + "</button>" +
          '<button class="btn danger sm" data-act="del-question" data-arg="' + U.esc(q.id) + '">Supprimer</button>' +
          "</div></div>";
      }).join("") : '<p class="muted">Aucun sujet pour l\'instant.</p>');
  };

  views.data = function () {
    return head("Sauvegarde & restauration") +
      '<div class="panel"><h3 style="margin:0 0 8px;font-size:19px">Exporter</h3>' +
      '<p class="muted" style="font-size:14.5px;margin:0 0 16px">Télécharge tout le contenu du site dans un fichier JSON. ' +
      'Garde-le précieusement : c\'est ta sauvegarde. En mode local, c\'est aussi ce fichier qu\'il faut remettre dans <code>data/seed.js</code> pour publier tes modifications.</p>' +
      '<div class="chip-row"><button class="btn" data-act="export">Télécharger le JSON</button>' +
      '<button class="btn ghost" data-act="export-seed">Télécharger seed.js (pour mise en ligne)</button></div></div>' +
      '<div class="panel" style="margin-top:18px"><h3 style="margin:0 0 8px;font-size:19px">Importer</h3>' +
      '<p class="muted" style="font-size:14.5px;margin:0 0 16px">Remplace tout le contenu par un fichier JSON exporté précédemment.</p>' +
      '<input type="file" id="import-file" accept="application/json,.json,.js"></div>' +
      '<div class="panel" style="margin-top:18px"><h3 style="margin:0 0 8px;font-size:19px">Réinitialiser</h3>' +
      '<p class="muted" style="font-size:14.5px;margin:0 0 16px">Revient au contenu d\'origine livré avec le site. Irréversible en mode local.</p>' +
      '<button class="btn danger" data-act="reset">Réinitialiser le contenu</button></div>';
  };

  /* --------------------------------------------------------------- actions */
  var actions = {
    go: function (v) { switchView(v); },
    back: function () { editing = null; render(); },

    social: function () { S.content.settings.socials.push({ label: "Nouveau", url: "" }); touch(); },
    "social-del": function (i) { S.content.settings.socials.splice(+i, 1); touch(); },
    "social-up": function (i) { move(S.content.settings.socials, +i, -1); touch(); },
    "social-down": function (i) { move(S.content.settings.socials, +i, 1); touch(); },

    actu: function () { S.content.home.actus.unshift({ id: U.uid("a"), date: U.today(), title: "Nouvelle actu", text: "", url: "" }); touch(); },
    "actu-del": function (i) { S.content.home.actus.splice(+i, 1); touch(); },
    "actu-up": function (i) { move(S.content.home.actus, +i, -1); touch(); },
    "actu-down": function (i) { move(S.content.home.actus, +i, 1); touch(); },

    pick: function () { S.content.home.coupsDeCoeur.push({ id: U.uid("c"), artist: "", title: "", why: "", cover: "", listenUrl: "" }); touch(); },
    "pick-del": function (i) { S.content.home.coupsDeCoeur.splice(+i, 1); touch(); },
    "pick-up": function (i) { move(S.content.home.coupsDeCoeur, +i, -1); touch(); },
    "pick-down": function (i) { move(S.content.home.coupsDeCoeur, +i, 1); touch(); },

    rubrique: function () { S.content.home.rubriques.push({ id: U.uid("r"), name: "", desc: "" }); touch(); },
    "rubrique-del": function (i) { S.content.home.rubriques.splice(+i, 1); touch(); },
    "rubrique-up": function (i) { move(S.content.home.rubriques, +i, -1); touch(); },
    "rubrique-down": function (i) { move(S.content.home.rubriques, +i, 1); touch(); },

    stat: function () { S.content.histoire.stats.push({ id: U.uid("s"), value: "", label: "" }); touch(); },
    "stat-del": function (i) { S.content.histoire.stats.splice(+i, 1); touch(); },
    "stat-up": function (i) { move(S.content.histoire.stats, +i, -1); touch(); },
    "stat-down": function (i) { move(S.content.histoire.stats, +i, 1); touch(); },

    gal: function () {
      var h = S.content.histoire;
      h.gallery = h.gallery || [];
      h.gallery.push({ id: U.uid("g"), url: "", caption: "" });
      touch();
    },
    "gal-del": function (i) { S.content.histoire.gallery.splice(+i, 1); touch(); },
    "gal-up": function (i) { move(S.content.histoire.gallery, +i, -1); touch(); },
    "gal-down": function (i) { move(S.content.histoire.gallery, +i, 1); touch(); },

    tl: function () { S.content.histoire.timeline.push({ id: U.uid("t"), year: "", title: "", text: "" }); touch(); },
    "tl-del": function (i) { S.content.histoire.timeline.splice(+i, 1); touch(); },
    "tl-up": function (i) { move(S.content.histoire.timeline, +i, -1); touch(); },
    "tl-down": function (i) { move(S.content.histoire.timeline, +i, 1); touch(); },

    member: function () { S.content.histoire.members.push({ id: U.uid("m"), name: "", role: "", bio: "", photo: "", links: [] }); touch(); },
    "member-del": function (i) { S.content.histoire.members.splice(+i, 1); touch(); },
    "member-up": function (i) { move(S.content.histoire.members, +i, -1); touch(); },
    "member-down": function (i) { move(S.content.histoire.members, +i, 1); touch(); },
    "member-link": function (i) {
      var m = S.content.histoire.members[+i];
      m.links = m.links || []; m.links.push({ label: "Instagram", url: "" }); touch();
    },

    "new-article": function () {
      var a = {
        id: U.uid("art"), slug: "nouvel-article-" + Date.now().toString(36), title: "Nouvel article",
        kicker: "", excerpt: "", author: "La Dcouverte", date: U.today(), cover: "", tags: [],
        published: false, blocks: [{ id: U.uid("b"), type: "text", value: "" }]
      };
      S.content.articles.unshift(a);
      editing = 0; dirty(true); render();
    },
    "edit-article": function (i) { editing = +i; render(); },
    "dup-article": function (i) {
      var a = JSON.parse(JSON.stringify(S.content.articles[+i]));
      a.id = U.uid("art"); a.slug = a.slug + "-copie"; a.title = a.title + " (copie)"; a.published = false;
      S.content.articles.splice(+i + 1, 0, a); touch();
    },
    "del-article": function (i) {
      if (!confirm("Supprimer définitivement « " + S.content.articles[+i].title + " » ?")) return;
      S.content.articles.splice(+i, 1); touch();
    },

    block: function () {
      var a = S.content.articles[editing];
      a.blocks = a.blocks || [];
      a.blocks.push({ id: U.uid("b"), type: "text", value: "" });
      touch();
    },
    "block-del": function (j) { S.content.articles[editing].blocks.splice(+j, 1); touch(); },
    "block-up": function (j) { move(S.content.articles[editing].blocks, +j, -1); touch(); },
    "block-down": function (j) { move(S.content.articles[editing].blocks, +j, 1); touch(); },

    "new-question": function () {
      var title = prompt("Titre du sujet / de la question ?");
      if (!title) return;
      var body = prompt("Contenu (la réponse si c'est une FAQ) ?") || "";
      S.addQuestion({ category: (S.content.forum.categories || ["FAQ"])[0], author: S.content.settings.siteName, title: title, body: body })
        .then(loadQuestions).then(render).then(function () { U.toast("Sujet créé"); });
    },
    pin: function (id) {
      var q = questions.filter(function (x) { return x.id == id; })[0];
      S.updateQuestion(id, { pinned: !q.pinned }).then(loadQuestions).then(render);
    },
    "toggle-pub": function (id) {
      var q = questions.filter(function (x) { return x.id == id; })[0];
      S.updateQuestion(id, { status: q.status === "published" ? "hidden" : "published" }).then(loadQuestions).then(render);
    },
    "del-question": function (id) {
      if (!confirm("Supprimer ce sujet et ses réponses ?")) return;
      S.deleteQuestion(id).then(loadQuestions).then(render).then(function () { U.toast("Supprimé"); });
    },
    "del-reply": function (arg) {
      var p = arg.split("|");
      S.deleteReply(p[0], p[1]).then(loadQuestions).then(render);
    },
    "team-reply": function (id, btn) {
      var ta = btn.closest(".panel").querySelector(".team-reply");
      var body = ta.value.trim();
      if (!body) { U.toast("Écris ta réponse d'abord"); return; }
      S.addReply(id, { author: S.content.settings.siteName, body: body, isTeam: true })
        .then(loadQuestions).then(render).then(function () { U.toast("Réponse publiée"); });
    },

    export: function () { download("ladcouverte-contenu-" + U.today() + ".json", JSON.stringify(S.content, null, 2)); },
    "export-seed": function () { download("seed.js", "window.LAD_SEED = " + JSON.stringify(S.content, null, 2) + ";\n"); },
    reset: function () {
      if (!confirm("Tout réinitialiser ? Le contenu actuel sera perdu.")) return;
      S.reset();
      S.content = JSON.parse(JSON.stringify(window.LAD_SEED));
      S.saveContent().then(function () { U.toast("Contenu réinitialisé"); render(); });
    }
  };

  function touch() { dirty(true); render(); }
  function download(name, text) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ----------------------------------------------------------- rendu global */
  function render() {
    var el = document.getElementById("view");
    el.innerHTML = views[view]();
    bind(el);
    var sb = document.getElementById("save-btn");
    if (sb) { sb.onclick = save; dirty(isDirty); }

    // aperçus d'embeds dans l'éditeur d'article
    [].forEach.call(el.querySelectorAll("[data-prev]"), function (box) {
      var b = S.content.articles[editing].blocks[+box.dataset.prev];
      if (!b.value) { box.innerHTML = '<span class="muted" style="font-size:13px">Colle un lien pour voir l\'aperçu.</span>'; return; }
      box.innerHTML = b.type === "audio" ? LAD.embed.audio(b.value) : LAD.embed.video(b.value);
    });

    var imp = document.getElementById("import-file");
    if (imp) imp.onchange = function () {
      var f = this.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var txt = String(fr.result).replace(/^\s*window\.LAD_SEED\s*=\s*/, "").replace(/;\s*$/, "");
          S.content = JSON.parse(txt);
          S.saveContent().then(function () { U.toast("Contenu importé"); loadQuestions().then(render); });
        } catch (e) { U.toast("Fichier illisible"); }
      };
      fr.readAsText(f);
    };
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var fn = actions[b.dataset.act];
    if (fn) { e.preventDefault(); fn(b.dataset.arg, b); }
  });

  function switchView(v) {
    view = v; editing = null;
    [].forEach.call(document.querySelectorAll(".admin-side [data-view]"), function (b) {
      b.classList.toggle("on", b.dataset.view === v);
    });
    render();
  }

  function loadQuestions() {
    return S.getQuestions(true).then(function (rows) { questions = rows; });
  }

  /* ------------------------------------------------------------------ auth */
  function showApp() {
    document.getElementById("login").classList.add("hide");
    document.getElementById("shell").classList.remove("hide");
    if (S.needsSeed) isDirty = true;
    loadQuestions().then(function () { switchView("dashboard"); });
  }

  LAD.store.init().then(function () {
    LAD.applyTheme();
    LAD.renderNav("");
    document.getElementById("login-hint").textContent = S.remote
      ? "Connecte-toi avec l'email et le mot de passe de ton compte Supabase."
      : "Mode local : entre le mot de passe défini dans assets/js/config.js.";
    document.getElementById("email-field").classList.toggle("hide", !S.remote);

    document.querySelectorAll(".admin-side [data-view]").forEach(function (b) {
      b.onclick = function () { switchView(b.dataset.view); };
    });
    document.getElementById("logout").onclick = function () {
      S.logout(); location.reload();
    };
    document.getElementById("login-form").onsubmit = function (e) {
      e.preventDefault();
      var err = document.getElementById("login-err");
      err.classList.add("hide");
      S.login(document.getElementById("l-email").value.trim(), document.getElementById("l-pass").value)
        .then(showApp)
        .catch(function (ex) { err.textContent = ex.message; err.classList.remove("hide"); });
    };

    if (S.isLogged()) showApp();
    else document.getElementById("login").classList.remove("hide");
  });
})();
