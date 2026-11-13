// Runs before the app so the first paint already has the saved theme.
(function () {
  try {
    var mode = localStorage.getItem('whoami_theme') || 'system';
    var paletteColors = {
      blue: '#2b4bee',
      green: '#0e6b45',
      wine: '#7a2a3a',
      purple: '#4c2a9e'
    };
    var palette = localStorage.getItem('whoami_palette') || 'blue';
    if (!paletteColors[palette]) palette = 'blue';
    document.documentElement.setAttribute('data-palette', palette);
    var dark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (dark) {
      document.documentElement.classList.add('dark');
      if (meta) meta.setAttribute('content', '#101322');
    } else if (meta) {
      meta.setAttribute('content', paletteColors[palette]);
    }
  } catch (e) {}
})();
