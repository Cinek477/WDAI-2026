const root = document.documentElement;
const navbar = document.querySelector('.navbar');
const menu = document.querySelector('.logo');
const themeButton = document.querySelector('.theme');
let language = 'pl';
function readPreference(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
function applyLanguage(value) {
  language = value === 'en' ? 'en' : 'pl';
  root.lang = language;
  document.querySelectorAll('[data-pl]').forEach((element) => {
    element.textContent = element.dataset[language];
  });
  document.querySelectorAll('[data-label-pl]').forEach((element) => {
    element.setAttribute('aria-label', element.dataset[language === 'pl' ? 'labelPl' : 'labelEn']);
  });
  document.querySelector('.language').innerHTML =
    `<span class="${language === 'pl' ? '' : 'inactive'}">PL</span> / <span class="${language === 'en' ? '' : 'inactive'}">EN</span>`;
  themeButton.setAttribute('aria-label', language === 'pl' ? 'Zmień motyw' : 'Change theme');
  const pageTitle = document.querySelector('[data-page-title]');
  document.title = `${pageTitle ? pageTitle.dataset[language] : 'Portfolio'} — Marcin Podyma`;
  savePreference('portfolio-language', language);
  document.dispatchEvent(new CustomEvent('portfolio-language-change'));
}
root.dataset.theme =
  readPreference('portfolio-theme') ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
themeButton.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
let themeTransitionRunning = false;
themeButton.addEventListener('click', async () => {
  if (themeTransitionRunning) return;
  const change = () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    themeButton.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
    savePreference('portfolio-theme', root.dataset.theme);
  };
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    change();
    return;
  }

  // Fala zaczyna się na górze ekranu i dociera do obu dolnych narożników.
  themeTransitionRunning = true;
  const radius = Math.ceil(Math.hypot(innerWidth / 2, innerHeight));
  const transition = document.startViewTransition(change);

  try {
    await transition.ready;
    const animation = root.animate(
      {
        clipPath: [`circle(0px at 50% 0px)`, `circle(${radius}px at 50% 0px)`],
      },
      {
        duration: 1100,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        pseudoElement: '::view-transition-new(root)',
        fill: 'forwards',
      },
    );
    await animation.finished;
  } catch {
    transition.skipTransition();
  } finally {
    await transition.finished.catch(() => {});
    themeTransitionRunning = false;
  }
});
document
  .querySelector('.language')
  .addEventListener('click', () => applyLanguage(language === 'pl' ? 'en' : 'pl'));
applyLanguage(readPreference('portfolio-language') || 'pl');
function closeMenu() {
  navbar.classList.remove('menu-open');
  menu.setAttribute('aria-expanded', 'false');
}
menu.addEventListener('click', () => {
  if (matchMedia('(max-width: 760px)').matches) {
    const open = navbar.classList.toggle('menu-open');
    menu.setAttribute('aria-expanded', String(open));
  } else {
    location.href = 'index.html';
  }
});
document
  .querySelectorAll('.navigation a')
  .forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});
document.addEventListener('click', (event) => {
  if (!navbar.contains(event.target)) closeMenu();
});
function updateScroll() {
  navbar.classList.toggle('scrolled', scrollY > 90);
}
addEventListener('scroll', updateScroll, { passive: true });
updateScroll();
matchMedia('(max-width: 760px)').addEventListener('change', closeMenu);
document.querySelectorAll('.card-toggle').forEach((button) =>
  button.addEventListener('click', () => {
    const card = button.closest('.card');
    const expanded = card.classList.toggle('expanded');
    button.setAttribute('aria-expanded', String(expanded));
  }),
);
