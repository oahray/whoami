// Runs before the app so the first paint already has the saved theme.
(function () {
  try {
    var mode = localStorage.getItem('whoami_admin_theme') || 'system';
    var dark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.classList.add('dark');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#09090b');
    }
  } catch (e) {}
})();
