const form = document.querySelector('#photo-form');
const statusElement = document.querySelector('#status');
const preview = document.querySelector('#preview');
let editingId = null;
let photos = [];
let previewUrl = null;
const pl = (value) => (typeof value === 'string' ? value : value?.pl || '');
function updateCategory() {
  const concert = form.elements.category.value === 'concerts';
  const person = form.elements.category.value === 'people';
  form.elements.instagram.closest('label').hidden = !person;
  form.elements.instagram.disabled = !person;
  for (const key of ['artist', 'event', 'eventEn', 'city', 'cityEn', 'date']) {
    const input = form.elements[key];
    input.closest('label').hidden = !concert;
    input.disabled = !concert;
  }
  form.elements.title.required = concert;
  form.elements.venue.required = !concert;
  form.elements.venue.placeholder = concert ? 'PGE Narodowy' : 'Np. Tatry — Dolina Kościeliska';
}
form.elements.category.addEventListener('change', updateCategory);
updateCategory();
function status(message, error = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('error', error);
}
async function api(path = '/api/photos', options = {}) {
  const response = await fetch(path, options);
  const result = await response.json();
  if (response.status === 401 && !path.startsWith('/api/auth')) await refreshAuth();
  if (!response.ok) throw new Error(result.error || 'Nie udało się zapisać zmian.');
  return result;
}
function resetForm() {
  editingId = null;
  form.reset();
  updateCategory();
  form.elements.image.required = true;
  form.elements.image.disabled = false;
  preview.hidden = true;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  document.querySelector('#form-title').textContent = 'Dodaj zdjęcie';
  document.querySelector('#save').textContent = 'Zapisz zdjęcie';
  document.querySelector('#cancel').hidden = true;
}
function edit(photo) {
  resetForm();
  editingId = photo.id;
  for (const key of [
    'title',
    'artist',
    'instagram',
    'event',
    'venue',
    'city',
    'description',
    'category',
    'shape',
  ])
    form.elements[key].value = pl(photo[key]);
  for (const key of ['title', 'event', 'city', 'description'])
    form.elements[`${key}En`].value = photo[key]?.en || '';
  form.elements.date.value = photo.date ? photo.date.split('.').reverse().join('-') : '';
  if (photo.category !== 'concerts') form.elements.venue.value = pl(photo.place) || pl(photo.venue);
  updateCategory();
  form.elements.image.required = false;
  form.elements.image.disabled = true;
  preview.src = photo.src;
  preview.hidden = false;
  document.querySelector('#form-title').textContent = 'Edytuj opis zdjęcia';
  document.querySelector('#save').textContent = 'Zapisz zmiany';
  document.querySelector('#cancel').hidden = false;
  form.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
}
async function loadPhotos() {
  photos = await api();
  document.querySelector('#count').textContent = `(${photos.length})`;
  const list = document.querySelector('#photo-list');
  list.replaceChildren();
  if (!photos.length) {
    const message = document.createElement('p');
    message.textContent = 'Dodaj swoje pierwsze zdjęcie.';
    list.append(message);
  }
  photos.forEach((photo) => {
    const card = document.createElement('article');
    card.className = 'admin-photo';
    const image = new Image();
    image.src = photo.thumbUrl || photo.src;
    image.addEventListener(
      'error',
      () => {
        if (photo.thumbUrl) image.src = photo.src;
      },
      { once: true },
    );
    image.alt = pl(photo.title);
    image.loading = 'lazy';
    const content = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = pl(photo.title);
    const summary = document.createElement('p');
    summary.textContent = [pl(photo.place), photo.category === 'concerts' ? photo.date : '']
      .filter(Boolean)
      .join(' · ');
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'subtle';
    editButton.textContent = 'Edytuj';
    editButton.addEventListener('click', () => edit(photo));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Usuń';
    remove.addEventListener('click', async () => {
      if (!confirm(`Usunąć „${pl(photo.title)}” z galerii? Plik zdjęcia pozostanie na dysku.`))
        return;
      remove.disabled = true;
      try {
        await api(`/api/photos/${photo.id}`, { method: 'DELETE' });
        if (editingId === photo.id) resetForm();
        await loadPhotos();
        status('Zdjęcie usunięte z galerii.');
      } catch (error) {
        status(error.message, true);
        remove.disabled = false;
      }
    });
    actions.append(editButton, remove);
    content.append(title, summary, actions);
    card.append(image, content);
    list.append(card);
  });
}
form.elements.image.addEventListener('change', () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = form.elements.image.files[0];
  preview.hidden = !file;
  if (file) {
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
  }
});

