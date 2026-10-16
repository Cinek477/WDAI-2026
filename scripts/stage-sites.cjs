const fs = require('node:fs');
const path = require('node:path');
const { prepareSites } = require('./prepare-sites.cjs');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'sites');
const [flag, target, ...extra] = process.argv.slice(2);
if (flag !== '--checkout' || !target || extra.length || !path.isAbsolute(target)) {
  throw new Error('Użycie: node scripts/stage-sites.cjs --checkout ABSOLUTNY_KATALOG_REPOZYTORIUM_SITES');
}
const destination = fs.realpathSync(target);
if (destination === root || destination === source || destination.startsWith(source + path.sep)) {
  throw new Error('Wskaż osobny checkout Sites, nie główne repozytorium ani sites/.');
}
const expected = JSON.parse(fs.readFileSync(path.join(source, '.openai/hosting.json'), 'utf8'));
const existing = JSON.parse(fs.readFileSync(path.join(destination, '.openai/hosting.json'), 'utf8'));
if (expected.project_id !== existing.project_id || !fs.existsSync(path.join(destination, '.git'))) {
  throw new Error('Checkout nie należy do tej strony Sites. Otwórz go najpierw przez workflow Sites.');
}
prepareSites();
// Exact allowlist: no credentials, local databases, dependency folders or runtime state.
const entries = ['.openai', 'app', 'build', 'components', 'db', 'drizzle', 'hooks', 'lib', 'public', 'scripts', 'vendor',
  '.gitignore', '.npmrc', 'api.test.mjs', 'cloudflare-env.d.ts', 'components.json', 'drizzle.config.ts',
  'eslint.config.mjs', 'next.config.ts', 'package-lock.json', 'package.json', 'postcss.config.mjs', 'README.md',
  'tsconfig.json', 'vite.config.ts'];
for (const entry of entries) {
  const file = path.join(source, entry);
  const output = path.join(destination, entry);
  if (fs.lstatSync(output, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Dowiązanie w checkout: ${entry}`);
  // Replace owned source directories so deleted assets and routes cannot survive publication.
  if (fs.statSync(file).isDirectory()) fs.rmSync(output, { recursive: true, force: true });
  fs.cpSync(file, output, { recursive: true });
}
// The standalone Sites repository must track the prepared build inputs.
const ignorePath = path.join(destination, '.gitignore');
fs.writeFileSync(ignorePath, fs.readFileSync(ignorePath, 'utf8')
  .replace(/^\/public\/\r?\n/gm, '')
  .replace(/^\/lib\/(?:normalize\.js|seed\.json)\r?\n/gm, ''));
console.log('Źródła przekazane do osobnego repozytorium Sites. Następnie wykonaj build i workflow publikacji.');
