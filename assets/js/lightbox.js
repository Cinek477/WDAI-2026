// Renderowanie modalu; nawigacja klawiaturą i cykl galerii pozostają w gallery.js.
(() => {
  const dialog = document.querySelector('.photo-lightbox');
  const carousel = dialog.querySelector('.lightbox-carousel');
  const mobile = matchMedia('(max-width: 768px)');
  let activePhoto;
  let activeCollection = [];
  let selectPhoto;
  let collectionKey = '';
  let swiping = false;
  let scrollTimer;
  const information = dialog.querySelector('.lightbox-metadata');
  const counter = dialog.querySelector('.lightbox-counter');
  const dots = document.createElement('div');
  dots.className = 'lightbox-dots';
  dots.setAttribute('role', 'group');
  const pagination = document.createElement('div');
  pagination.className = 'lightbox-pagination';
  counter.replaceWith(pagination);
  pagination.append(counter, dots);
  dialog.setAttribute('aria-labelledby', 'lightbox-title');

  const local = (value) =>
    typeof value === 'string' ? value : value?.[document.documentElement.lang] || '';
  const translate = (pl, en) => (document.documentElement.lang === 'en' ? en : pl);
  const iconPaths = {
    artist:
      '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
    event: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    venue:
      '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    date: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6M17 2v6M3 11h18M8 15h2M14 15h2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  };
  function icon(type) {
    const wrapper = document.createElement('span');
    wrapper.className = 'lightbox-icon';
    wrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[type]}</svg>`;
    return wrapper;
  }
  const colorCache = new Map();

  function sampleGlow(image) {
    if (colorCache.has(image.src)) return colorCache.get(image.src);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 48;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, 48, 48);
    const { data } = context.getImageData(0, 0, 48, 48);
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const high = Math.max(r, g, b),
        low = Math.min(r, g, b);
      if (data[i + 3] < 128 || high < 35 || low > 235) continue;
      const saturation = (high - low) / high;
      if (saturation < 0.3) continue;
      const difference = high - low;
      let hue =
        high === r
          ? ((g - b) / difference) % 6
          : high === g
            ? (b - r) / difference + 2
            : (r - g) / difference + 4;
      hue = (hue * 60 + 360) % 360;
      const key = Math.floor(hue / 15);
      const bucket = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0 };
      const weight = saturation ** 2 * Math.sqrt(high / 255);
      bucket.weight += weight;
      bucket.r += r * weight;
      bucket.g += g * weight;
      bucket.b += b * weight;
      buckets.set(key, bucket);
    }
    const dominant = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
    if (!dominant) return 'rgba(98, 115, 220, 0.6)';
    const channels = [dominant.r, dominant.g, dominant.b].map((value) => value / dominant.weight);
    const boost = Math.min(2.2, 190 / Math.max(...channels));
    const color = `rgba(${channels.map((value) => Math.round(Math.min(255, value * boost))).join(', ')}, 0.65)`;
    colorCache.set(image.src, color);
    return color;
  }

  function fitText() {
    information.querySelectorAll('.lightbox-value').forEach((value) => {
      value.style.fontSize = '';
      let size = parseFloat(getComputedStyle(value).fontSize);
      // Kafelki mogą rosnąć w pionie: nic nie jest ucinane ani zastępowane wielokropkiem.
      while (value.scrollWidth > value.clientWidth + 1 && size > 12) {
        size -= 0.5;
        value.style.fontSize = `${size}px`;
      }
    });
  }
  new ResizeObserver(() => requestAnimationFrame(fitText)).observe(information);

  window.renderPortfolioLightbox = (photo, collection, select) => {
    activePhoto = photo;
    activeCollection = collection;
    selectPhoto = select;
    // Własny kolor zdjęcia działa również przy file://, gdzie canvas jest blokowany.
    dialog.style.setProperty('--dynamic-glow-color', photo.glowColor || 'rgba(98, 115, 220, 0.6)');
    const key = JSON.stringify(collection.map((item) => [item.id, item.src]));
    if (key !== collectionKey) {
      collectionKey = key;
      carousel.replaceChildren();
      collection.forEach((item) => {
        const imageFrame = document.createElement('div');
        imageFrame.className = 'lightbox-image';
        imageFrame.style.setProperty(
          '--dynamic-glow-color',
          item.glowColor || 'rgba(98, 115, 220, 0.6)',
        );
        carousel.append(imageFrame);
        if (item.src) {
          const image = new Image();
          image.alt = local(item.title);
          image.decoding = 'async';
          if (location.protocol !== 'file:') image.crossOrigin = 'anonymous';
          image.addEventListener(
            'load',
            () => {
              try {
                const color = sampleGlow(image);
                imageFrame.style.setProperty('--dynamic-glow-color', color);
                if (activePhoto === item) dialog.style.setProperty('--dynamic-glow-color', color);
              } catch {
                // Zachowaj kolor zapisany dla zdjęcia, zamiast wymuszać niebieską poświatę.
              }
            },
            { once: true },
          );
          image.src = item.src;
          imageFrame.append(image);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'photo-placeholder';
          placeholder.textContent = translate('Miejsce na zdjęcie', 'Photo placeholder');
          imageFrame.append(placeholder);
        }
      });
    }
    const selectedIndex = collection.indexOf(photo);
    [...carousel.children].forEach((frame, index) => {
      frame.classList.toggle('is-active', index === selectedIndex);
      const image = frame.querySelector('img');
      if (image) image.alt = local(collection[index].title);
    });
    const selectedFrame = carousel.children[selectedIndex];
    if (selectedFrame) {
      dialog.style.setProperty(
        '--dynamic-glow-color',
        selectedFrame.style.getPropertyValue('--dynamic-glow-color'),
      );
      if (!swiping && mobile.matches)
        requestAnimationFrame(() => {
          const frameRect = selectedFrame.getBoundingClientRect();
          const trackRect = carousel.getBoundingClientRect();
          carousel.scrollLeft +=
            frameRect.left + frameRect.width / 2 - trackRect.left - carousel.clientWidth / 2;
        });
    }

    information.replaceChildren();
    const badges = document.createElement('div');
    badges.className = 'lightbox-badges';
    const categories = {
      concerts: ['Koncert 🎸', 'Concert 🎸'],
      nature: ['Natura 🌲', 'Nature 🌲'],
      people: ['Ludzie', 'People'],
      places: ['Miejsca', 'Places'],
    };
    const category = categories[photo.category] || ['Fotografia', 'Photography'];
    [translate(...category), photo.category === 'concerts' ? local(photo.city) : '']
      .filter(Boolean)
      .forEach((label) => {
        const badge = document.createElement('span');
        badge.textContent = label;
        badges.append(badge);
      });
    const heading = document.createElement('h2');
    heading.id = 'lightbox-title';
    const concert = photo.category === 'concerts';
    if (!concert) heading.className = 'visually-hidden';
    heading.textContent = concert
      ? local(photo.artist) || local(photo.title)
      : local(photo.place) || local(photo.venue);
    const grid = document.createElement('dl');
    grid.className = 'lightbox-info-grid';
    if (!concert) grid.classList.add('is-simple');
    const fields = concert
      ? [
          ['artist', 'Artysta', 'Artist'],
          ['event', 'Wydarzenie', 'Event'],
          ['venue', 'Miejsce', 'Venue'],
          ['date', 'Data', 'Date'],
        ]
      : [['venue', 'Miejsce', 'Venue']];
    fields.forEach(([key, pl, en]) => {
      const tile = document.createElement('div');
      tile.className = 'lightbox-info-tile';
      const label = document.createElement('dt');
      label.className = 'visually-hidden';
      label.textContent = translate(pl, en);
      const value = document.createElement('dd');
      value.className = 'lightbox-value';
      value.textContent =
        local(
          !concert
            ? photo.place || photo.venue
            : photo[key] || (key === 'venue' ? photo.place : ''),
        ) || '—';
      tile.append(label, icon(key), value);
      grid.append(tile);
    });
    const description = document.createElement('div');
    description.className = 'lightbox-description';
    const sentence = document.createElement('p');
    sentence.textContent =
      local(photo.description) ||
      translate('Opis tego kadru pojawi się wkrótce.', 'More about this frame coming soon.');
    description.append(icon('info'), sentence);
    if (concert) information.append(badges, heading, grid, description);
    else {
      information.append(badges, heading, grid);
      if (photo.category === 'people' && /^[a-zA-Z0-9._]{1,30}$/.test(photo.instagram || '')) {
        const instagram = document.createElement('a');
        instagram.className = 'lightbox-instagram';
        instagram.href = `https://www.instagram.com/${photo.instagram}/`;
        instagram.target = '_blank';
        instagram.rel = 'noopener noreferrer';
        instagram.textContent = `@${photo.instagram} ↗`;
        information.append(instagram);
      }
      if (local(photo.description)) information.append(description);
    }

    const index = collection.indexOf(photo);
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(collection.length).padStart(2, '0')}`;
    counter.setAttribute('aria-live', 'polite');
    dots.setAttribute('aria-label', translate('Wybierz zdjęcie', 'Choose a photo'));
    dots.replaceChildren();
    collection.forEach((item, position) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'lightbox-dot';
      dot.setAttribute('aria-label', `${position + 1}: ${local(item.title)}`);
      dot.setAttribute('aria-pressed', String(position === index));
      dot.addEventListener('click', () => {
        select(item);
        dots.children[position]?.focus();
      });
      dots.append(dot);
    });
    requestAnimationFrame(fitText);
  };
  carousel.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (!dialog.open || !mobile.matches) return;
        const trackRect = carousel.getBoundingClientRect();
        const center = trackRect.left + carousel.clientWidth / 2;
        const frames = [...carousel.children];
        const closest = frames.reduce(
          (best, frame) => {
            const rect = frame.getBoundingClientRect();
            const distance = Math.abs(rect.left + rect.width / 2 - center);
            return distance < best.distance ? { frame, distance } : best;
          },
          { frame: null, distance: Infinity },
        );
        const photo = activeCollection[frames.indexOf(closest.frame)];
        if (photo && photo !== activePhoto) {
          swiping = true;
          selectPhoto(photo);
          swiping = false;
        }
      }, 100);
    },
    { passive: true },
  );
})();
