const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const CATEGORIES = new Set(['concerts', 'nature', 'people', 'places']);
const MAX_BODY = 32 * 1024 * 1024;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function createGalleryServer(options = {}) {
  const dataDir = options.dataDir || path.join(ROOT, 'data');
  const uploadDir = options.uploadDir || path.join(ROOT, 'assets', 'uploads');
  const exportFile = options.exportFile || path.join(ROOT, 'assets/js/gallery-data.js');
  const projectExportFile =
    options.projectExportFile ||
    (options.dataDir
      ? path.join(dataDir, 'projects-data.js')
      : path.join(ROOT, 'assets/js/projects-data.js'));
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'gallery.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, category TEXT NOT NULL, data TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, data TEXT NOT NULL, position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  const insert = db.prepare(
    'INSERT INTO photos (id, category, data, position) VALUES (?, ?, ?, ?)',
  );
  if (!db.prepare("SELECT value FROM settings WHERE key='imported'").get()) {
    const sandbox = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(ROOT, 'assets/js/gallery-data.js'), 'utf8'),
      sandbox,
    );
    db.exec('BEGIN');
    try {
      sandbox.window.portfolioPhotos
        .filter((photo) => photo.src)
        .forEach((photo, index) =>
          insert.run(photo.id, photo.category, JSON.stringify(photo), index),
        );
      db.prepare("INSERT INTO settings VALUES ('imported', '1')").run();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  if (!db.prepare("SELECT value FROM settings WHERE key='projects-imported'").get()) {
    const sandbox = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(ROOT, 'assets/js/projects-data.js'), 'utf8'),
      sandbox,
    );
    db.exec('BEGIN');
    try {
      sandbox.window.portfolioProjects.forEach((project, position) =>
        db
          .prepare('INSERT INTO projects VALUES (?, ?, ?)')
          .run(project.id, JSON.stringify(project), position),
      );
      db.prepare("INSERT INTO settings VALUES ('projects-imported', '1')").run();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  function exportGallery() {
    const photos = db
      .prepare('SELECT data FROM photos ORDER BY position')
      .all()
      .map((row) => JSON.parse(row.data));
    const content =
      '// Eksport z panelu galerii. Opisy edytuj przez admin.html.\n' +
      `window.portfolioPhotos = ${JSON.stringify(photos, null, 2)};\n`;
    fs.mkdirSync(path.dirname(exportFile), { recursive: true });
    const temporaryFile = `${exportFile}.tmp`;
    fs.writeFileSync(temporaryFile, content, 'utf8');
    fs.renameSync(temporaryFile, exportFile);
    const projects = db
      .prepare('SELECT data FROM projects ORDER BY position')
      .all()
      .map((row) => JSON.parse(row.data));
    fs.mkdirSync(path.dirname(projectExportFile), { recursive: true });
    fs.writeFileSync(
      `${projectExportFile}.tmp`,
      `// Eksport projektów z panelu administratora.\nwindow.portfolioProjects = ${JSON.stringify(projects, null, 2)};\n`,
      'utf8',
    );
    fs.renameSync(`${projectExportFile}.tmp`, projectExportFile);
  }
  function mutateGallery(operation) {
    db.exec('BEGIN');
    try {
      operation();
      exportGallery();
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      exportGallery();
      throw error;
    }
  }
  exportGallery();

  const sessions = new Map();
  const attempts = new Map();
  const sessionDuration = 8 * 60 * 60 * 1000;
  const credentials = () => {
    const row = db.prepare("SELECT value FROM settings WHERE key='admin-auth'").get();
    return row ? JSON.parse(row.value) : null;
  };
  function sessionToken(req) {
    return req.headers.cookie?.match(/(?:^|;\s*)gallery_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  }
  function authenticated(req) {
    const token = sessionToken(req);
    const expires = sessions.get(token);
    if (!expires || expires <= Date.now()) {
      if (token) sessions.delete(token);
      return false;
    }
    return true;
  }
  function createSession(req, res) {
    const old = sessionToken(req);
    if (old) sessions.delete(old);
    for (const [token, expires] of sessions) if (expires <= Date.now()) sessions.delete(token);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + sessionDuration);
    res.setHeader(
      'Set-Cookie',
      `gallery_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDuration / 1000}`,
    );
  }
  function passwordFrom(input) {
    if (
      !input ||
      typeof input.password !== 'string' ||
      input.password.length < 10 ||
      input.password.length > 128
    ) {
      throw Object.assign(new Error('Hasło musi mieć od 10 do 128 znaków.'), { status: 400 });
    }
    return input.password;
  }

  function json(res, status, value) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(value));
  }
  async function body(req, limit = MAX_BODY) {
    if (!(req.headers['content-type'] || '').startsWith('application/json'))
      throw Object.assign(new Error('Wymagany JSON.'), { status: 415 });
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit)
        throw Object.assign(new Error('Plik jest za duży (limit żądania: 32 MB).'), {
          status: 413,
        });
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw Object.assign(new Error('Niepoprawne dane JSON.'), { status: 400 });
    }
  }
  function string(value, name, limit = 500) {
    if (typeof value !== 'string' || value.length > limit)
      throw Object.assign(new Error(`Niepoprawne pole: ${name}.`), { status: 400 });
    return value.trim();
  }
  function normalize(input, old = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw Object.assign(new Error('Dane zdjęcia muszą być obiektem JSON.'), { status: 400 });
    }
    const photo = { ...old };
    photo.category = string(input.category, 'kategoria');
    if (!CATEGORIES.has(photo.category))
      throw Object.assign(new Error('Nieznana kategoria.'), { status: 400 });
    photo.shape = ['tall', 'wide', 'regular'].includes(input.shape) ? input.shape : 'regular';
    for (const field of ['title', 'artist', 'event', 'venue', 'city', 'description']) {
      const value = string(input[field] || '', field, field === 'description' ? 2000 : 500);
      photo[field] = ['title', 'event', 'city', 'description'].includes(field)
        ? {
            pl: value,
            en: string(
              input[`${field}En`] || value,
              `${field} EN`,
              field === 'description' ? 2000 : 500,
            ),
          }
        : value;
    }
    const concert = photo.category === 'concerts';
    if (!concert) {
      if (!photo.venue) throw Object.assign(new Error('Podaj miejsce zdjęcia.'), { status: 400 });
      photo.artist = '';
      photo.event = { pl: '', en: '' };
    }
    if (concert && !photo.title.pl)
      throw Object.assign(new Error('Podaj tytuł zdjęcia.'), { status: 400 });
    const date = concert ? string(input.date || '', 'data') : '';
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw Object.assign(new Error('Niepoprawna data.'), { status: 400 });
    if (
      date &&
      (Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw Object.assign(new Error('Niepoprawna data.'), { status: 400 });
    photo.date = date ? date.split('-').reverse().join('.') : '';
    photo.place = {
      pl: [photo.venue, photo.city.pl].filter(Boolean).join(' - '),
      en: [photo.venue, photo.city.en].filter(Boolean).join(' - '),
    };
    if (!concert && !photo.title.pl) photo.title = { ...photo.place };
    if (input.glowColor && /^#[0-9a-f]{6}$/i.test(input.glowColor))
      photo.glowColor = input.glowColor;
    return photo;
  }
  function storeImage(dataUrl) {
    const match =
      typeof dataUrl === 'string' &&
      dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match)
      throw Object.assign(new Error('Dozwolone zdjęcia: JPG, PNG, WebP.'), { status: 400 });
    const bytes = Buffer.from(match[2], 'base64');
    const valid =
      match[1] === 'jpeg'
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : match[1] === 'png'
          ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.subarray(0, 4).toString() === 'RIFF' &&
            bytes.subarray(8, 12).toString() === 'WEBP';
    if (!valid || bytes.length > 20 * 1024 * 1024)
      throw Object.assign(new Error('Niepoprawny obraz lub plik większy niż 20 MB.'), {
        status: 400,
      });
    const name = `${crypto.randomUUID()}.${match[1] === 'jpeg' ? 'jpg' : match[1]}`;
    fs.writeFileSync(path.join(uploadDir, name), bytes, { flag: 'wx' });
    return { src: `assets/uploads/${name}`, file: path.join(uploadDir, name) };
  }
  function normalizeProject(input, old = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw Object.assign(new Error('Niepoprawne dane projektu.'), { status: 400 });
    const project = { ...old };
    project.section = input.section;
    if (!['achievements', 'projects'].includes(project.section))
      throw Object.assign(new Error('Wybierz sekcję projektu.'), { status: 400 });
    for (const key of ['title', 'summary', 'description']) {
      const pl = string(input[key] || '', key, key === 'description' ? 5000 : 500);
      project[key] = {
        pl,
        en: string(input[`${key}En`] || pl, `${key} EN`, key === 'description' ? 5000 : 500),
      };
    }
    if (!project.title.pl) throw Object.assign(new Error('Podaj tytuł projektu.'), { status: 400 });
    project.technologies = string(input.technologies || '', 'technologie');
    project.symbol = string(input.symbol || '↗', 'symbol', 20);
    project.year = Number(input.year || new Date().getFullYear());
    if (!Number.isInteger(project.year) || project.year < 1900 || project.year > 2100)
      throw Object.assign(new Error('Niepoprawny rok.'), { status: 400 });
    project.link = string(input.link || '', 'link', 2000);
    if (
      project.link &&
      !/^https?:\/\/[^\s]+$/i.test(project.link) &&
      !/^(?:contact\.html|#projects)$/.test(project.link)
    )
      throw Object.assign(new Error('Podaj link HTTP/HTTPS.'), { status: 400 });
    project.src = input.removeImage ? '' : old.src || '';
    return project;
  }
  const inbox = require('./inbox.cjs').createInbox({ db, json, body, authenticated, options });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        return json(res, 400, { error: 'Niepoprawny adres.' });
      }
      if (pathname.startsWith('/api/')) {
        if (req.method !== 'GET') {
          const allowed = new Set([
            `http://localhost:${server.address().port}`,
            `http://127.0.0.1:${server.address().port}`,
          ]);
          if (!allowed.has(req.headers.origin))
            return json(res, 403, { error: 'Otwórz panel z lokalnego adresu serwera.' });
        }
        if (await inbox(req, res, pathname)) return;
        if (pathname === '/api/auth/status' && req.method === 'GET') {
          return json(res, 200, {
            authenticated: authenticated(req),
            requiresSetup: !credentials(),
          });
        }
        if (pathname === '/api/auth/setup' && req.method === 'POST') {
          if (credentials()) return json(res, 409, { error: 'Konto administratora już istnieje.' });
          const input = await body(req);
          const password = passwordFrom(input);
          const salt = crypto.randomBytes(32).toString('hex');
          const hash = (await scrypt(password, salt, 64)).toString('hex');
          if (credentials()) return json(res, 409, { error: 'Konto administratora już istnieje.' });
          db.prepare("INSERT INTO settings (key, value) VALUES ('admin-auth', ?)").run(
            JSON.stringify({ salt, hash }),
          );
          createSession(req, res);
          return json(res, 201, { authenticated: true });
        }
        if (pathname === '/api/auth/login' && req.method === 'POST') {
          const key = req.socket.remoteAddress;
          let attempt = attempts.get(key);
          if (!attempt || attempt.until < Date.now())
            attempt = { count: 0, until: Date.now() + 15 * 60 * 1000 };
          if (attempt.count >= 8)
            return json(res, 429, {
              error: 'Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.',
            });
          attempts.set(key, attempt);
          attempt.count++;
          const input = await body(req);
          const stored = credentials();
          if (!stored) return json(res, 409, { error: 'Najpierw ustaw hasło administratora.' });
          const password =
            typeof input?.password === 'string' && input.password.length <= 128
              ? input.password
              : '';
          const hash = await scrypt(password, stored.salt, 64);
          if (
            input?.username !== 'admin' ||
            !crypto.timingSafeEqual(hash, Buffer.from(stored.hash, 'hex'))
          ) {
            return json(res, 401, { error: 'Niepoprawny login lub hasło.' });
          }
          attempts.delete(key);
          createSession(req, res);
          return json(res, 200, { authenticated: true });
        }
        if (pathname === '/api/auth/logout' && req.method === 'POST') {
          sessions.delete(sessionToken(req));
          res.setHeader(
            'Set-Cookie',
            'gallery_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
          );
          return json(res, 200, { authenticated: false });
        }
        if (req.method !== 'GET' && !authenticated(req)) {
          return json(res, 401, { error: 'Zaloguj się do panelu administratora.' });
        }
        if (pathname === '/api/projects' && req.method === 'GET')
          return json(
            res,
            200,
            db
              .prepare('SELECT data FROM projects ORDER BY position')
              .all()
              .map((row) => JSON.parse(row.data)),
          );
        const projectId = pathname.match(/^\/api\/projects\/([\w-]+)$/)?.[1];
        if (
          (pathname === '/api/projects' && req.method === 'POST') ||
          (projectId && ['PUT', 'DELETE'].includes(req.method))
        ) {
          const row = projectId
            ? db.prepare('SELECT data FROM projects WHERE id=?').get(projectId)
            : null;
          if (projectId && !row) return json(res, 404, { error: 'Nie znaleziono projektu.' });
          if (req.method === 'DELETE') {
            mutateGallery(() => db.prepare('DELETE FROM projects WHERE id=?').run(projectId));
            return json(res, 200, { ok: true });
          }
          const input = await body(req);
          const project = normalizeProject(input, row ? JSON.parse(row.data) : {});
          project.id = projectId || crypto.randomUUID();
          const upload = input.image ? storeImage(input.image) : null;
          if (upload) project.src = upload.src;
          try {
            mutateGallery(() => {
              if (row)
                db.prepare('UPDATE projects SET data=? WHERE id=?').run(
                  JSON.stringify(project),
                  project.id,
                );
              else
                db.prepare('INSERT INTO projects VALUES (?, ?, ?)').run(
                  project.id,
                  JSON.stringify(project),
                  db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM projects').get()
                    .next,
                );
            });
          } catch (error) {
            if (upload) fs.unlinkSync(upload.file);
            throw error;
          }
          return json(res, row ? 200 : 201, project);
        }
        if (pathname === '/api/photos' && req.method === 'GET')
          return json(
            res,
            200,
            db
              .prepare('SELECT data FROM photos ORDER BY position')
              .all()
              .map((row) => JSON.parse(row.data)),
          );
        if (pathname === '/api/photos' && req.method === 'POST') {
          const input = await body(req);
          const photo = normalize(input);
          photo.id = crypto.randomUUID();
          const upload = storeImage(input.image);
          photo.src = upload.src;
          try {
            mutateGallery(() =>
              insert.run(
                photo.id,
                photo.category,
                JSON.stringify(photo),
                db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM photos').get().next,
              ),
            );
          } catch (error) {
            fs.unlinkSync(upload.file);
            throw error;
          }
          return json(res, 201, photo);
        }
        const id = pathname.match(/^\/api\/photos\/([\w-]+)$/)?.[1];
        if (id && ['PUT', 'DELETE'].includes(req.method)) {
          const row = db.prepare('SELECT data FROM photos WHERE id=?').get(id);
          if (!row) return json(res, 404, { error: 'Nie znaleziono zdjęcia.' });
          if (req.method === 'DELETE') {
            mutateGallery(() => db.prepare('DELETE FROM photos WHERE id=?').run(id));
            // Plik pozostaje na dysku, aby można było odzyskać usunięte zdjęcie.
            return json(res, 200, { ok: true });
          }
          const photo = normalize(await body(req), JSON.parse(row.data));
          mutateGallery(() =>
            db
              .prepare('UPDATE photos SET category=?, data=? WHERE id=?')
              .run(photo.category, JSON.stringify(photo), id),
          );
          return json(res, 200, photo);
        }
        return json(res, 404, { error: 'Nieznany adres API.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
      const file = path.resolve(ROOT, relative);
      const extension = path.extname(file).toLowerCase();
      const staticAllowed =
        !relative.includes('\\') &&
        !relative.split('/').some((part) => part.startsWith('.')) &&
        file.startsWith(ROOT + path.sep) &&
        MIME[extension] &&
        (relative.startsWith('assets/') || !relative.includes('/'));
      if (!staticAllowed) {
        res.writeHead(404);
        return res.end('Nie znaleziono pliku.');
      }
      const stats = await fs.promises.stat(file);
      if (!stats.isFile()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, {
        'Content-Type': MIME[extension],
        'Content-Length': stats.size,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        return res.end('Nie znaleziono pliku.');
      }
      if (!res.headersSent)
        json(res, error.status || 500, {
          error: error.status ? error.message : 'Błąd lokalnego serwera.',
        });
      console.error(error.message);
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (require.main === module) {
  if (fs.existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));
  const server = createGalleryServer();
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '127.0.0.1', () =>
    console.log(
      `Portfolio: http://localhost:${port}\nGaleria: http://localhost:${port}/hobby.html\nPanel: http://localhost:${port}/admin.html`,
    ),
  );
  server.on('error', (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? 'Port jest zajęty. Zamknij poprzedni serwer lub zmień PORT.'
        : error.message,
    );
    process.exitCode = 1;
  });
  process.on('SIGINT', () => server.close());
  process.on('SIGTERM', () => server.close());
}
module.exports = { createGalleryServer };
