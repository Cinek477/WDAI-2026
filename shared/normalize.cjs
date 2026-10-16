const CATEGORIES = new Set(['concerts', 'nature', 'people', 'places']);

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
  photo.instagram = '';
  if (photo.category === 'people') {
    const instagram = string(input.instagram ?? old.instagram ?? '', 'Instagram', 200);
    const handle = instagram
      .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '')
      .replace(/^@/, '')
      .replace(/\/$/, '');
    if (
      handle &&
      (!/^[a-zA-Z0-9._]{1,30}$/.test(handle) || handle.includes('..') || handle.endsWith('.'))
    )
      throw Object.assign(
        new Error('Podaj poprawną nazwę profilu Instagram lub link do profilu.'),
        { status: 400 },
      );
    photo.instagram = handle;
  }
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
  project.thumbUrl = input.removeImage ? '' : old.thumbUrl || '';
  return project;
}

module.exports = { normalize, normalizeProject };
