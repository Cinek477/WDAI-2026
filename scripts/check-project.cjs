const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');

const root = path.resolve(__dirname, '..');
const failures = [];
let checked = 0;
const pages = fs.readdirSync(root).filter((file) => file.endsWith('.html'));
for (const page of pages) {
  const markup = fs.readFileSync(path.join(root, page), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length) failures.push(`${page}: powtórzone id`);
  for (const [, reference] of markup.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(reference)) continue;
    const [file, anchor] = reference.split('#');
    const target = file
      ? path.resolve(root, decodeURIComponent(file.split('?')[0]))
      : path.join(root, page);
    if (!fs.existsSync(target)) {
      failures.push(`${page}: nie istnieje ${reference}`);
      continue;
    }
    if (anchor) {
      const targetMarkup = file ? fs.readFileSync(target, 'utf8') : markup;
      if (!targetMarkup.includes(`id="${anchor}"`))
        failures.push(`${page}: brak kotwicy ${reference}`);
    }
  }
  for (const [, target] of markup.matchAll(/\baria-controls="([^"]+)"/g)) {
    if (!ids.includes(target)) failures.push(`${page}: brak elementu aria-controls=${target}`);
  }
  if (!/<html\s+lang=/.test(markup) || !/<meta\s+[^>]*charset=/i.test(markup))
    failures.push(`${page}: brak języka lub kodowania`);
  checked++;
}
function validateScripts(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      validateScripts(file);
      continue;
    }
    if (!/\.(?:js|cjs)$/.test(file)) continue;
    try {
      const source = fs.readFileSync(file, 'utf8');
      new vm.Script(file.endsWith('.cjs') ? Module.wrap(source) : source, { filename: file });
      checked++;
    } catch (error) {
      failures.push(`${path.relative(root, file)}: ${error.message}`);
    }
  }
}
for (const directory of ['assets/js', 'scripts', 'tests'])
  validateScripts(path.join(root, directory));
for (const file of fs.readdirSync(root).filter((file) => file.endsWith('.cjs'))) {
  try {
    new vm.Script(Module.wrap(fs.readFileSync(path.join(root, file), 'utf8')));
    checked++;
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
  }
}
const data = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/gallery-data.js'), 'utf8'), data);
const photos = data.window.portfolioPhotos;
if (new Set(photos.map((photo) => photo.id)).size !== photos.length)
  failures.push('Powtórzone identyfikatory zdjęć.');
for (const photo of photos)
  if (photo.src && !fs.existsSync(path.join(root, photo.src)))
    failures.push(`Brak zdjęcia: ${photo.src}`);
try {
  const projectData = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, 'assets/js/projects-data.js'), 'utf8'),
    projectData,
  );
  const projects = projectData.window.portfolioProjects;
  if (!Array.isArray(projects)) throw new Error('Niepoprawny eksport projektów.');
  if (new Set(projects.map((project) => project.id)).size !== projects.length)
    failures.push('Powtórzone identyfikatory projektów.');
  for (const project of projects) {
    if (!['achievements', 'projects'].includes(project.section))
      failures.push(`Niepoprawna sekcja projektu: ${project.id}`);
    if (project.src && !fs.existsSync(path.join(root, project.src)))
      failures.push(`Brak zdjęcia projektu: ${project.src}`);
  }
} catch (error) {
  failures.push(error.message);
}
for (const file of ['package.json', '.prettierrc.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    failures.push(`${file}: ${error.message}`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`OK: ${checked} plików; składnia JS, odnośniki, kotwice i zdjęcia poprawne.`);
