(() => {
  const projectForm = document.querySelector('#project-form');
  const list = document.querySelector('#project-list');
  const preview = document.querySelector('#project-preview');
  let editing = null;
  let previewUrl;
  function reset() {
    editing = null;
    projectForm.reset();
    projectForm.elements.year.value = new Date().getFullYear();
    preview.hidden = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    document.querySelector('#project-remove-image-label').hidden = true;
    document.querySelector('#project-cancel').hidden = true;
    document.querySelector('#project-form-title').textContent = 'Dodaj projekt';
  }
  function edit(project) {
    reset();
    editing = project.id;
    for (const key of ['title', 'summary', 'description']) {
      projectForm.elements[key].value = pl(project[key]);
      projectForm.elements[`${key}En`].value = project[key]?.en || '';
    }
    for (const key of ['section', 'year', 'technologies', 'link', 'symbol'])
      projectForm.elements[key].value = project[key] || '';
    preview.src = project.src || '';
    preview.hidden = !project.src;
    document.querySelector('#project-remove-image-label').hidden = !project.src;
    document.querySelector('#project-cancel').hidden = false;
    document.querySelector('#project-form-title').textContent = 'Edytuj projekt';
    projectForm.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }
  window.loadAdminProjects = async () => {
    const projects = await api('/api/projects');
    document.querySelector('#project-count').textContent = `(${projects.length})`;
    list.replaceChildren();
    if (!projects.length) {
      const message = document.createElement('p');
      message.textContent = 'Dodaj swój pierwszy projekt.';
      list.append(message);
    }
    projects.forEach((project) => {
      const card = document.createElement('article');
      card.className = 'admin-photo';
      if (project.src) {
        const image = new Image();
        image.src = project.thumbUrl || project.src;
        image.addEventListener(
          'error',
          () => {
            if (project.thumbUrl) image.src = project.src;
          },
          { once: true },
        );
        image.alt = pl(project.title);
        image.loading = 'lazy';
        card.append(image);
      }
      const content = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = pl(project.title);
      const summary = document.createElement('p');
      summary.textContent = `${project.section === 'projects' ? 'Aktualne projekty' : 'Projekty i kompetencje'} · ${project.year}`;
      const actions = document.createElement('div');
      actions.className = 'form-actions';
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'subtle';
      editButton.textContent = 'Edytuj';
      editButton.addEventListener('click', () => edit(project));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = 'Usuń';
      remove.addEventListener('click', async () => {
        if (!confirm(`Usunąć „${pl(project.title)}” ze strony? Plik zdjęcia pozostanie na dysku.`))
          return;
        remove.disabled = true;
        try {
          await api(`/api/projects/${project.id}`, { method: 'DELETE' });
          if (editing === project.id) reset();
          await window.loadAdminProjects();
          status('Projekt usunięty.');
        } catch (error) {
          status(error.message, true);
          remove.disabled = false;
        }
      });
      actions.append(editButton, remove);
      content.append(title, summary, actions);
      card.append(content);
      list.append(card);
    });
  };
  projectForm.elements.image.addEventListener('change', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = projectForm.elements.image.files[0];
    if (file) {
      previewUrl = URL.createObjectURL(file);
      preview.src = previewUrl;
      preview.hidden = false;
      projectForm.elements.removeImage.checked = false;
    }
  });
  projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = editing;
    const input = Object.fromEntries(new FormData(projectForm));
    delete input.image;
    input.removeImage = projectForm.elements.removeImage.checked;
    const file = projectForm.elements.image.files[0];
    projectForm.inert = true;
    list.inert = true;
    status('Zapisywanie projektu…');
    try {
      if (file) Object.assign(input, await prepareImage(file));
      await api(id ? `/api/projects/${id}` : '/api/projects', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      reset();
      await window.loadAdminProjects();
      status('Projekt zapisany na stronie i w plikach do Git.');
    } catch (error) {
      status(error.message, true);
    } finally {
      projectForm.inert = false;
      list.inert = false;
    }
  });
  document.querySelector('#project-cancel').addEventListener('click', reset);
})();
