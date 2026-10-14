(() => {
  const selector =
    '.hero-actions a, .contact-submit, .admin-shell .admin-panel button:not(.danger), .admin-shell .admin-link, .lightbox-instagram, .gallery-filter, .contact-radio + label, .admin-shell .admin-tabs button';
  const namespace = 'http://www.w3.org/2000/svg';
  const tracked = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const epoch = performance.now();
  let serial = 0,
    frame = 0,
    scheduled = false;
  function node(name, attributes = {}) {
    const element = document.createElementNS(namespace, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }
  function resize(button) {
    const item = tracked.get(button);
    if (!item || button.clientWidth < 3 || button.clientHeight < 3) return;
    const w = button.clientWidth - 2,
      h = button.clientHeight - 2;
    const r = Math.max(
      0.1,
      Math.min(parseFloat(getComputedStyle(button).borderTopLeftRadius) || 0, w / 2, h / 2),
    );
    const d = `M ${1 + r} 1 H ${1 + w - r} A ${r} ${r} 0 0 1 ${1 + w} ${1 + r} V ${1 + h - r} A ${r} ${r} 0 0 1 ${1 + w - r} ${1 + h} H ${1 + r} A ${r} ${r} 0 0 1 1 ${1 + h - r} V ${1 + r} A ${r} ${r} 0 0 1 ${1 + r} 1 Z`;
    item.guide.setAttribute('d', d);
    const length = item.guide.getTotalLength();
    item.points = Array.from({ length: 256 }, (_, index) =>
      item.guide.getPointAtLength((length * index) / 256),
    );
  }
  function point(points, progress) {
    const index = (((progress % 1) + 1) % 1) * points.length;
    const first = points[Math.floor(index)],
      second = points[(Math.floor(index) + 1) % points.length];
    const fraction = index % 1;
    return {
      x: first.x + (second.x - first.x) * fraction,
      y: first.y + (second.y - first.y) * fraction,
    };
  }
  function animate(now) {
    frame = 0;
    if (document.hidden || reduced.matches) return;
    const phase = ((now - epoch) % 4000) / 4000;
    for (const [button, item] of tracked) {
      if (
        !item.points ||
        button.disabled ||
        button.getAttribute('aria-disabled') === 'true' ||
        !button.getClientRects().length
      )
        continue;
      const positions = Array.from({ length: 49 }, (_, index) =>
        point(item.points, phase - 0.35 + (index * 0.35) / 48),
      );
      item.trail.setAttribute(
        'd',
        positions
          .map((p, index) => `${index ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(' '),
      );
      const start = positions[0],
        end = positions.at(-1);
      for (const [name, value] of Object.entries({
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
      }))
        item.gradient.setAttribute(name, value);
    }
    frame = requestAnimationFrame(animate);
  }
  function resume() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(animate);
  }
  const sizes = new ResizeObserver((entries) => entries.forEach((entry) => resize(entry.target)));
  function sync() {
    scheduled = false;
    for (const [button] of tracked)
      if (!button.isConnected) {
        sizes.unobserve(button);
        tracked.delete(button);
      }
    document.querySelectorAll(selector).forEach((button) => {
      if (button.querySelector(':scope > .control-neon')) return;
      const id = `neon-${++serial}`;
      const svg = node('svg', { class: 'control-neon', 'aria-hidden': 'true', focusable: 'false' });
      const defs = node('defs');
      const guide = node('path');
      const gradient = node('linearGradient', { id, gradientUnits: 'userSpaceOnUse' });
      for (const [offset, color, opacity] of [
        ['0%', '#1769e8', 0],
        ['35%', '#38bdf8', 0.25],
        ['75%', '#7dd3fc', 0.8],
        ['100%', '#e0faff', 1],
      ])
        gradient.append(node('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }));
      defs.append(guide, gradient);
      const trail = node('path', {
        fill: 'none',
        stroke: `url(#${id})`,
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      svg.append(defs, trail);
      button.append(svg);
      tracked.set(button, { guide, gradient, trail });
      sizes.observe(button);
      resize(button);
    });
  }
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', resume);
  reduced.addEventListener('change', resume);
  sync();
  resume();
})();
