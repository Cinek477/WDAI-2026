const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Routing: internal navigation, history, scope cleanup and ordinary links', async () => {
  const events = {};
  const assigned = [];
  const fetched = [];
  let view = 'index';
  let transitions = 0;
  let disposed = 0;
  const location = {
    href: 'http://localhost:3000/index.html',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    assign: (value) => assigned.push(value),
    reload: () => assigned.push('reload'),
  };
  const history = {
    state: null,
    replaceState(state) {
      this.state = state;
    },
    pushState(state, _, href) {
      this.state = state;
      location.href = href;
    },
  };
  const main = (name) => ({
    setAttribute() {},
    focus() {},
    replaceWith(next) {
      view = next.name;
    },
    name,
  });
  const navigation = { innerHTML: '', classList: { remove() {} } };
  const document = {
    documentElement: { dataset: {} },
    scripts: [],
    styleSheets: [],
    title: 'Index',
    querySelector(selector) {
      return selector === 'main' ? main(view) : navigation;
    },
    querySelectorAll() {
      return [];
    },
    body: { style: {}, append() {} },
    addEventListener(name, listener) {
      events[name] = listener;
    },
    getElementById() {
      return null;
    },
    startViewTransition(update) {
      transitions++;
      return { skipTransition() {}, finished: Promise.resolve().then(update) };
    },
  };
  const context = {
    document,
    history,
    location,
    URL,
    AbortController,
    AbortSignal,
    console,
    scrollY: 80,
    requestAnimationFrame: (callback) => {
      callback();
      return 0;
    },
    scrollTo() {},
    matchMedia: () => ({ matches: false }),
    addEventListener: (name, listener) => {
      events[name] = listener;
    },
    fetch: async (href) => {
      fetched.push(href);
      return {
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => new URL(href).pathname,
      };
    },
    DOMParser: class {
      parseFromString(path) {
        return {
          title: path,
          querySelector: (selector) => (selector === 'main' ? main(path) : navigation),
          querySelectorAll: () => [],
        };
      }
    },
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync('assets/js/router.js', 'utf8'), context);
  const signal = context.portfolioPageScope.signal;
  context.portfolioPageScope.cleanup(() => disposed++);
  const click = (path, extra = {}) => {
    let prevented = false;
    const link = {
      href: new URL(path, location.href).href,
      target: '',
      hasAttribute: (name) => name === 'download' && extra.download,
    };
    events.click({
      target: { closest: () => link },
      button: 0,
      preventDefault() {
        prevented = true;
      },
      ...extra,
    });
    return prevented;
  };
  for (const path of ['#projects', '/admin.html', '/assets/CV.pdf', 'https://example.com/'])
    assert.equal(click(path), false);
  assert.equal(click('/hobby.html', { ctrlKey: true }), false);
  assert.equal(click('/hobby.html', { download: true }), false);
  assert.equal(click('/hobby.html'), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view, '/hobby.html');
  assert.equal(document.title, '/hobby.html');
  assert.equal(location.href, 'http://localhost:3000/hobby.html');
  assert.equal(signal.aborted, true);
  assert.equal(disposed, 1);
  assert.equal(transitions, 1);
  location.href = 'http://localhost:3000/index.html';
  events.popstate({ state: { portfolioScroll: 80 } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(view, '/index.html');
  assert.equal(transitions, 2);
  assert.equal(fetched.length, 2);
  assert.deepEqual(assigned, []);
  assert.equal(document.documentElement.dataset.pageTransition, undefined);
  context.fetch = async () => {
    throw new Error('Offline');
  };
  assert.equal(click('/contact.html'), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(assigned, ['http://localhost:3000/contact.html']);
});
