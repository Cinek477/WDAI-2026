window.portfolioPages ||= {};
window.portfolioPages['projects.js'] = () => {
  const pageScope = window.portfolioPageScope || {
    signal: new AbortController().signal,
    cleanup: () => {},
  };
  let projects = window.portfolioProjects || [];
  const local = (value) =>
    typeof value === 'string' ? value : value?.[document.documentElement.lang] || value?.pl || '';
  const translated = (pl, en) => (document.documentElement.lang === 'en' ? en : pl);
  function render() {
    for (const section of ['achievements', 'projects']) {
      const grid = document.querySelector(`#${section} .projects-grid`);
      grid.replaceChildren();
      const items = projects.filter((project) => project.section === section);
      if (!items.length) {
        const empty = document.createElement('p');
        empty.textContent = translated(
          'Nowe projekty pojawią się wkrótce.',
          'New projects coming soon.',
        );
        grid.append(empty);
      }
      items.forEach((project, index) => {
        const card = document.createElement('article');
        card.className = 'card';
        card.addEventListener('pointerenter', (event) => {
          if (event.pointerType === 'mouse' || event.pointerType === 'pen')
            card.classList.add('is-hovered');
        });
        card.addEventListener('pointerleave', () => card.classList.remove('is-hovered'));
        card.addEventListener('pointercancel', () => card.classList.remove('is-hovered'));
        let media;
        if (project.src) {
          card.classList.add('project-photo-card');
          media = document.createElement('div');
          media.className = 'project-media';
          const image = new Image();
          image.src = project.thumbUrl || project.src;
          image.addEventListener(
            'error',
            () => {
              if (project.thumbUrl) image.src = project.src;
            },
            { once: true },
          );
          image.decoding = 'async';
          image.alt = local(project.title);
          image.className = 'project-cover';
          image.loading = 'lazy';
          media.append(image);
        }
        const top = document.createElement('div');
        top.className = 'card-top';
        const number = document.createElement('span');
        number.className = 'card-number';
        number.textContent = `${String(index + 1).padStart(2, '0')} / ${project.year}`;
        const symbol = document.createElement('span');
        symbol.className = 'card-symbol';
        symbol.setAttribute('aria-hidden', 'true');
        symbol.textContent = project.symbol || '↗';
        top.append(number, symbol);
        const title = document.createElement('h3');
        title.textContent = local(project.title);
        const summary = document.createElement('p');
        summary.className = 'card-summary';
        summary.textContent = local(project.summary);
        const toggle = document.createElement('button');
        toggle.className = 'card-toggle';
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute(
          'aria-label',
          `${translated('Szczegóły', 'Details')}: ${local(project.title)}`,
        );
        const details = document.createElement('div');
        details.className = 'card-details';
        details.id = `project-detail-${project.id}`;
        toggle.setAttribute('aria-controls', details.id);
        const inner = document.createElement('div');
        if (local(project.description)) {
          const description = document.createElement('p');
          description.className = 'project-description';
          description.textContent = local(project.description);
          inner.append(description);
        }
        if (project.technologies) {
          const technologies = document.createElement('p');
          technologies.className = 'project-technologies';
          technologies.textContent = project.technologies;
          inner.append(technologies);
        }
        if (
          project.link &&
          (/^https?:\/\/[^\s]+$/i.test(project.link) ||
            /^(?:contact\.html|#projects)$/.test(project.link))
        ) {
          const link = document.createElement('a');
          link.href = project.link;
          link.textContent = translated('Przejdź do projektu ↗', 'View project ↗');
          inner.append(link);
        }
        details.append(inner);
        toggle.addEventListener('click', () => {
          const expanded = card.classList.toggle('expanded');
          toggle.setAttribute('aria-expanded', String(expanded));
        });
        if (media) {
          const caption = document.createElement('div');
          caption.className = 'project-photo-caption';
          caption.append(title, summary);
          media.append(top, caption);
          card.append(media, toggle, details);
        } else card.append(top, title, summary, toggle, details);
        grid.append(card);
      });
    }
  }
  render();
  document.addEventListener('portfolio-language-change', render, { signal: pageScope.signal });
  if (location.protocol !== 'file:')
    fetch('/api/projects')
      .then((response) => {
        if (!response.ok) throw new Error('Brak lokalnego API');
        return response.json();
      })
      .then((data) => {
        if (!pageScope.signal.aborted && Array.isArray(data)) {
          projects = data;
          render();
        }
      })
      .catch(() => {});
};
if (!window.portfolioRouting) window.portfolioPages['projects.js']();
