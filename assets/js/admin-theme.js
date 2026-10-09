(() => {
  const root = document.documentElement;
  const button = document.querySelector('.theme');
  let stored;
  try {
    stored = localStorage.getItem('portfolio-theme');
  } catch {}
  root.dataset.theme = ['light', 'dark'].includes(stored)
    ? stored
    : matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  const update = () => button.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  update();
  let running = false;
  button.addEventListener('click', async () => {
    if (running) return;
    const change = () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      update();
      try {
        localStorage.setItem('portfolio-theme', root.dataset.theme);
      } catch {}
    };
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      change();
      return;
    }
    running = true;
    const transition = document.startViewTransition(change);
    try {
      await transition.ready;
      await root.animate(
        {
          clipPath: [
            'circle(0px at 50% 0px)',
            `circle(${Math.ceil(Math.hypot(innerWidth / 2, innerHeight))}px at 50% 0px)`,
          ],
        },
        {
          duration: 1100,
          easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
          fill: 'forwards',
        },
      ).finished;
    } catch {
      transition.skipTransition();
    } finally {
      await transition.finished.catch(() => {});
      running = false;
    }
  });
})();
