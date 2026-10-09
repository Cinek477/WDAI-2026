function createInbox({ db, json, body, authenticated, options }) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, email TEXT NOT NULL, category TEXT NOT NULL, details TEXT NOT NULL, message TEXT NOT NULL, created TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, mail_status TEXT NOT NULL DEFAULT 'pending');`,
  );
  const categories = {
    it: 'Projekt IT',
    photo: 'Fotografia',
    tutoring: 'Korepetycje',
    other: 'Inne',
  };
  const details = {
    it: ['web', 'hackathon', 'other'],
    photo: ['concert', 'portrait', 'event'],
    tutoring: ['programming', 'maths', 'other'],
    other: ['other'],
  };
  const attempts = new Map();
  const configured = () =>
    !options.mailDisabled &&
    Boolean(options.notifyMessage || (process.env.RESEND_API_KEY && process.env.CONTACT_MAIL_FROM));
  async function notify(item) {
    let state = 'not_configured';
    if (configured()) {
      try {
        if (options.notifyMessage) await options.notifyMessage(item);
        else {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            signal: AbortSignal.timeout(10000),
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': `contact-${item.id}`,
            },
            body: JSON.stringify({
              from: process.env.CONTACT_MAIL_FROM,
              to: [process.env.CONTACT_MAIL_TO || 'podyma.marcin33@gmail.com'],
              reply_to: item.email,
              subject: `Portfolio: ${categories[item.category]}`,
              text: `Od: ${item.email}\nTemat: ${categories[item.category]} / ${item.details}\n\n${item.message}`,
            }),
          });
          if (!response.ok) throw new Error('Mail provider rejected notification');
        }
        state = 'sent';
      } catch {
        state = 'failed';
      }
    }
    db.prepare('UPDATE messages SET mail_status=? WHERE id=?').run(state, item.id);
  }
  return async (req, res, pathname) => {
    if (pathname === '/api/contact' && req.method === 'POST') {
      const input = await body(req, 32 * 1024);
      if (!input || typeof input !== 'object' || Array.isArray(input))
        return (json(res, 400, { error: 'Niepoprawna wiadomość.' }), true);
      const email = typeof input.email === 'string' ? input.email.trim() : '';
      const message = typeof input.message === 'string' ? input.message.trim() : '';
      if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !Object.hasOwn(categories, input.category) ||
        !details[input.category].includes(input.details) ||
        message.length < 10 ||
        message.length > 5000 ||
        !/^[\da-f-]{36}$/i.test(input.requestId || '')
      )
        return (json(res, 400, { error: 'Sprawdź e-mail, temat i treść wiadomości.' }), true);
      const existing = db.prepare('SELECT id FROM messages WHERE id=?').get(input.requestId);
      if (existing) return (json(res, 200, { ok: true }), true);
      const key = req.socket.remoteAddress;
      const now = Date.now();
      const recent = (attempts.get(key) || []).filter((time) => time > now - 15 * 60 * 1000);
      if (recent.length >= 5)
        return (
          json(res, 429, { error: 'Poczekaj chwilę przed wysłaniem kolejnej wiadomości.' }),
          true
        );
      recent.push(now);
      attempts.set(key, recent);
      const item = {
        id: input.requestId,
        email,
        category: input.category,
        details: input.details,
        message,
        created: new Date().toISOString(),
      };
      db.prepare(
        'INSERT INTO messages (id,email,category,details,message,created) VALUES (?,?,?,?,?,?)',
      ).run(item.id, email, item.category, item.details, message, item.created);
      await notify(item);
      json(res, 201, { ok: true });
      return true;
    }
    if (!pathname.startsWith('/api/messages')) return false;
    if (!authenticated(req))
      return (json(res, 401, { error: 'Zaloguj się do panelu administratora.' }), true);
    if (pathname === '/api/messages' && req.method === 'GET') {
      json(res, 200, {
        items: db.prepare('SELECT * FROM messages ORDER BY created DESC LIMIT 100').all(),
        unread: db.prepare('SELECT COUNT(*) AS count FROM messages WHERE is_read=0').get().count,
        mailConfigured: configured(),
      });
      return true;
    }
    const match = pathname.match(/^\/api\/messages\/([\da-f-]+)(\/notify)?$/i);
    const item = match && db.prepare('SELECT * FROM messages WHERE id=?').get(match[1]);
    if (!item) return (json(res, 404, { error: 'Nie znaleziono wiadomości.' }), true);
    if (req.method === 'PUT' && !match[2]) {
      const input = await body(req, 1024);
      if (typeof input?.read !== 'boolean')
        return (json(res, 400, { error: 'Niepoprawny status.' }), true);
      db.prepare('UPDATE messages SET is_read=? WHERE id=?').run(Number(input.read), item.id);
      json(res, 200, { ok: true });
      return true;
    }
    if (req.method === 'POST' && match[2]) {
      if (!configured())
        return (json(res, 409, { error: 'Uzupełnij konfigurację poczty w .env.' }), true);
      if (item.mail_status !== 'sent') await notify(item);
      json(res, 200, {
        status: db.prepare('SELECT mail_status FROM messages WHERE id=?').get(item.id).mail_status,
      });
      return true;
    }
    json(res, 405, { error: 'Niedozwolona operacja.' });
    return true;
  };
}
module.exports = { createInbox };
