/* ==========================================================================
   Test de rendu du site — npm install jsdom && node tests/render-test.js
   Les pages sont servies par un mini serveur HTTP et l'API Supabase est
   simulée, pour tester le mode en ligne sans toucher à la vraie base.
   ========================================================================== */
const { JSDOM, VirtualConsole } = require("jsdom");
const path = require("path");
const fs = require("fs");
const http = require("http");

const ROOT = path.resolve(__dirname, "..");
let failures = 0;

/* ---------------------------------------------------------- serveur local */
const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  fs.readFile(p, (err, buf) => {
    if (err) { res.writeHead(404); res.end("404"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "text/plain" });
    res.end(buf);
  });
});
const PORT = 8791;

/* ---------------------------------------------------- fausse API Supabase */
function makeFakeSupabase(state) {
  return function fakeFetch(url, opts) {
    opts = opts || {};
    const u = String(url);
    const method = opts.method || "GET";
    const body = opts.body ? JSON.parse(opts.body) : null;
    const json = (status, data) => Promise.resolve({
      ok: status < 400, status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data))
    });
    const empty = () => Promise.resolve({ ok: true, status: 204, text: () => Promise.resolve("") });

    if (state.offline) return Promise.reject(new Error("réseau indisponible"));
    state.calls.push(method + " " + u.replace(/^https?:\/\/[^/]+/, ""));

    if (/\/auth\/v1\/token/.test(u)) {
      return body && body.password === "bonmotdepasse"
        ? json(200, { access_token: "tok_test" })
        : json(400, { error_description: "Invalid login credentials" });
    }
    if (/site_content/.test(u)) {
      if (method === "PATCH") {
        const authed = String((opts.headers || {}).Authorization || "").includes("tok_test");
        if (!authed) return json(200, []);            // bloqué par RLS : 0 ligne
        state.content = body.data;
        return empty();
      }
      return json(200, [{ data: state.content }]);
    }
    if (/forum_questions/.test(u)) {
      const id = decodeURIComponent((u.split("id=eq.")[1] || "").split("&")[0]);
      if (method === "POST") {
        state.questions.unshift(Object.assign(
          { id: "q" + (state.questions.length + 1), created_at: new Date().toISOString(), pinned: false, forum_replies: [] },
          body));
        return empty();
      }
      if (method === "PATCH") { Object.assign(state.questions.find((q) => q.id === id) || {}, body); return empty(); }
      if (method === "DELETE") { state.questions = state.questions.filter((q) => q.id !== id); return empty(); }
      return json(200, state.questions);
    }
    if (/forum_replies/.test(u)) {
      if (method === "POST") {
        const q = state.questions.find((x) => x.id === body.question_id);
        if (q) (q.forum_replies = q.forum_replies || []).push(
          Object.assign({ id: "r" + Date.now(), created_at: new Date().toISOString() }, body));
        return empty();
      }
      return json(200, []);
    }
    return json(404, {});
  };
}

function load(page, query, state) {
  const vc = new VirtualConsole();
  const errors = [];
  const ignore = /fonts\.googleapis|fonts\.gstatic|Could not load link|Not implemented/;
  vc.on("jsdomError", (e) => { if (!ignore.test(e.message)) errors.push("jsdomError: " + e.message); });
  vc.on("error", (m) => { if (!ignore.test(String(m))) errors.push("console.error: " + m); });
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const dom = new JSDOM(html, {
    url: "http://localhost:" + PORT + "/" + page + (query || ""),
    runScripts: "dangerously",
    resources: "usable",
    virtualConsole: vc,
    pretendToBeVisual: true,
    beforeParse(window) { window.fetch = makeFakeSupabase(state); }
  });
  return new Promise((res) => setTimeout(() => res({ dom, errors }), 700));
}

