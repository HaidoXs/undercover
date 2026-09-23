/*
 * Appliqué avant le premier affichage (script bloquant dans <head>) : aucun flash du mauvais thème.
 * Choix explicite du joueur (localStorage), sinon préférence du système.
 */
(function () {
  var theme = 'light';
  try {
    var saved = window.localStorage.getItem('undercover.theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  } catch (e) {
    /* stockage indisponible : thème clair */
  }
  document.documentElement.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1a1512' : '#fff6e9');
})();
