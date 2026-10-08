const photos = window.portfolioPhotos;
const track = document.querySelector('.gallery-track');
const dialog = document.querySelector('.photo-lightbox');
const mobileDetails = document.querySelector('.mobile-photo-details');
const mobileQuery = matchMedia('(max-width: 760px)');
let filteredPhotos = [...photos];
let selectedPhoto = null;
let scrollFrame = 0;
let returnFocus = null;
const text = (value) =>
  typeof value === 'string' ? value : value?.[document.documentElement.lang] || '';
const translated = (pl, en) => (document.documentElement.lang === 'en' ? en : pl);

function visual(photo) {
  if (photo.src) {
    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = text(photo.title);
    image.loading = 'lazy';
    image.draggable = false;
    return image;
  }
  const placeholder = document.createElement('div');
  placeholder.className = 'photo-placeholder';
  placeholder.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M3 6h4l2-3h6l2 3h4v14H3Z"/><circle cx="12" cy="13" r="4"/></svg><span></span>';
  placeholder.querySelector('span').textContent = translated(
    'Miejsce na Twoje zdjęcie',
    'Your photo goes here',
  );
  return placeholder;
}

function metadata(photo) {
  const container = document.createElement('div');
  container.className = 'photo-metadata';
  const heading = document.createElement('h3');
  heading.textContent = text(photo.title);
  container.append(heading);
  const list = document.createElement('dl');
  const fields =
    photo.category === 'concerts'
      ? [
          ['artist', 'Artysta / Zespół', 'Artist / Band'],
          ['event', 'Wydarzenie / Trasa', 'Event / Tour'],
          ['place', 'Miejsce', 'Place'],
          ['year', 'Rok', 'Year'],
        ]
      : [
          ['place', 'Miejsce', 'Place'],
          ['year', 'Rok', 'Year'],
        ];
  fields.forEach(([key, pl, en]) => {
    const field = document.createElement('div');
    const label = document.createElement('dt');
    const value = document.createElement('dd');
    label.textContent = translated(pl, en);
    value.textContent = text(photo[key]) || translated('Do uzupełnienia', 'To be added');
    field.append(label, value);
    list.append(field);
  });
  const description = document.createElement('p');
  description.textContent =
    text(photo.description) ||
    translated(
      'Tutaj pojawi się opis tego kadru.',
      'A description of this frame will appear here.',
    );
  container.append(list, description);
  return container;
}

function selectPhoto(photo) {
  selectedPhoto = photo;
  track.querySelectorAll('.photo-card').forEach((card) => {
    const active = card.dataset.photoId === photo.id;
    card.classList.toggle('selected', active);
    card.setAttribute('aria-pressed', String(active));
  });
  mobileDetails.firstElementChild.replaceChildren(metadata(photo));
  mobileDetails.classList.add('visible');
  if (dialog.open) renderLightbox();
}

function renderLightbox() {
  dialog.querySelector('.lightbox-image').replaceChildren(visual(selectedPhoto));
  dialog.querySelector('.lightbox-metadata').replaceChildren(metadata(selectedPhoto));
  dialog.querySelector('.lightbox-counter').textContent =
    `${filteredPhotos.indexOf(selectedPhoto) + 1} / ${filteredPhotos.length}`;
}

function openPhoto(photo, button) {
  selectPhoto(photo);
  if (mobileQuery.matches) return;
  returnFocus = button;
  renderLightbox();
  dialog.showModal();
  document.body.style.overflow = 'hidden';
}

function renderGallery() {
  track.replaceChildren();
  // Trzy identyczne cykle pozwalają przewijać w obie strony bez końca.
  for (let cycle = 0; cycle < 3; cycle++) {
    const group = document.createElement('div');
    group.className = 'gallery-cycle';
    filteredPhotos.forEach((photo) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `photo-card ${photo.shape}`;
      button.dataset.photoId = photo.id;
      button.setAttribute('aria-label', text(photo.title));
      button.setAttribute('aria-pressed', 'false');
      button.tabIndex = cycle === 1 ? 0 : -1;
      const caption = document.createElement('span');
      caption.className = 'photo-caption';
      caption.textContent = text(photo.place) || text(photo.title);
      button.append(visual(photo), caption);
      button.addEventListener('click', () => openPhoto(photo, button));
      group.append(button);
    });
    track.append(group);
  }
  track.scrollLeft = cycleWidth();
  if (selectedPhoto && filteredPhotos.includes(selectedPhoto)) selectPhoto(selectedPhoto);
  else {
    selectedPhoto = null;
    mobileDetails.classList.remove('visible');
  }
  selectCentralPhoto();
}

function cycleWidth() {
  return (
    track.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap)
  );
}

function selectCentralPhoto() {
  if (!mobileQuery.matches) return;
  const bounds = track.getBoundingClientRect();
  const center = bounds.left + bounds.width / 2;
  const buttons = [...track.querySelectorAll('.photo-card')];
  const closest = buttons.reduce((best, button) => {
    const box = button.getBoundingClientRect();
    const distance = Math.abs(box.left + box.width / 2 - center);
    return !best || distance < best.distance ? { button, distance } : best;
  }, null);
  if (!closest) return;
  // Przy tej samej pozycji zachowaj rząd zdjęcia wybranego dotknięciem.
  const current = buttons.find((button) => {
    const box = button.getBoundingClientRect();
    return (
      button.dataset.photoId === selectedPhoto?.id &&
      Math.abs(box.left + box.width / 2 - center) < closest.distance + 3
    );
  });
  const id = (current || closest.button).dataset.photoId;
  if (id !== selectedPhoto?.id) selectPhoto(filteredPhotos.find((photo) => photo.id === id));
}

track.addEventListener(
  'scroll',
  () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const width = cycleWidth();
      if (track.scrollLeft < width * 0.5) track.scrollLeft += width;
      else if (track.scrollLeft > width * 1.5) track.scrollLeft -= width;
      selectCentralPhoto();
    });
  },
  { passive: true },
);

document.querySelectorAll('.gallery-filter').forEach((button) =>
  button.addEventListener('click', () => {
    document
      .querySelectorAll('.gallery-filter')
      .forEach((filter) => filter.setAttribute('aria-pressed', String(filter === button)));
    filteredPhotos = photos.filter(
      (photo) => button.dataset.filter === 'all' || photo.category === button.dataset.filter,
    );
    renderGallery();
  }),
);

document.querySelectorAll('[data-gallery-direction]').forEach((button) =>
  button.addEventListener('click', () => {
    track.scrollBy({
      left: Number(button.dataset.galleryDirection) * track.clientWidth * 0.65,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }),
);

function movePhoto(direction) {
  const index = filteredPhotos.indexOf(selectedPhoto);
  selectPhoto(filteredPhotos[(index + direction + filteredPhotos.length) % filteredPhotos.length]);
}
dialog.querySelector('.lightbox-prev').addEventListener('click', () => movePhoto(-1));
dialog.querySelector('.lightbox-next').addEventListener('click', () => movePhoto(1));
dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    movePhoto(-1);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    movePhoto(1);
  }
});
dialog.addEventListener('close', () => {
  document.body.style.overflow = '';
  returnFocus?.focus({ preventScroll: true });
});
document.addEventListener('portfolio-language-change', renderGallery);
addEventListener('resize', () => {
  if (mobileQuery.matches && dialog.open) dialog.close();
  track.scrollLeft = cycleWidth();
  selectCentralPhoto();
});
renderGallery();
