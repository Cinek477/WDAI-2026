const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const vm = require('node:vm');
const { createGalleryServer } = require('../server.cjs');

test('SQLite import, upload, edit, deletion, persistence and local access rules', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-db-test-'));
  const options = {
    dataDir: path.join(temporary, 'data'),
    uploadDir: path.join(temporary, 'uploads'),
    exportFile: path.join(temporary, 'gallery-data.js'),
  };
  function exportedPhotos() {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(options.exportFile, 'utf8'), sandbox);
    return JSON.parse(JSON.stringify(sandbox.window.portfolioPhotos));
  }
  let server;
  let base;
  let sessionCookie = '';
  const testPassword = 'test-only-password-123';
  async function start() {
    server = createGalleryServer(options);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
    const auth = await (await fetch(`${base}/api/auth/status`)).json();
    assert.equal(auth.authenticated, false);
    const denied = await fetch(`${base}/api/photos`, {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(denied.status, 401);
    const login = await fetch(`${base}/api/auth/${auth.requiresSetup ? 'setup' : 'login'}`, {
      method: 'POST',
      headers: { Origin: base, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: testPassword }),
    });
    assert.equal(login.status, auth.requiresSetup ? 201 : 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    sessionCookie = cookie.split(';')[0];
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
  await start();
  const initial = await (await fetch(`${base}/api/photos`)).json();
  assert.ok(initial.length >= 2);
  assert.deepEqual(exportedPhotos(), initial);
  assert.deepEqual(
    initial.slice(0, 2).map((photo) => photo.artist),
    ['Quebonafide', 'Mata'],
  );
  const photo = {
    title: 'Testowy kadr',
    category: 'concerts',
    shape: 'regular',
    date: '2026-10-09',
    venue: 'Park',
    city: 'Kraków',
    image:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOioAAAAASUVORK5CYII=',
    glowColor: '#ff1122',
  };
  const write = (url, method, value, origin = base) =>
    fetch(`${base}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: sessionCookie },
      body: value && JSON.stringify(value),
    });
  assert.equal((await write('/api/photos', 'POST', photo, 'http://example.com')).status, 403);
  assert.equal((await write('/api/auth/setup', 'POST', { password: testPassword })).status, 409);
  assert.equal(
    (await write('/api/auth/login', 'POST', { username: 'admin', password: 'wrong-password' }))
      .status,
    401,
  );
  assert.equal((await fetch(`${base}/data/gallery.sqlite`)).status, 404);
  assert.equal((await fetch(`${base}/.local/node.zip`)).status, 404);
  assert.equal((await fetch(`${base}/assets/css/lightbox.css`)).status, 200);
  assert.equal((await fetch(`${base}/assets/js/gallery.js`)).status, 200);
  assert.equal((await fetch(`${base}/invalid%zz`)).status, 400);
  assert.equal((await write('/api/photos', 'POST', [])).status, 400);
  assert.equal((await write('/api/photos', 'POST', { ...photo, date: '2026-02-31' })).status, 400);
  for (const category of ['nature', 'people', 'places']) {
    const response = await write('/api/photos', 'POST', {
      image: photo.image,
      category,
      instagram: category === 'people' ? 'https://www.instagram.com/47.cinek/' : '',
      venue: 'Tatry',
      artist: 'Nie dotyczy',
      date: '2026-02-31',
      description: 'Nie dotyczy',
    });
    assert.equal(response.status, 201);
    const simple = await response.json();
    assert.equal(simple.title.pl, 'Tatry');
    assert.equal(simple.place.pl, 'Tatry');
    assert.equal(simple.date, '');
    assert.equal(simple.artist, '');
    assert.equal(simple.instagram, category === 'people' ? '47.cinek' : '');
    assert.equal(
      exportedPhotos().find((item) => item.id === simple.id).instagram,
      simple.instagram,
    );
    if (category === 'people') {
      assert.equal(
        (
          await write(`/api/photos/${simple.id}`, 'PUT', {
            category,
            venue: 'Tatry',
            instagram: 'https://example.com/profile',
          })
        ).status,
        400,
      );
      const edited = await write(`/api/photos/${simple.id}`, 'PUT', {
        category,
        venue: 'Tatry',
        instagram: '@nowa.osoba',
      });
      assert.equal(edited.status, 200);
      assert.equal((await edited.json()).instagram, 'nowa.osoba');
    }
    assert.equal(simple.description.pl, 'Nie dotyczy');
    assert.equal(exportedPhotos().find((item) => item.id === simple.id).place.pl, 'Tatry');
    assert.equal((await write(`/api/photos/${simple.id}`, 'DELETE')).status, 200);
  }
  assert.equal(
    (await write('/api/photos', 'POST', { ...photo, image: 'data:image/png;base64,YmFk' })).status,
    400,
  );
  const createdResponse = await write('/api/photos', 'POST', photo);
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.date, '09.10.2026');
  assert.equal(created.glowColor, '#ff1122');
  assert.equal(exportedPhotos().length, initial.length + 1);
  assert.deepEqual(exportedPhotos()[initial.length], created);
  assert.equal(fs.readdirSync(path.join(options.uploadDir, 'gallery')).length, 4);
  const update = await write(`/api/photos/${created.id}`, 'PUT', {
    ...photo,
    title: 'Zmieniony tytuł',
    date: '2025-06-28',
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).title.pl, 'Zmieniony tytuł');
  assert.equal(exportedPhotos()[initial.length].title.pl, 'Zmieniony tytuł');
  await stop();
  await start();
  const persisted = await (await fetch(`${base}/api/photos`)).json();
  assert.equal(persisted.length, initial.length + 1);
  assert.equal(persisted[initial.length].title.pl, 'Zmieniony tytuł');
  for (const item of persisted)
    assert.equal((await write(`/api/photos/${item.id}`, 'DELETE')).status, 200);
  await stop();
  await start();
  assert.equal((await (await fetch(`${base}/api/photos`)).json()).length, 0);
  assert.deepEqual(exportedPhotos(), []);
  assert.equal(fs.readdirSync(path.join(options.uploadDir, 'gallery')).length, 4);
  assert.equal((await write('/api/auth/logout', 'POST')).status, 200);
  assert.equal((await write('/api/photos', 'POST', photo)).status, 401);
  assert.equal((await write('/api/photos/concert-1', 'PUT', photo)).status, 401);
  assert.equal((await write('/api/photos/concert-1', 'DELETE')).status, 401);
  for (let attempt = 0; attempt < 8; attempt++) {
    assert.equal(
      (await write('/api/auth/login', 'POST', { username: 'admin', password: 'wrong-password' }))
        .status,
      401,
    );
  }
  assert.equal(
    (await write('/api/auth/login', 'POST', { username: 'admin', password: testPassword })).status,
    429,
  );
});
