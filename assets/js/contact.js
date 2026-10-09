(() => {
  const form = document.querySelector('#contact-form');
  const steps = [...form.querySelectorAll('.wizard-step')];
  const email = form.elements.email;
  const message = form.elements.message;
  const status = document.querySelector('#contact-status');
  const detailOptions = document.querySelector('#wizard-details');
  let formData = { email: '', category: '', details: '', message: '' };
  let currentStep = 1;
  let draftKey = '';
  let sending = false;
  let submitted = false;
  let requestId = '';
  let requestKey = '';
  const drafts = new Map();
  const categories = {
    it: ['Projekt IT', 'IT project'],
    photo: ['Fotografia', 'Photography'],
    tutoring: ['Korepetycje', 'Tutoring'],
    other: ['Inne', 'Other'],
  };
  const details = {
    it: [
      ['web', 'Aplikacja Webowa', 'Web application'],
      ['hackathon', 'Hackathon', 'Hackathon'],
      ['other', 'Inne', 'Other'],
    ],
    photo: [
      ['concert', 'Koncert', 'Concert'],
      ['portrait', 'Portret/Plener', 'Portrait/Outdoor'],
      ['event', 'Event promocyjny', 'Promotional event'],
    ],
    tutoring: [
      ['programming', 'Python / C++', 'Python / C++'],
      ['maths', 'Algorytmy / Matma', 'Algorithms / Maths'],
      ['other', 'Inne', 'Other'],
    ],
    other: [['other', 'Inne', 'Other']],
  };
  const english = () => document.documentElement.lang === 'en';
  const text = (pl, en) => (english() ? en : pl);
  function saveDraft() {
    if (currentStep === 4 && draftKey) {
      formData.message = message.value;
      drafts.set(draftKey, formData.message);
    }
  }
  function renderDetails() {
    detailOptions.replaceChildren();
    for (const [value, pl, en] of details[formData.category] || []) {
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'details';
      radio.value = value;
      radio.id = `detail-${value}`;
      radio.className = 'contact-radio';
      radio.checked = value === formData.details;
      radio.addEventListener('change', () => {
        formData.details = value;
        status.textContent = '';
      });
      const label = document.createElement('label');
      label.htmlFor = radio.id;
      label.textContent = text(pl, en);
      detailOptions.append(radio, label);
    }
  }
  function generateDraft() {
    draftKey = JSON.stringify([
      formData.email,
      formData.category,
      formData.details,
      document.documentElement.lang,
    ]);
    const category = categories[formData.category][english() ? 1 : 0];
    const detail = details[formData.category].find((item) => item[0] === formData.details)[
      english() ? 2 : 1
    ];
    formData.message =
      drafts.get(draftKey) ??
      text(
        `Cześć Marcin!\n\nPiszę w sprawie: ${category} — konkretnie ${detail}.\nProszę o kontakt na adres ${formData.email}.\n\nDodatkowo…`,
        `Hi Marcin!\n\nI'm writing about: ${category} — specifically ${detail}.\nPlease reply to ${formData.email}.\n\nI'd also like to add…`,
      );
    message.value = formData.message;
  }
  function showStep(number) {
    saveDraft();
    if (number === 3) renderDetails();
    if (number === 4) generateDraft();
    currentStep = number;
    steps.forEach((step, index) => {
      const active = index + 1 === number;
      step.hidden = !active;
      step.classList.toggle('active', active);
    });
    status.textContent = '';
    document.querySelector('#wizard-progress').textContent =
      `${String(number).padStart(2, '0')} / 04`;
    form
      .querySelectorAll('.wizard-progress-track span')
      .forEach((segment, index) => segment.classList.toggle('current', index < number));
    steps[number - 1].querySelector('h3').focus({ preventScroll: true });
  }
  function next() {
    if (currentStep === 1) {
      email.value = email.value.trim();
      if (!email.reportValidity()) return;
      formData.email = email.value;
    }
    if (currentStep === 2 && !formData.category) {
      status.textContent = text(
        'Wybierz temat, żeby przejść dalej.',
        'Choose a topic to continue.',
      );
      form.querySelector('input[name="category"]').focus();
      return;
    }
    if (currentStep === 3 && !formData.details) {
      status.textContent = text('Wybierz jedną z opcji.', 'Choose one of the options.');
      detailOptions.querySelector('input')?.focus();
      return;
    }
    if (currentStep < 4) showStep(currentStep + 1);
  }
  form.querySelectorAll('.wizard-next').forEach((button) => button.addEventListener('click', next));
  form
    .querySelectorAll('.wizard-back')
    .forEach((button) => button.addEventListener('click', () => showStep(currentStep - 1)));
  form.querySelectorAll('input[name="category"]').forEach((radio) =>
    radio.addEventListener('change', () => {
      if (formData.category !== radio.value) formData.details = '';
      formData.category = radio.value;
      status.textContent = '';
    }),
  );
  message.addEventListener('input', saveDraft);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (currentStep < 4) {
      next();
      return;
    }
    if (!email.checkValidity()) {
      showStep(1);
      email.reportValidity();
      return;
    }
    message.value = message.value.trim();
    if (!message.reportValidity()) return;
    saveDraft();
    if (sending || submitted) return;
    const key = JSON.stringify(formData);
    if (requestKey !== key) {
      requestId = crypto.randomUUID();
      requestKey = key;
    }
    sending = true;
    form.inert = true;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    status.textContent = text('Wysyłanie…', 'Sending…');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, requestId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || text('Nie udało się wysłać wiadomości.', 'Could not send your message.'),
        );
      submitted = true;
      form.querySelectorAll('.wizard-back').forEach((button) => (button.disabled = true));
      message.readOnly = true;
      status.textContent = text(
        'Dziękuję! Wiadomość trafiła do mojej skrzynki w panelu.',
        'Thank you! Your message is in my inbox.',
      );
    } catch (error) {
      status.textContent =
        text('Nie udało się wysłać. ', 'Could not send. ') +
        (error instanceof SyntaxError
          ? text('Otwórz stronę przez lokalny serwer.', 'Open the site using the local server.')
          : error.message);
    } finally {
      sending = false;
      form.inert = false;
      submit.disabled = submitted;
    }
  });
  document.addEventListener('portfolio-language-change', () => {
    if (currentStep === 3) renderDetails();
    status.textContent = '';
    // Treść edytowanej wiadomości pozostaje bez zmian przy przełączeniu języka.
  });
})();
