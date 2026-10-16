const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sites = path.join(root, 'sites');
const output = path.join(sites, 'public');
const pages = ['index.html', 'about.html', 'knowledge.html', 'hobby.html', 'contact.html', 'admin.html', '404.html'];

function replaceRequired(source, pattern, replacement, label) {
  if (!source.match(pattern)) throw new Error(`Nie znaleziono miejsca adaptacji Sites: ${label}`);
  return source.replace(pattern, replacement);
}

function prepareSites() {
  // Only the generated output directory is replaced; never copy data/, .env or Git metadata.
  if (path.dirname(output) !== sites || fs.lstatSync(output, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error('Nieprawidłowy katalog generowanej strony.');
  }
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  for (const page of pages) fs.copyFileSync(path.join(root, page), path.join(output, page));
  fs.cpSync(path.join(root, 'assets'), path.join(output, 'assets'), { recursive: true });

  const edit = (relative, transform) => {
    const file = path.join(output, relative);
    fs.writeFileSync(file, transform(fs.readFileSync(file, 'utf8')));
  };
  edit('admin.html', (html) => {
    html = replaceRequired(html, /<form id="login-form">[\s\S]*?<\/form>/,
      '<form id="login-form" hidden><input name="username"><input name="password"><label id="confirm-password-label"><input name="confirmPassword"></label><button id="login-submit"></button></form><a class="admin-link" href="/signin-with-chatgpt?return_to=%2Fadmin.html" target="_top">Zaloguj przez ChatGPT ↗</a>', 'logowanie');
    return html.replace('Panel lokalny / Portfolio', 'Panel online / Portfolio')
      .replace(/Najnowsze 100 wiadomości\. Prywatne dane pozostają w lokalnej bazie i nie trafiają do\s+eksportu Git\./,
        'Najnowsze 100 wiadomości. Prywatne dane są przechowywane w bazie online i dostępne wyłącznie właścicielowi portfolio.');
  });
  edit('assets/js/admin.js', (js) => {
    js = replaceRequired(js, /  document.querySelector\('#auth-title'\).textContent = requiresSetup[\s\S]*?(?=\n}\nloginForm.addEventListener)/,
      "  document.querySelector('#auth-title').textContent = 'Panel właściciela';\n  document.querySelector('#auth-description').textContent = 'Zaloguj się kontem ChatGPT właściciela portfolio.';", 'opis logowania');
    js = replaceRequired(js, /document.querySelector\('#logout'\).addEventListener\('click', async \(\) => \{[\s\S]*?\n}\);/,
      "document.querySelector('#logout').addEventListener('click', () => { window.top.location.href = '/signout-with-chatgpt?return_to=%2Fadmin.html'; });", 'wylogowanie');
    return js.replaceAll('Plik zdjęcia pozostanie na dysku.', 'Plik zdjęcia pozostanie w magazynie online.')
      .replace('Zapisano w galerii i plikach do Git. Aby wysłać na GitHub, wykonaj commit i push.', 'Zapisano w galerii online. Zmiana jest już widoczna na stronie.');
  });
  edit('assets/js/admin-projects.js', (js) => js
    .replaceAll('Plik zdjęcia pozostanie na dysku.', 'Plik zdjęcia pozostanie w magazynie online.')
    .replace('Projekt zapisany na stronie i w plikach do Git.', 'Projekt zapisany online. Zmiana jest już widoczna na stronie.'));
  edit('assets/js/admin-messages.js', (js) => js.replace(
    'Skrzynka działa. Aby uruchomić powiadomienia e-mail, uzupełnij .env według CONTACT-MESSAGES.md i zrestartuj serwer.',
    'Skrzynka online działa. Powiadomienia e-mail wymagają konfiguracji usługi pocztowej w Sites.'));

  const seed = {};
  for (const [key, file, property] of [['photos', 'gallery-data.js', 'portfolioPhotos'], ['projects', 'projects-data.js', 'portfolioProjects']]) {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js', file), 'utf8'), sandbox);
    seed[key] = sandbox.window[property].filter((item) => key === 'projects' || item.src);
  }
  fs.writeFileSync(path.join(sites, 'lib/seed.json'), JSON.stringify(seed));
  const shared = fs.readFileSync(path.join(root, 'shared/normalize.cjs'), 'utf8');
  const normalizer = replaceRequired(shared, /module\.exports = \{ normalize, normalizeProject \};/,
    'export { normalize, normalizeProject };', 'wspólna walidacja');
  fs.writeFileSync(path.join(sites, 'lib/normalize.js'), normalizer);
  console.log('Sites przygotowane ze wspólnych plików. Bazy i prywatne pliki nie są kopiowane.');
}

if (require.main === module) prepareSites();
module.exports = { prepareSites, replaceRequired };