function dominantColor(context) {
  const { data } = context.getImageData(0, 0, 48, 48);
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]],
      high = Math.max(r, g, b),
      low = Math.min(r, g, b);
    if (high < 35) continue;
    const saturation = (high - low) / high;
    if (saturation < 0.3) continue;
    const delta = high - low;
    let hue =
      high === r ? ((g - b) / delta) % 6 : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
    const key = Math.floor(hue / 15),
      weight = saturation ** 2 * Math.sqrt(high / 255);
    const bin = buckets.get(key) || { w: 0, r: 0, g: 0, b: 0 };
    bin.w += weight;
    bin.r += r * weight;
    bin.g += g * weight;
    bin.b += b * weight;
    buckets.set(key, bin);
  }
  const bin = [...buckets.values()].sort((a, b) => b.w - a.w)[0];
  if (!bin) return '#6273dc';
  const rgb = [bin.r / bin.w, bin.g / bin.w, bin.b / bin.w],
    boost = 220 / Math.max(...rgb);
  return (
    '#' +
    rgb
      .map((value) =>
        Math.round(value * boost)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
async function prepareImage(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Wybierz zdjęcie mniejsze niż 20 MB.');
  const url = URL.createObjectURL(file),
    image = new Image();
  image.src = url;
  try {
    await image.decode();
    const canvas = document.createElement('canvas'),
      scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const sample = document.createElement('canvas');
    sample.width = sample.height = 48;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    sampleContext.drawImage(image, 0, 0, 48, 48);
    const thumbnail = document.createElement('canvas');
    const thumbScale = Math.min(1, 800 / canvas.width);
    thumbnail.width = Math.max(1, Math.round(canvas.width * thumbScale));
    thumbnail.height = Math.max(1, Math.round(canvas.height * thumbScale));
    thumbnail.getContext('2d').drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
    return {
      image: canvas.toDataURL('image/jpeg', 0.85),
      thumbnail: thumbnail.toDataURL('image/webp', 0.78),
      glowColor: dominantColor(sampleContext),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const targetId = editingId;
  const save = document.querySelector('#save');
  save.disabled = true;
  form.inert = true;
  document.querySelector('#photo-list').inert = true;
  status(editingId ? 'Zapisywanie zmian…' : 'Przygotowywanie i zapisywanie zdjęcia…');
  try {
    const input = Object.fromEntries(new FormData(form));
    delete input.image;
    if (!targetId) Object.assign(input, await prepareImage(form.elements.image.files[0]));
    await api(targetId ? `/api/photos/${targetId}` : '/api/photos', {
      method: targetId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    resetForm();
    await loadPhotos();
    status('Zapisano w galerii i plikach do Git. Aby wysłać na GitHub, wykonaj commit i push.');
  } catch (error) {
    status(error.message, true);
  } finally {
    save.disabled = false;
    form.inert = false;
    document.querySelector('#photo-list').inert = false;
  }
});
document.querySelector('#cancel').addEventListener('click', resetForm);
const loginForm = document.querySelector('#login-form');
document.querySelectorAll('[data-panel]').forEach((button) =>
  button.addEventListener('click', () => {
    if (button.getAttribute('aria-pressed') === 'true') return;
    document.querySelectorAll('[data-panel]').forEach((tab) => {
      const active = tab === button;
      tab.setAttribute('aria-pressed', String(active));
      document.querySelector(`#${tab.dataset.panel}-panel`).hidden = !active;
    });
    if (button.dataset.panel === 'messages' && window.loadAdminMessages)
      window.loadAdminMessages().catch((error) => status(error.message, true));
  }),
);
let requiresSetup = false;
async function refreshAuth() {
  const auth = await api('/api/auth/status');
  requiresSetup = auth.requiresSetup;
  document.querySelector('#admin-tabs').hidden = !auth.authenticated;
  document.querySelector('#gallery-panel').hidden =
    !auth.authenticated ||
    document.querySelector('[data-panel="gallery"]').getAttribute('aria-pressed') !== 'true';
  document.querySelector('#projects-panel').hidden =
    !auth.authenticated ||
    document.querySelector('[data-panel="projects"]').getAttribute('aria-pressed') !== 'true';
  document.querySelector('#auth-panel').hidden = auth.authenticated;
  document.querySelector('#messages-panel').hidden =
    !auth.authenticated ||
    document.querySelector('[data-panel="messages"]').getAttribute('aria-pressed') !== 'true';
  document.querySelector('#logout').hidden = !auth.authenticated;
  if (auth.authenticated) {
    await loadPhotos();
    if (window.loadAdminProjects) await window.loadAdminProjects();
    if (window.loadAdminMessages) await window.loadAdminMessages();
    return;
  }
  document.querySelector('#photo-list').replaceChildren();
  document.querySelector('#project-list').replaceChildren();
  document.querySelector('#messages-list').replaceChildren();
  document.querySelector('#messages-badge').textContent = '';
  document.querySelector('#auth-title').textContent = requiresSetup
    ? 'Ustaw swoje hasło'
    : 'Zaloguj się';
  document.querySelector('#auth-description').textContent = requiresSetup
    ? 'Pierwsze uruchomienie. Ustaw hasło dla konta admin (minimum 10 znaków).'
    : 'Wpisz login i hasło, aby zarządzać galerią.';
  document.querySelector('#login-submit').textContent = requiresSetup
    ? 'Utwórz dostęp do panelu'
    : 'Zaloguj się';
  document.querySelector('#confirm-password-label').hidden = !requiresSetup;
  loginForm.elements.confirmPassword.required = requiresSetup;
  loginForm.elements.password.autocomplete = requiresSetup ? 'new-password' : 'current-password';
}
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = loginForm.elements.password.value;
  if (requiresSetup && password !== loginForm.elements.confirmPassword.value) {
    status('Hasła muszą być takie same.', true);
    return;
  }
  const button = document.querySelector('#login-submit');
  button.disabled = true;
  try {
    await api(requiresSetup ? '/api/auth/setup' : '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginForm.elements.username.value, password }),
    });
    loginForm.reset();
    await refreshAuth();
    status('Zalogowano do panelu administratora.');
  } catch (error) {
    status(error.message, true);
  } finally {
    button.disabled = false;
  }
});
document.querySelector('#logout').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
    resetForm();
    loginForm.reset();
    await refreshAuth();
    status('Wylogowano.');
  } catch (error) {
    status(error.message, true);
  }
});
if (location.protocol === 'file:')
  status('Uruchom serwer i otwórz http://localhost:3000/admin.html.', true);
else refreshAuth().catch((error) => status(error.message, true));
