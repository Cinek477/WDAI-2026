(() => {
  const selector = '.hero-actions a, .contact-submit, .admin-shell .admin-panel button:not(.danger), .admin-shell .admin-link, .lightbox-instagram, .gallery-filter, .contact-radio + label, .admin-shell .admin-tabs button';
  const tracked = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const epoch = performance.now();
  const sampleCount = 1024;
  const steps = 96;
  const colors = Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    const head = Math.max(0, (t - 0.7) / 0.3);
    return `rgba(${Math.round(56 + 168 * head)},${Math.round(189 + 61 * head)},${Math.round(248 + 7 * head)},${Math.pow(t, 1.65).toFixed(3)})`;
  });
  let frame = 0, scheduled = false;
  function resize(button) {
    const item = tracked.get(button);
    if (!item || button.clientWidth < 3 || button.clientHeight < 3) return;
    const width = button.clientWidth, height = button.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const radius = Math.min(parseFloat(getComputedStyle(button).borderTopLeftRadius) || 0, (width - 2) / 2, (height - 2) / 2);
    const key = `${width}:${height}:${radius}:${ratio}`;
    if (item.key === key) return;
    item.key = key;
    const w = width - 2, h = height - 2, r = Math.max(0.1, radius);
    item.guide.setAttribute('d', `M ${1+r} 1 H ${1+w-r} A ${r} ${r} 0 0 1 ${1+w} ${1+r} V ${1+h-r} A ${r} ${r} 0 0 1 ${1+w-r} ${1+h} H ${1+r} A ${r} ${r} 0 0 1 1 ${1+h-r} V ${1+r} A ${r} ${r} 0 0 1 ${1+r} 1 Z`);
    const length = item.guide.getTotalLength();
    item.points = new Float32Array(sampleCount * 2);
    for (let i = 0; i < sampleCount; i++) {
      const point = item.guide.getPointAtLength(length * i / sampleCount);
      item.points[i * 2] = point.x;
      item.points[i * 2 + 1] = point.y;
    }
    item.width = width; item.height = height;
    item.canvas.width = Math.round(width * ratio);
    item.canvas.height = Math.round(height * ratio);
    item.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    item.context.lineWidth = 1.8;
    item.context.lineCap = 'round';
    item.context.lineJoin = 'round';
  }
  function position(points, progress, target) {
    const sample = ((progress % 1 + 1) % 1) * sampleCount;
    const index = Math.floor(sample), next = (index + 1) % sampleCount, part = sample - index;
    target[0] = points[index * 2] + (points[next * 2] - points[index * 2]) * part;
    target[1] = points[index * 2 + 1] + (points[next * 2 + 1] - points[index * 2 + 1]) * part;
  }
  const first = new Float32Array(2), second = new Float32Array(2);
  function animate(now) {
    frame = 0;
    if (document.hidden || reduced.matches) return;
    const phase = ((now - epoch) % 4000) / 4000;
    let active = false;
    for (const [button, item] of tracked) {
      if (!item.visible || !item.points || button.disabled || button.getAttribute('aria-disabled') === 'true') continue;
      active = true;
      const context = item.context;
      context.clearRect(0, 0, item.width, item.height);
      position(item.points, phase - 0.35, first);
      for (let i = 0; i < steps; i++) {
        position(item.points, phase - 0.35 + (i + 1) * 0.35 / steps, second);
        context.strokeStyle = colors[i];
        context.beginPath();
        context.moveTo(first[0], first[1]);
        context.lineTo(second[0], second[1]);
        context.stroke();
        first.set(second);
      }
    }
    if (active) frame = requestAnimationFrame(animate);
  }
  function resume() {
    if (!frame && !document.hidden && !reduced.matches) frame = requestAnimationFrame(animate);
  }
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = tracked.get(entry.target);
      if (item) item.visible = entry.isIntersecting;
    }
    resume();
  });
  const sizes = new ResizeObserver(entries => entries.forEach(entry => resize(entry.target)));
  function sync() {
    scheduled = false;
    for (const [button] of tracked) if (!button.isConnected) {
      sizes.unobserve(button); visibility.unobserve(button); tracked.delete(button);
    }
    document.querySelectorAll(selector).forEach(button => {
      if (button.querySelector(':scope > .control-neon')) return;
      const canvas = document.createElement('canvas');
      canvas.className = 'control-neon';
      canvas.setAttribute('aria-hidden', 'true');
      const context = canvas.getContext('2d');
      if (!context) return;
      button.append(canvas);
      const guide = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tracked.set(button, { canvas, context, guide, visible: false });
      sizes.observe(button); visibility.observe(button); resize(button);
    });
    resume();
  }
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled'] });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else resume();
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { cancelAnimationFrame(frame); frame = 0; } else resume();
  });
  sync();
})();
