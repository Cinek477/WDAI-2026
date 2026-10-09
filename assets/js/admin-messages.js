(() => {
  const list = document.querySelector('#messages-list');
  const categories = {
    it: 'Projekt IT',
    photo: 'Fotografia',
    tutoring: 'Korepetycje',
    other: 'Inne',
  };
  const detailLabels = {
    web: 'Aplikacja webowa',
    hackathon: 'Hackathon',
    other: 'Inne',
    concert: 'Koncert',
    portrait: 'Portret/Plener',
    event: 'Event promocyjny',
    programming: 'Python / C++',
    maths: 'Algorytmy / Matma',
  };
  const mailLabels = {
    pending: 'Powiadomienie w trakcie',
    sent: 'Powiadomienie przyjęte przez pocztę',
    failed: 'Błąd powiadomienia e-mail',
    not_configured: 'Poczta nie jest skonfigurowana',
  };
  let loading = false;
  window.loadAdminMessages = async () => {
    if (loading) return;
    loading = true;
    try {
      const data = await api('/api/messages');
      document.querySelector('#messages-badge').textContent = data.unread ? `(${data.unread})` : '';
      document.querySelector('#messages-config').textContent = data.mailConfigured
        ? 'Powiadomienia e-mail są skonfigurowane.'
        : 'Skrzynka działa. Aby uruchomić powiadomienia e-mail, uzupełnij .env według CONTACT-MESSAGES.md i zrestartuj serwer.';
      list.replaceChildren();
      if (!data.items.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Brak wiadomości. Nowe zgłoszenia z formularza pojawią się tutaj.';
        list.append(empty);
      }
      data.items.forEach((item) => {
        const card = document.createElement('article');
        card.className = `inbox-message${item.is_read ? '' : ' unread'}`;
        const title = document.createElement('h3');
        title.textContent = `${categories[item.category]} · ${detailLabels[item.details]}`;
        const sender = document.createElement('a');
        sender.href = `mailto:${encodeURIComponent(item.email)}`;
        sender.textContent = item.email;
        const date = document.createElement('time');
        date.dateTime = item.created;
        date.textContent = new Date(item.created).toLocaleString('pl-PL', {
          timeZone: 'Europe/Warsaw',
        });
        const content = document.createElement('p');
        content.className = 'inbox-content';
        content.textContent = item.message;
        const mail = document.createElement('p');
        mail.className = 'admin-hint';
        mail.textContent = mailLabels[item.mail_status] || item.mail_status;
        const actions = document.createElement('div');
        actions.className = 'form-actions';
        const read = document.createElement('button');
        read.type = 'button';
        read.className = 'subtle';
        read.textContent = item.is_read ? 'Oznacz jako nową' : 'Oznacz jako przeczytaną';
        read.addEventListener('click', async () => {
          read.disabled = true;
          try {
            await api(`/api/messages/${item.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ read: !item.is_read }),
            });
            await window.loadAdminMessages();
          } catch (error) {
            status(error.message, true);
            read.disabled = false;
          }
        });
        const reply = document.createElement('a');
        reply.className = 'admin-link';
        reply.href = `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(`Re: ${categories[item.category]} — Portfolio`)}`;
        reply.textContent = 'Odpowiedz ↗';
        actions.append(read, reply);
        if (data.mailConfigured && item.mail_status !== 'sent') {
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.textContent = 'Ponów powiadomienie';
          retry.addEventListener('click', async () => {
            retry.disabled = true;
            try {
              const result = await api(`/api/messages/${item.id}/notify`, { method: 'POST' });
              await window.loadAdminMessages();
              if (result.status === 'failed')
                status('Poczta odrzuciła powiadomienie. Sprawdź konfigurację.', true);
            } catch (error) {
              status(error.message, true);
              retry.disabled = false;
            }
          });
          actions.append(retry);
        }
        card.append(title, sender, date, content, mail, actions);
        list.append(card);
      });
    } finally {
      loading = false;
    }
  };
  document
    .querySelector('#messages-refresh')
    .addEventListener('click', () =>
      window.loadAdminMessages().catch((error) => status(error.message, true)),
    );
  setInterval(() => {
    if (!document.hidden && !document.querySelector('#admin-tabs').hidden)
      window.loadAdminMessages().catch(() => {});
  }, 30000);
})();