function check(label, cond, extra) {
  if (cond) console.log("  ✓ " + label);
  else { console.log("  ✗ " + label + (extra ? " → " + extra : "")); failures++; }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const seed = JSON.parse(fs.readFileSync(path.join(ROOT, "data/content.json"), "utf8"));
function freshState(content) {
  return {
    content: content === undefined ? JSON.parse(JSON.stringify(seed)) : content,
    questions: (seed.forum.questions || []).map((q, i) => ({
      id: "q" + (i + 1), category: q.category, author: q.author, title: q.title, body: q.body,
      status: q.status, pinned: q.pinned, created_at: q.date + "T10:00:00Z",
      forum_replies: (q.replies || []).map((r, j) => ({
        id: "r" + i + "_" + j, author: r.author, body: r.body, is_team: r.isTeam, created_at: r.date + "T10:00:00Z"
      }))
    })),
    calls: []
  };
}

(async () => {
  await new Promise((r) => server.listen(PORT, r));

  /* ------------------------------------------- pages publiques (en ligne) */
  for (const p of ["index.html", "articles.html", "article.html", "histoire.html", "forum.html"]) {
    const q = p === "article.html" ? "?a=de-nouvelles-frontieres-sonores" : "";
    console.log("\n== " + p + q + "  [mode en ligne]");
    const state = freshState();
    const { dom, errors } = await load(p, q, state);
    const d = dom.window.document;
    const txt = d.body.textContent;
    check("aucune erreur JS", errors.length === 0, errors.join(" | "));
    check("mode Supabase actif", dom.window.LAD.store.remote === true);
    check("nav rendue", !!d.querySelector(".nav .brand"));
    check("footer rendu", !!d.querySelector(".footer .fine"));

    if (p === "index.html") {
      check("titre hero", txt.includes("La musique qu'on écoutera demain"));
      check("coups de cœur", txt.includes("Nia Archives"));
      check("actus", txt.includes("Nos actualités"));
      check("formats", txt.includes("Le Dbat"));
      check("article à la une", !!d.querySelector(".feature"));
    }
    if (p === "articles.html") {
      check("3 articles listés", d.querySelectorAll("#list .card").length === 3,
        d.querySelectorAll("#list .card").length + " trouvés");
      check("filtres rendus", d.querySelectorAll("#filters .chip").length >= 3);
    }
    if (p === "article.html") {
      check("titre article", txt.includes("De nouvelles frontières sonores"));
      check("sous-titres rendus", d.querySelectorAll(".article-body h2").length >= 4);
      const listen = d.querySelector(".article-body .linkcard");
      check("bloc d'écoute rendu", !!listen);
      check("lien d'écoute vers spotify", listen && /open\.spotify\.com/.test(listen.href), listen && listen.href);
      check("citation", !!d.querySelector("blockquote"));
    }
    if (p === "histoire.html") {
      check("frise complète", d.querySelectorAll(".tl-item").length === 6);
      check("membres", d.querySelectorAll(".member").length === 5);
      check("chiffres clés", d.querySelectorAll(".stat").length === 4);
    }
    if (p === "forum.html") {
      const w = dom.window;
      check("sujets chargés depuis la base", d.querySelectorAll(".thread").length === 3,
        d.querySelectorAll(".thread").length + " trouvés");
      check("réponse rédaction affichée", txt.includes("Rédaction"));
      d.querySelector("#f-title").value = "Question de test";
      d.querySelector("#f-body").value = "Corps de la question de test.";
      d.querySelector("#ask").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
      await wait(400);
      check("question envoyée à la base", state.questions.some((x) => x.title === "Question de test"));
      check("question affichée après envoi", d.body.textContent.includes("Question de test"));
      check("statut publié", (state.questions[0] || {}).status === "published");
      const th = d.querySelector(".thread");
      th.querySelector("[data-reply]").click();
      th.querySelector(".r-body").value = "Réponse d'un visiteur";
      th.querySelector("[data-send]").click();
      await wait(400);
      check("réponse visiteur enregistrée", JSON.stringify(state.questions).includes("Réponse d'un visiteur"));
      check("réponse visiteur non marquée rédaction", !state.questions.some((q2) =>
        (q2.forum_replies || []).some((r) => r.body === "Réponse d'un visiteur" && r.is_team)));
    }
    dom.window.close();
  }

  /* --------------------------------------------------- admin (en ligne) */
  console.log("\n== admin.html  [mode en ligne]");
  {
    const state = freshState();
    const { dom, errors } = await load("admin.html", "", state);
    const d = dom.window.document, w = dom.window;
    check("aucune erreur JS", errors.length === 0, errors.join(" | "));
    check("champ email affiché", !d.querySelector("#email-field").classList.contains("hide"));
    d.querySelector("#l-email").value = "redaction@ladcouverte.fr";
    d.querySelector("#l-pass").value = "mauvais";
    d.querySelector("#login-form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(300);
    check("mauvais mot de passe refusé", !d.querySelector("#login-err").classList.contains("hide"));
    check("interface encore verrouillée", d.querySelector("#shell").classList.contains("hide"));
    d.querySelector("#l-pass").value = "bonmotdepasse";
    d.querySelector("#login-form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(400);
    check("connexion acceptée", !d.querySelector("#shell").classList.contains("hide"));
    check("statut « En ligne » affiché", d.body.textContent.includes("En ligne (Supabase)"));

    for (const v of ["home", "articles", "histoire", "forum", "settings", "data"]) {
      d.querySelector('[data-view="' + v + '"]').click();
      await wait(150);
      check("vue " + v + " rendue", !!d.querySelector("#save-btn"));
    }

    d.querySelector('[data-view="articles"]').click();
    await wait(150);
    d.querySelector('[data-act="edit-article"]').click();
    await wait(200);
    check("éditeur d'article ouvert", d.body.textContent.includes("Contenu de l'article"));
    const input = d.querySelector('[data-path="articles.0.title"]');
    input.value = "Titre modifié";
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
    check("binding du titre", w.LAD.store.content.articles[0].title === "Titre modifié");
    d.querySelector("#save-btn").click();
    await wait(400);
    check("enregistré dans la base", state.content.articles[0].title === "Titre modifié");
    check("PATCH authentifié envoyé", state.calls.some((c) => c.indexOf("PATCH /rest/v1/site_content") === 0));

    d.querySelector('[data-view="forum"]').click();
    await wait(250);
    d.querySelector(".team-reply").value = "Réponse officielle";
    d.querySelector('[data-act="team-reply"]').click();
    await wait(400);
    check("réponse rédaction marquée is_team", state.questions.some((q2) =>
      (q2.forum_replies || []).some((r) => r.body === "Réponse officielle" && r.is_team)));
    const firstId = d.querySelector('[data-act="pin"]').dataset.arg;
    const q0 = () => state.questions.find((q2) => q2.id === firstId) || {};
    const pinnedBefore = q0().pinned;
    d.querySelector('[data-act="toggle-pub"][data-arg="' + firstId + '"]').click();
    await wait(400);
    check("masquage d'un sujet", q0().status === "hidden", q0().status);
    d.querySelector('[data-act="pin"][data-arg="' + firstId + '"]').click();
    await wait(400);
    check("bascule de l'épinglage", q0().pinned === !pinnedBefore, "avant " + pinnedBefore + ", après " + q0().pinned);
    d.querySelector('[data-act="toggle-pub"][data-arg="' + firstId + '"]').click();
    await wait(400);
    check("republication d'un sujet", q0().status === "published", q0().status);
    const nb = state.questions.length;
    w.confirm = () => true;
    d.querySelector('[data-act="del-question"]').click();
    await wait(400);
    check("suppression d'un sujet", state.questions.length === nb - 1);
    dom.window.close();
  }

  /* ---------------------------- base vide : premier envoi du contenu */
  console.log("\n== admin.html  [base vide]");
  {
    const state = freshState({});
    const { dom } = await load("admin.html", "", state);
    const d = dom.window.document, w = dom.window;
    check("contenu de secours chargé", !!w.LAD.store.content.settings);
    check("initialisation signalée", w.LAD.store.needsSeed === true);
    d.querySelector("#l-email").value = "redaction@ladcouverte.fr";
    d.querySelector("#l-pass").value = "bonmotdepasse";
    d.querySelector("#login-form").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(400);
    check("message de première mise en ligne", d.body.textContent.includes("Première mise en ligne"));
    check("bouton d'enregistrement déjà actif", !d.querySelector("#save-btn").disabled);
    d.querySelector("#save-btn").click();
    await wait(400);
    check("contenu envoyé dans la base", !!state.content.settings && state.content.articles.length === 3);
    dom.window.close();
  }

  /* --------------------------------- repli automatique en mode local */
  console.log("\n== repli hors ligne");
  {
    const state = freshState();
    state.offline = true;
    const { dom, errors } = await load("index.html", "", state);
    const d = dom.window.document;
    check("aucune erreur bloquante", errors.length === 0, errors.join(" | "));
    check("bascule en mode local", dom.window.LAD.store.remote === false);
    check("page tout de même rendue", d.body.textContent.includes("Nia Archives"));
    dom.window.close();
  }

  /* ------------------------------------------------ widgets d'écoute */
  console.log("\n== embeds");
  const { dom } = await load("index.html", "", freshState());
  const E = dom.window.LAD.embed;
  [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "video", "youtube.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/abc123XYZ", "video", "youtube.com/embed/abc123XYZ"],
    ["https://vimeo.com/76979871", "video", "player.vimeo.com/video/76979871"],
    ["https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", "audio", "open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT"],
    ["https://open.spotify.com/intl-fr/album/1abc", "audio", "open.spotify.com/embed/album/1abc"],
    ["https://music.apple.com/fr/album/x/123?i=456", "audio", "embed.music.apple.com/fr/album/x/123"],
    ["https://www.deezer.com/fr/track/3135556", "audio", "widget.deezer.com/widget/dark/track/3135556"],
    ["https://www.deezer.com/album/302127", "audio", "widget.deezer.com/widget/dark/album/302127"],
    ["https://soundcloud.com/user/track", "audio", "w.soundcloud.com/player"],
    ["https://www.tiktok.com/@user/video/7212345678901234567", "video", "tiktok.com/embed/v2/7212345678901234567"],
    ["https://cdn.example.com/clip.mp4", "video", "<video"],
    ["https://bandcamp.com/album/x", "audio", "linkcard"]
  ].forEach(([url, kind, expect]) => {
    const out = kind === "video" ? E.video(url) : E.audio(url);
    check(kind + " " + url.slice(0, 46), out.includes(expect), out.slice(0, 110));
  });
  check("slugify accents", dom.window.LAD.util.slugify("Été à Paris — n°2") === "ete-a-paris-n-2",
    dom.window.LAD.util.slugify("Été à Paris — n°2"));
  check("échappement XSS", dom.window.LAD.util.esc("<img src=x onerror=1>") === "&lt;img src=x onerror=1&gt;");
  dom.window.close();

  console.log("\n" + (failures ? "❌ " + failures + " test(s) en échec" : "✅ tous les tests passent"));
  server.close();
  process.exit(failures ? 1 : 0);
})();
