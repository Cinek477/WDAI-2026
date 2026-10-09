const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { createGalleryServer } = require('../server.cjs');
test('Inbox: public submission, private access, notification failures, retry, persistence and rate limits', async (t) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-inbox-test-'));
  let failMail = false;
  const notifications = [];
  const options = {
    dataDir: path.join(temporary, 'data'),
    uploadDir: path.join(temporary, 'uploads'),
    exportFile: path.join(temporary, 'photos.js'),
    notifyMessage: async (item) => {
      if (failMail) throw new Error('Test mail failure');
      notifications.push(item);
    },
  };
  let server,
    base,
    cookie = '';
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
      headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
      body: input ? JSON.stringify(input) : undefined,
    });
  const request = () => ({
    email: 'visitor@example.com',
    category: 'photo',
    details: 'concert',
    message: 'Prywatna wiadomość testowa.',
    requestId: crypto.randomUUID(),
  });
  await start();
  assert.equal((await fetch(`${base}/api/messages`)).status, 401);
  assert.equal((await write('/api/contact', 'POST', request(), 'https://example.com')).status, 403);
  assert.equal((await write('/api/contact', 'POST', { ...request(), email: 'bad' })).status, 400);
  assert.equal(
    (await write('/api/contact', 'POST', { ...request(), details: 'wrong' })).status,
    400,
  );
  const first = request();
  const response = await write('/api/contact', 'POST', first);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal((await write('/api/contact', 'POST', first)).status, 200);
  assert.equal(notifications.length, 1);
  failMail = true;
  assert.equal((await write('/api/contact', 'POST', request())).status, 201);
  options.mailDisabled = true;
  assert.equal((await write('/api/contact', 'POST', request())).status, 201);
  const setup = await write('/api/auth/setup', 'POST', {
    username: 'admin',
    password: 'test-only-inbox-password',
  });
  cookie = setup.headers.get('set-cookie').split(';')[0];
  let inbox = await (await fetch(`${base}/api/messages`, { headers: { Cookie: cookie } })).json();
  assert.equal(inbox.unread, 3);
  assert.equal(inbox.mailConfigured, false);
  assert.deepEqual(
    new Set(inbox.items.map((item) => item.mail_status)),
    new Set(['sent', 'failed', 'not_configured']),
  );
  const failed = inbox.items.find((item) => item.mail_status === 'failed');
  assert.equal((await write(`/api/messages/${failed.id}/notify`, 'POST')).status, 409);
  failMail = false;
  options.mailDisabled = false;
  assert.equal((await write(`/api/messages/${failed.id}/notify`, 'POST')).status, 200);
  assert.equal(notifications.length, 2);
  assert.equal(
    (await write(`/api/messages/${first.requestId}`, 'PUT', { read: true })).status,
    200,
  );
  assert.equal((await write('/api/contact', 'POST', request())).status, 201);
  assert.equal((await write('/api/contact', 'POST', request())).status, 201);
  assert.equal((await write('/api/contact', 'POST', request())).status, 429);
  for (const file of [options.exportFile, path.join(options.dataDir, 'projects-data.js')])
    assert.ok(!fs.readFileSync(file, 'utf8').includes('visitor@example.com'));
  await stop();
  await start();
  assert.equal((await fetch(`${base}/api/messages`)).status, 401);
  const login = await write('/api/auth/login', 'POST', {
    username: 'admin',
    password: 'test-only-inbox-password',
  });
  cookie = login.headers.get('set-cookie').split(';')[0];
  inbox = await (await fetch(`${base}/api/messages`, { headers: { Cookie: cookie } })).json();
  assert.equal(inbox.items.length, 5);
  assert.equal(inbox.unread, 4);
});
