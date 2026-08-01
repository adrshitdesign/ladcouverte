/* ==========================================================================
   La Dcouverte — noyau : utilitaires, habillage, embeds, stockage
   ========================================================================== */

window.LAD = (function () {
  var CFG = window.LAD_CONFIG || {};
  var LS_CONTENT = "lad_content_v1";
  var LS_TOKEN = "lad_token";

  /* Stockage navigateur tolérant : certains contextes (fichier local ouvert en
     double-clic, navigation privée stricte) interdisent localStorage. On
     retombe alors sur une mémoire volatile plutôt que de casser la page. */
  function safeStorage(kind) {
    try {
      var s = window[kind];
      s.setItem("__lad_test", "1");
      s.removeItem("__lad_test");
      return s;
    } catch (e) {
      var m = {};
      return {
        getItem: function (k) { return k in m ? m[k] : null; },
        setItem: function (k, v) { m[k] = String(v); },
        removeItem: function (k) { delete m[k]; }
      };
    }
  }
  var localStorage = safeStorage("localStorage");
  var sessionStorage = safeStorage("sessionStorage");

  /* ---------------------------------------------------------------- utils */
  var util = {
    esc: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },
    uid: function (p) {
      return (p || "id") + "_" + Math.random().toString(36).slice(2, 9);
    },
    slugify: function (s) {
      return String(s || "")
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70) || "article";
    },
    date: function (iso) {
      if (!iso) return "";
      var d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    },
    dateShort: function (iso) {
      if (!iso) return "";
      var d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    },
    today: function () { return new Date().toISOString().slice(0, 10); },
    param: function (k) { return new URLSearchParams(location.search).get(k); },
    initials: function (name) {
      return String(name || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase();
    },
    nl2p: function (txt) {
      return String(txt || "").split(/\n{2,}/).filter(Boolean)
        .map(function (p) { return "<p>" + util.esc(p).replace(/\n/g, "<br>") + "</p>"; }).join("");
    },
    toast: function (msg) {
      var t = document.querySelector(".toast");
      if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
      t.textContent = msg;
      t.classList.add("show");
      clearTimeout(t._h);
      t._h = setTimeout(function () { t.classList.remove("show"); }, 2200);
    }
  };

  /* ----------------------------------------------------------------- logo */
  function mark(cls) {
    return '<svg class="' + (cls || "mark") + '" viewBox="0 0 64 64" fill="none" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="30" stroke="currentColor" stroke-width="2.5" opacity=".35"/>' +
      '<path d="M12 42h40l-6 10H18l-6-10Z" fill="currentColor"/>' +
      '<path d="M32 8v32M32 14l16 22H32M32 20L18 36h14" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>' +
      "</svg>";
  }

  /* --------------------------------------------------------------- embeds */
  var embed = {
    video: function (url) {
      var u = String(url || "").trim();
      if (!u) return "";
      var m;
      if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/)))
        return frame("https://www.youtube.com/embed/" + m[1], "video");
      if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
        return frame("https://player.vimeo.com/video/" + m[1], "video");
      if ((m = u.match(/dailymotion\.com\/video\/([\w]+)/)))
        return frame("https://www.dailymotion.com/embed/video/" + m[1], "video");
      if ((m = u.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/)))
        return frame("https://www.tiktok.com/embed/v2/" + m[1], "video");
      if (/\.(mp4|webm|mov)(\?|$)/i.test(u))
        return '<div class="embed video"><video controls playsinline src="' + util.esc(u) + '" style="width:100%;height:100%;object-fit:cover"></video></div>';
      return embed.link(u, "Voir la vidéo");
    },
    audio: function (url) {
      var u = String(url || "").trim();
      if (!u) return "";
      var m, tall = "";
      // Spotify
      if ((m = u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([\w]+)/))) {
        if (m[1] !== "track" && m[1] !== "episode") tall = " tall";
        return frame("https://open.spotify.com/embed/" + m[1] + "/" + m[2] + "?theme=0", "audio" + tall);
      }
      // Apple Music
      if (/music\.apple\.com/.test(u)) {
        var ap = u.replace(/^https?:\/\/music\.apple\.com/, "https://embed.music.apple.com");
        if (!/\/album\/[^/]+\/\d+\?i=/.test(u)) tall = " tall";
        return frame(ap, "audio" + tall);
      }
      // Deezer
      if ((m = u.match(/deezer\.com\/(?:[a-z]{2}\/)?(track|album|playlist|episode)\/(\d+)/))) {
        if (m[1] !== "track") tall = " tall";
        return frame("https://widget.deezer.com/widget/dark/" + m[1] + "/" + m[2], "audio" + tall);
      }
      // SoundCloud
      if (/soundcloud\.com/.test(u))
        return frame("https://w.soundcloud.com/player/?url=" + encodeURIComponent(u) + "&color=%23ff3b1f&visual=false", "audio");
      // Bandcamp / autres : lien
      return embed.link(u, "Écouter");
    },
    link: function (url, label) {
      var u = String(url || "").trim();
      if (!u) return "";
      var host = u.replace(/^https?:\/\//, "").split("/")[0];
      return '<a class="linkcard" href="' + util.esc(u) + '" target="_blank" rel="noopener">' +
        '<span class="ic">↗</span><span><span style="font-weight:600">' + util.esc(label || host) +
        '</span><br><span class="u">' + util.esc(u) + "</span></span></a>";
    }
  };
  function frame(src, cls) {
    return '<div class="embed ' + cls + '"><iframe src="' + util.esc(src) +
      '" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe></div>';
  }

  /* -------------------------------------------------------------- storage */
  var remote = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && typeof fetch === "function");

  function sbHeaders(auth) {
    var h = {
      apikey: CFG.supabaseAnonKey,
      "Content-Type": "application/json",
      Authorization: "Bearer " + ((auth && sessionStorage.getItem(LS_TOKEN)) || CFG.supabaseAnonKey)
    };
    return h;
  }
  function sb(path, opts) {
    opts = opts || {};
    return fetch(CFG.supabaseUrl.replace(/\/$/, "") + "/rest/v1/" + path, {
      method: opts.method || "GET",
      headers: Object.assign(sbHeaders(opts.auth), opts.headers || {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); });
      return r.status === 204 ? null : r.json();
    });
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  var store = {
    remote: remote,
    content: null,
    needsSeed: false,

    /* Charge le contenu : Supabase si configuré, sinon localStorage, sinon graine */
    init: function () {
      var seed = deepClone(window.LAD_SEED || {});
      if (remote) {
        return sb("site_content?id=eq.1&select=data")
          .then(function (rows) {
            var d = rows && rows[0] && rows[0].data;
            // Base encore vide (premier lancement) : on part du contenu livré
            // et on signale qu'un premier enregistrement est nécessaire.
            if (d && d.settings) { store.content = d; }
            else { store.content = seed; store.needsSeed = true; }
            return store.content;
          })
          .catch(function (e) {
            console.warn("Supabase indisponible, bascule en local :", e.message);
            store.remote = remote = false;
            return store.init();
          });
      }
      var raw = localStorage.getItem(LS_CONTENT);
      try { store.content = raw ? JSON.parse(raw) : seed; }
      catch (e) { store.content = seed; }
      return Promise.resolve(store.content);
    },

    saveContent: function () {
      if (remote) {
        return sb("site_content?id=eq.1", {
          method: "PATCH", auth: true,
          headers: { Prefer: "return=minimal" },
          body: { data: store.content, updated_at: new Date().toISOString() }
        });
      }
      localStorage.setItem(LS_CONTENT, JSON.stringify(store.content));
      return Promise.resolve();
    },

    reset: function () { localStorage.removeItem(LS_CONTENT); },

    /* ---------------------------------------------------------- questions */
    getQuestions: function (all) {
      if (remote) {
        return sb("forum_questions?select=*,forum_replies(*)&order=pinned.desc,created_at.desc")
          .then(function (rows) {
            return (rows || []).map(mapQ).filter(function (q) { return all || q.status === "published"; });
          })
          .catch(function () { return []; });
      }
      var list = ((store.content.forum || {}).questions || []).slice();
      list.sort(function (a, b) {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.date).localeCompare(String(a.date));
      });
      return Promise.resolve(all ? list : list.filter(function (q) { return q.status !== "hidden"; }));
    },

    addQuestion: function (q) {
      var status = CFG.autoPublishQuestions === false ? "pending" : "published";
      if (remote) {
        return sb("forum_questions", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: { category: q.category, author: q.author, title: q.title, body: q.body, status: status }
        }).then(function () { return status; });
      }
      store.content.forum.questions.unshift({
        id: util.uid("q"), category: q.category, author: q.author, title: q.title,
        body: q.body, date: util.today(), pinned: false, status: status, replies: []
      });
      return store.saveContent().then(function () { return status; });
    },

    addReply: function (qid, r) {
      if (remote) {
        return sb("forum_replies", {
          method: "POST", auth: !!r.isTeam,
          headers: { Prefer: "return=minimal" },
          body: { question_id: qid, author: r.author, body: r.body, is_team: !!r.isTeam }
        });
      }
      var q = findQ(qid);
      if (q) {
        q.replies = q.replies || [];
        q.replies.push({ id: util.uid("r"), author: r.author, body: r.body, date: util.today(), isTeam: !!r.isTeam });
      }
      return store.saveContent();
    },

    updateQuestion: function (qid, patch) {
      if (remote) {
        return sb("forum_questions?id=eq." + encodeURIComponent(qid), {
          method: "PATCH", auth: true, headers: { Prefer: "return=minimal" }, body: patch
        });
      }
      var q = findQ(qid);
      if (q) Object.assign(q, patch);
      return store.saveContent();
    },

    deleteQuestion: function (qid) {
      if (remote) {
        return sb("forum_questions?id=eq." + encodeURIComponent(qid), { method: "DELETE", auth: true });
      }
      var arr = store.content.forum.questions;
      var i = arr.findIndex(function (q) { return q.id === qid; });
      if (i > -1) arr.splice(i, 1);
      return store.saveContent();
    },

    deleteReply: function (qid, rid) {
      if (remote) {
        return sb("forum_replies?id=eq." + encodeURIComponent(rid), { method: "DELETE", auth: true });
      }
      var q = findQ(qid);
      if (q && q.replies) {
        var i = q.replies.findIndex(function (r) { return r.id === rid; });
        if (i > -1) q.replies.splice(i, 1);
      }
      return store.saveContent();
    },

    /* --------------------------------------------------------------- auth */
    login: function (email, password) {
      if (remote) {
        return fetch(CFG.supabaseUrl.replace(/\/$/, "") + "/auth/v1/token?grant_type=password", {
          method: "POST",
          headers: { apikey: CFG.supabaseAnonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (!d.access_token) throw new Error(d.error_description || d.msg || "Identifiants refusés");
          sessionStorage.setItem(LS_TOKEN, d.access_token);
          return true;
        });
      }
      if (password && password === CFG.localAdminPassword) {
        sessionStorage.setItem(LS_TOKEN, "local");
        return Promise.resolve(true);
      }
      return Promise.reject(new Error("Mot de passe incorrect"));
    },
    logout: function () { sessionStorage.removeItem(LS_TOKEN); },
    isLogged: function () { return !!sessionStorage.getItem(LS_TOKEN); }
  };

  function findQ(id) {
    return ((store.content.forum || {}).questions || []).find(function (q) { return q.id === id; });
  }
  function mapQ(row) {
    return {
      id: row.id, category: row.category, author: row.author, title: row.title, body: row.body,
      date: (row.created_at || "").slice(0, 10), pinned: !!row.pinned, status: row.status,
      replies: (row.forum_replies || []).map(function (r) {
        return { id: r.id, author: r.author, body: r.body, date: (r.created_at || "").slice(0, 10), isTeam: !!r.is_team };
      }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); })
    };
  }

  /* ------------------------------------------------------------- habillage */
  var NAV = [
    { href: "index.html", label: "Accueil" },
    { href: "articles.html", label: "Articles" },
    { href: "histoire.html", label: "Le média" },
    { href: "forum.html", label: "Blog & FAQ" }
  ];

  function applyTheme() {
    var s = (store.content && store.content.settings) || {};
    if (s.accent) document.documentElement.style.setProperty("--accent", s.accent);
    if (s.accent2) document.documentElement.style.setProperty("--accent-2", s.accent2);
    var title = document.querySelector("title");
    if (title && title.dataset.suffix !== "off") {
      title.textContent = title.textContent.replace(/La Dcouverte/g, s.siteName || "La Dcouverte");
    }
  }

  function brandHtml() {
    var s = (store.content && store.content.settings) || {};
    var inner = s.logoUrl
      ? '<img src="' + util.esc(s.logoUrl) + '" alt="' + util.esc(s.siteName || "") + '">'
      : mark("mark") + "<span>" + util.esc(s.siteName || "La Dcouverte") + "</span>";
    return '<a class="brand" href="index.html">' + inner + "</a>";
  }

  function renderNav(active) {
    var el = document.querySelector("[data-nav]");
    if (!el) return;
    el.className = "nav";
    el.innerHTML =
      '<div class="wrap nav-inner">' + brandHtml() +
      '<button class="nav-burger" aria-label="Menu">☰</button>' +
      '<nav class="nav-links">' +
      NAV.map(function (n) {
        return '<a href="' + n.href + '"' + (n.href === active ? ' class="active"' : "") + ">" + n.label + "</a>";
      }).join("") +
      '<a href="admin.html" style="border:1px solid var(--line)">Admin</a>' +
      "</nav></div>";
    var b = el.querySelector(".nav-burger");
    if (b) b.onclick = function () { el.querySelector(".nav-links").classList.toggle("open"); };
  }

  function renderFooter() {
    var el = document.querySelector("[data-footer]");
    if (!el) return;
    var s = (store.content && store.content.settings) || {};
    el.className = "footer";
    el.innerHTML =
      '<div class="wrap"><div class="footer-grid">' +
      '<div style="max-width:320px">' + brandHtml() +
      '<p class="muted" style="font-size:14px;margin-top:12px">' + util.esc(s.baseline || "") + "</p></div>" +
      '<div class="cols">' +
      '<div class="col"><strong>Le site</strong>' +
      NAV.map(function (n) { return '<a href="' + n.href + '">' + n.label + "</a>"; }).join("") + "</div>" +
      '<div class="col"><strong>Suivre</strong>' +
      (s.socials || []).map(function (x) {
        return '<a href="' + util.esc(x.url) + '" target="_blank" rel="noopener">' + util.esc(x.label) + "</a>";
      }).join("") + "</div>" +
      '<div class="col"><strong>Contact</strong><a href="mailto:' + util.esc(s.email || "") + '">' + util.esc(s.email || "") + "</a>" +
      '<a href="admin.html">Espace rédaction</a></div>' +
      "</div></div>" +
      '<div class="fine"><span>' + util.esc(s.footerNote || "") + "</span><span>© " + new Date().getFullYear() + " " + util.esc(s.siteName || "") + "</span></div>" +
      "</div>";
  }

  /* Démarrage commun à toutes les pages publiques */
  function boot(active, render) {
    return store.init().then(function () {
      applyTheme();
      renderNav(active);
      try { render && render(); } catch (e) { console.error(e); }
      renderFooter();
    });
  }

  return {
    util: util, embed: embed, store: store, mark: mark,
    boot: boot, renderNav: renderNav, renderFooter: renderFooter, applyTheme: applyTheme,
    articleUrl: function (a) { return "article.html?a=" + encodeURIComponent(a.slug || a.id); }
  };
})();
