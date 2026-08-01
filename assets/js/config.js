/* ==========================================================================
   La Dcouverte — configuration
   --------------------------------------------------------------------------
   MODE LOCAL (par défaut) : tout est stocké dans le navigateur. Parfait pour
   travailler le site, mais les modifications ne sont visibles que sur TON
   navigateur. Utilise Réglages > Exporter pour récupérer un fichier JSON.

   MODE EN LIGNE (recommandé) : crée un projet gratuit sur supabase.com, lance
   le script supabase.sql fourni, puis colle ci-dessous l'URL du projet et la
   clé "anon public" (Project Settings > API). À partir de là, les modifs de
   l'admin et les questions des visiteurs sont visibles par tout le monde.
   ========================================================================== */

window.LAD_CONFIG = {
  // --- Supabase : projet "ladcouverte" (org adrshitdesign, région Europe) ---
  // Cette clé est publiable : elle est faite pour être visible dans le
  // navigateur. Les droits d'écriture sont protégés par les politiques RLS.
  supabaseUrl: "https://pamblclzgkiqfkojnomp.supabase.co",
  supabaseAnonKey: "sb_publishable_x1sj3Pt-2ORlB1NGsf-CKw_imGdZmQI",

  // --- Accès admin en mode local uniquement ---
  // En mode Supabase, la connexion se fait avec l'email + mot de passe du
  // compte créé dans Supabase > Authentication > Users.
  localAdminPassword: "ladcouverte2026",

  // Modération : les questions des visiteurs sont-elles publiées directement ?
  autoPublishQuestions: true
};
