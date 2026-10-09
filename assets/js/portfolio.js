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
  updateLogoLabel();
  document.dispatchEvent(new CustomEvent('portfolio-language-change'));
}
document
  .querySelector('.language')
  .addEventListener('click', () => applyLanguage(language === 'pl' ? 'en' : 'pl'));
applyLanguage(readPreference('portfolio-language') || 'pl');
function updateLogoLabel() {
  const mobile = matchMedia('(max-width: 760px)').matches;
  const label = mobile
    ? language === 'pl'
      ? 'Otwórz menu'
      : 'Open menu'
    : language === 'pl'
      ? 'Panel administratora'
      : 'Admin panel';
  menu.setAttribute('aria-label', label);
  menu.title = label;
  if (mobile) menu.setAttribute('aria-expanded', String(navbar.classList.contains('menu-open')));
  else menu.removeAttribute('aria-expanded');
}
function closeMenu() {
  navbar.classList.remove('menu-open');
  updateLogoLabel();
}
let lastLogoTap = null;
menu.addEventListener('click', (event) => {
  if (matchMedia('(max-width: 760px)').matches) {
    const now = performance.now();
    if (event.detail > 0 && lastLogoTap !== null && now - lastLogoTap < 450) {
      lastLogoTap = null;
      location.href = 'admin.html';
      return;
    }
    lastLogoTap = event.detail > 0 ? now : null;
    const open = navbar.classList.toggle('menu-open');
    menu.setAttribute('aria-expanded', String(open));
  } else {
    lastLogoTap = null;
    location.href = 'admin.html';
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
