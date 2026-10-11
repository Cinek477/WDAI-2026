(() => {
  if (location.protocol === 'file:' || !document.querySelector('.navbar')) return;
  const root = document.documentElement;
  const initializers = (window.portfolioPages = {});
  let cleanup = [];
  let scope;
  function resetScope() {
    scope?.abort();
    cleanup.splice(0).forEach((dispose) => dispose());
    scope = new AbortController();
    window.portfolioPageScope = {
      signal: scope.signal,
      cleanup: (dispose) => cleanup.push(dispose),
    };
  }
  resetScope();
  const loaded = new Set([...document.scripts].map((script) => script.src));
  let current = new URL(location.href);
  let request;
  let transition;
  let updating = false;
  let pending;
  let scrollFrame;
  history.scrollRestoration = 'manual';
  history.replaceState({ ...history.state, portfolioScroll: scrollY }, '', location.href);
  addEventListener(
    'scroll',
    () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        if (!request)
          history.replaceState({ ...history.state, portfolioScroll: scrollY }, '', location.href);
      });
    },
    { passive: true },
  );
  function publicPage(url) {
    return (
      url.origin === location.origin &&
      /\/(?:index|hobby|contact|knowledge)\.html$|\/$/.test(url.pathname)
    );
  }
  async function loadScript(source) {
    if (loaded.has(source)) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    loaded.add(source);
  }
  async function navigate(url, pop = false, scroll = 0) {
    if (updating) {
      pending = { url, pop, scroll };
      return;
    }
    request?.abort();
    const controller = new AbortController();
    request = controller;
    transition?.skipTransition();
    try {
      const response = await fetch(url.href, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        headers: { Accept: 'text/html' },
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html'))
        throw new Error('Nie udało się pobrać strony.');
      const next = new DOMParser().parseFromString(await response.text(), 'text/html');
      const main = next.querySelector('main');
      if (!main || !next.querySelector('.navbar')) throw new Error('Brak zawartości strony.');
      for (const link of next.querySelectorAll('link[rel="stylesheet"]')) {
        const href = new URL(link.getAttribute('href'), url).href;
        if ([...document.styleSheets].some((sheet) => sheet.href === href)) continue;
        await new Promise((resolve, reject) => {
          const style = document.createElement('link');
          style.rel = 'stylesheet';
          style.href = href;
          style.onload = resolve;
          style.onerror = reject;
          document.head.insertBefore(style, document.querySelector('link[href$="controls.css"]'));
        });
      }
      if (controller.signal.aborted) return;
      updating = true;
      const update = async () => {
        if (controller.signal.aborted) return;
        resetScope();
        document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
        document.body.style.overflow = '';
        document.querySelector('main').replaceWith(main);
        document
          .querySelectorAll('body > footer, body > .photo-lightbox, body > .contact-fab')
          .forEach((node) => node.remove());
        next
          .querySelectorAll('body > footer, body > .photo-lightbox, body > .contact-fab')
          .forEach((node) => document.body.append(node));
        document.querySelector('.navigation').innerHTML =
          next.querySelector('.navigation').innerHTML;
        document.querySelector('.navbar').classList.remove('menu-open');
        document.title = next.title;
        if (!pop) history.pushState({ portfolioScroll: 0 }, '', url.href);
        current = new URL(url);
        window.portfolioRouting = true;
        try {
          for (const script of next.querySelectorAll('script[src]')) {
            const source = new URL(script.getAttribute('src'), url).href;
            if (/\/(?:router|theme|portfolio)\.js$/.test(source)) continue;
            await loadScript(source);
          }
          for (const script of next.querySelectorAll('script[src]')) {
            const name = script.getAttribute('src').split('/').at(-1);
            if (initializers[name]) await initializers[name]();
          }
        } finally {
          window.portfolioRouting = false;
        }
        window.refreshPortfolioPage?.();
        const target = url.hash
          ? document.getElementById(decodeURIComponent(url.hash.slice(1)))
          : null;
        if (target) target.scrollIntoView({ behavior: 'instant' });
        else scrollTo({ top: pop ? scroll : 0, behavior: 'instant' });
        main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      };
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        root.dataset.pageTransition = 'true';
        transition = document.startViewTransition(update);
        await transition.finished;
      } else await update();
    } catch (error) {
      if (!controller.signal.aborted) location.assign(url.href);
    } finally {
      if (request === controller) {
        request = null;
        transition = null;
        delete root.dataset.pageTransition;
      }
      updating = false;
      if (pending) {
        const next = pending;
        pending = null;
        navigate(next.url, next.pop, next.scroll);
      }
    }
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      link.hasAttribute('download') ||
      (link.target && link.target !== '_self')
    )
      return;
    const url = new URL(link.href);
    if (!publicPage(url) || (url.pathname === current.pathname && url.search === current.search))
      return;
    event.preventDefault();
    history.replaceState({ ...history.state, portfolioScroll: scrollY }, '', location.href);
    navigate(url);
  });
  addEventListener('popstate', (event) => {
    const url = new URL(location.href);
    if (!publicPage(url)) return location.reload();
    if (url.pathname === current.pathname && url.search === current.search) {
      current = url;
      scrollTo({ top: event.state?.portfolioScroll || 0, behavior: 'instant' });
    } else navigate(url, true, event.state?.portfolioScroll || 0);
  });
})();
