const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

async function harness() {
  class Element {
    constructor() { this.children = []; this.value = ''; this.hidden = false; this.textContent = ''; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(event, callback) { this[event] = callback; }
  }
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  const answer = (course, question, result) => ({ course, question, result,
    selected: ['Sí'], options: ['Sí', 'No'], type: 'single-choice', capturedAt: '2026-10-21T12:00:00Z' });
  const data = {
    'answer:1': answer('Inglés A1', 'Presente simple', 'correct'),
    'answer:2': answer(' Inglés A1 ', 'Verbos', 'incorrect'),
    'answer:3': answer('JavaScript', 'Variables', 'unknown'),
    aiSettings: { provider: 'gemini' }
  };
  let change;
  vm.runInNewContext(readFileSync(require.resolve('../history.js'), 'utf8'), {
    document: { getElementById: get, createElement: () => new Element() },
    chrome: {
      storage: { local: { get: async () => data }, onChanged: { addListener: callback => { change = callback; } } },
      tabs: { query: async () => [{ id: 1 }], sendMessage: async () => ({ exam: false }) }
    }
  });
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await flush();
  return { get, data, refresh: async () => { change(); await flush(); } };
}

test('el historial agrupa por curso y abre solo sus respuestas sin modificar los datos', async () => {
  const h = await harness();
  const original = JSON.stringify(h.data);
  assert.equal(h.get('summary').textContent, '2 cursos');
  assert.equal(h.get('records').children.length, 2);
  assert.equal(h.get('records').children[0].children[0].textContent, 'Inglés A1');
  assert.match(h.get('records').children[0].children[1].textContent, /2 respuestas/);
  h.get('records').children[0].click();
  assert.equal(h.get('history-heading').textContent, 'Inglés A1');
  assert.equal(h.get('records').children.length, 2);
  assert.equal(h.get('summary').textContent, '2 respuestas · 1 correctas · 1 incorrectas');
  assert.equal(h.get('back-courses').hidden, false);
  h.get('back-courses').click();
  assert.equal(h.get('summary').textContent, '2 cursos');
  assert.equal(h.get('back-courses').hidden, true);
  assert.equal(JSON.stringify(h.data), original);
});

test('el buscador encuentra preguntas, cursos y respuestas de todo el historial desde un curso', async () => {
  const h = await harness();
  h.get('records').children[0].click();
  for (const query of ['Variables', 'JavaScript', 'Sí']) {
    h.get('search').value = query;
    h.get('search').input();
    assert.equal(h.get('history-heading').textContent, 'Resultados en todos los cursos');
    assert.equal(h.get('records').children.length, query === 'Sí' ? 3 : 1);
  }
  h.get('search').value = 'inexistente';
  h.get('search').input();
  assert.equal(h.get('summary').textContent, '0 respuestas · 0 correctas · 0 incorrectas');
  h.get('search').value = '';
  h.get('search').input();
  assert.equal(h.get('history-heading').textContent, 'Inglés A1');
  h.get('search').value = 'Variables';
  h.get('search').input();
  h.get('back-courses').click();
  assert.equal(h.get('search').value, '');
  assert.equal(h.get('summary').textContent, '2 cursos');
});

test('limpiar el historial mientras se ve un curso vuelve a la lista vacía', async () => {
  const h = await harness();
  h.get('records').children[0].click();
  for (const key of Object.keys(h.data)) if (key.startsWith('answer:')) delete h.data[key];
  await h.refresh();
  assert.equal(h.get('summary').textContent, '0 cursos');
  assert.equal(h.get('records').children[0].textContent, 'Todavía no hay respuestas para mostrar.');
  assert.equal(h.get('back-courses').hidden, true);
});
