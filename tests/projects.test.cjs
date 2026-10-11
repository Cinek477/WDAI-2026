const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { once } = require('node:events');
const { createGalleryServer } = require('../server.cjs');

test('Projects: authenticated CRUD, image replacement, export and persistence', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-projects-test-'));
  const options = {
    dataDir: path.join(temporary, 'data'),
    uploadDir: path.join(temporary, 'uploads'),
    exportFile: path.join(temporary, 'photos.js'),
    projectExportFile: path.join(temporary, 'projects.js'),
  };
  let server;
  let base;
  let cookie = '';
  async function start() {
    server = createGalleryServer(options);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    if (server.listening) {
      const closed = once(server, 'close');
      server.close();
      await closed;
    }
  }
  t.after(async () => {
    await stop();
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const write = (endpoint, method, input, origin = base) =>
    fetch(`${base}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
      body: input ? JSON.stringify(input) : undefined,
    });
  const exported = () => {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(options.projectExportFile, 'utf8'), sandbox);
    return JSON.parse(JSON.stringify(sandbox.window.portfolioProjects));
  };
  await start();
  const initial = await (await fetch(`${base}/api/projects`)).json();
  assert.ok(initial.length >= 3);
  assert.deepEqual(exported(), initial);
  const input = {
    section: 'projects',
    title: 'Testowy projekt',
    titleEn: 'Test project',
    summary: 'W budowie',
    description: 'Opis\nDruga linia',
    technologies: 'Java, SQL',
    link: 'https://github.com/example/project',
    year: 2026,
  };
  assert.equal((await write('/api/projects', 'POST', input)).status, 401);
  const auth = await write('/api/auth/setup', 'POST', {
    username: 'admin',
    password: 'test-only-project-password',
  });
  assert.equal(auth.status, 201);
  cookie = auth.headers.get('set-cookie').split(';')[0];
  assert.equal((await write('/api/projects', 'POST', input, 'https://example.com')).status, 403);
  assert.equal(
    (await write('/api/projects', 'POST', { ...input, link: 'javascript:alert(1)' })).status,
    400,
  );
  assert.equal((await write('/api/projects', 'POST', { ...input, title: '' })).status, 400);
  const response = await write('/api/projects', 'POST', input);
  assert.equal(response.status, 201);
  let project = await response.json();
  assert.equal(project.src, '');
  assert.equal(project.title.en, 'Test project');
  const image =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOioAAAAASUVORK5CYII=';
  const endpoint = `/api/projects/${project.id}`;
  const update = await write(endpoint, 'PUT', {
    ...input,
    title: 'Nowy tytuł',
    section: 'achievements',
    image,
    thumbnail: image,
  });
  assert.equal(update.status, 200);
  project = await update.json();
  assert.match(project.src, /^assets\/images\/projects\//);
  assert.match(project.thumbUrl, /_thumb\.png$/);
  assert.ok(
    fs.existsSync(
      path.join(options.uploadDir, 'projects', '800px', path.basename(project.thumbUrl)),
    ),
  );
  assert.ok(
    fs.existsSync(path.join(options.uploadDir, 'projects', '2400px', path.basename(project.src))),
  );
  assert.equal(exported().find((item) => item.id === project.id).title.pl, 'Nowy tytuł');
  const firstImage = project.src;
  project = await (await write(endpoint, 'PUT', { ...input, image, thumbnail: image })).json();
  assert.notEqual(project.src, firstImage);
  project = await (await write(endpoint, 'PUT', { ...input, removeImage: true })).json();
  assert.equal(project.src, '');
  assert.equal(project.thumbUrl, '');
  await stop();
  await start();
  const persisted = await (await fetch(`${base}/api/projects`)).json();
  assert.equal(persisted.find((item) => item.id === project.id).description.pl, input.description);
  assert.equal((await write(endpoint, 'DELETE')).status, 401);
  const login = await write('/api/auth/login', 'POST', {
    username: 'admin',
    password: 'test-only-project-password',
  });
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await write(endpoint, 'DELETE')).status, 200);
  assert.equal(exported().length, initial.length);
  assert.equal((await write(endpoint, 'PUT', input)).status, 404);
  assert.equal(
    fs
      .readdirSync(path.join(options.uploadDir, 'projects'), {
        recursive: true,
        withFileTypes: true,
      })
      .filter((entry) => entry.isFile()).length,
    4,
  );
});
