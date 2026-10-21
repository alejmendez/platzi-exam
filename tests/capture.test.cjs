const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const core = require('../core.js');

test('solo activa las rutas de examen y reconoce los contadores observados', () => {
  assert.equal(core.isExam('/evaluacion/123/'), true);
  assert.equal(core.isExam('/cursos/ingles/'), false);
  assert.equal(core.isExam('/discusiones/examen/'), false);
  assert.deepEqual(core.counters('Correctas 3/18', '4 de 5 vidas restantes'), { correct: 3, lives: 4 });
  assert.deepEqual(core.counters('', ''), { correct: null, lives: null });
});

test('el resultado exige evidencia y conserva la incertidumbre si se contradice', () => {
  const before = { correct: 0, lives: 5 };
  assert.equal(core.result(before, { correct: 1, lives: 5 }), 'correct');
  assert.equal(core.result(before, { correct: 0, lives: 4 }), 'incorrect');
  assert.equal(core.result(before, before), 'unknown');
  assert.equal(core.result(before, { correct: 1, lives: 4 }), 'unknown');
  assert.equal(core.result(before, { correct: null, lives: null }), 'unknown');
});

async function harness(initial = {}, kind = 'single-choice') {
  const data = { ...initial };
  const state = { question: 'Pregunta uno', score: 0, lives: 5, checked: false, feedback: null, kind, gaps: [], announcement: '' };
  let observe, click, storageChange;
  const created = [];
  class Element {
    constructor() { this.children = []; this.isConnected = true; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    attachShadow() { this.shadowRoot = new Element(); return this.shadowRoot; }
    setAttribute() {}
    contains() { return false; }
    after() {}
    remove() { this.isConnected = false; }
  }
  const option = { innerText: 'Respuesta A', querySelector: () => ({ innerText: 'Respuesta A' }) };
  const control = new Element();
  control.closest = selector => selector.includes('answer-option') ? option : null;
  control.matches = selector => selector.includes('[role="radio"]');
  const container = {
    contains: () => true,
    querySelector(selector) {
      if (selector.includes('questionText')) return Object.assign(new Element(), { innerText: state.question });
      if (selector.includes('FillTheGap__statement') && kind === 'fill-gaps') return { childNodes: [
        { nodeType: 3, textContent: 'Ireland: ' },
        { nodeType: 1, hasAttribute: () => true, getAttribute: () => 'gap_1' }
      ] };
      if (selector.includes('InlineCorrectFeedback') && state.feedback === 'correct') return {};
      if (selector.includes('AnswerOption--error') && state.feedback === 'incorrect') return option;
      if (selector.includes('fill-the-gap') && kind === 'fill-gaps') return {};
      if (selector.includes('magnet-cards') && kind === 'ordering') return {};
      if (selector.includes('MatchCardsAdapter') && kind === 'matching') return {};
      if (selector.includes('swipe-cards') && kind === 'categorization') return {};
      if (selector.includes('SwipeCardOuter') && kind === 'categorization') return { querySelector: () => ({ innerText: 'Tarjeta' }) };
      if (selector.includes('radiogroup') && kind === 'single-choice') return {};
      if (selector.includes('aria-checked') && state.checked) return control;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-gap-id]') return state.gaps;
      if (selector === '[role="status"]') return [{ innerText: state.announcement }];
      if (selector.includes('Categorizar como')) return [{ getAttribute: () => 'Categorizar como Grupo A' }];
      return [option];
    }
  };
  const target = new Element();
  target.closest = () => control;
  const context = {
    PlatziHistory: core, crypto: webcrypto, structuredClone, Element, location: { pathname: '/evaluacion/123/' },
    document: {
      title: 'Curso de prueba - Examen | Platzi', body: {},
      createElement: tag => { const node = new Element(); node.tagName = tag; created.push(node); return node; },
      addEventListener: (name, listener) => { if (name === 'click') click = listener; },
      querySelector(selector) {
        if (selector.includes('questionContainer')) return container;
        if (selector.includes('CourseTitle')) return { innerText: 'Curso de prueba' };
        if (selector.includes('progressbar')) return { getAttribute: () => `Correctas ${state.score}/18` };
        if (selector.includes('vidas restantes')) return { getAttribute: () => `${state.lives} de 5 vidas restantes` };
        return null;
      }
    },
    MutationObserver: class { constructor(callback) { observe = callback; } observe() {} },
    chrome: {
      storage: { local: { get: async () => ({ ...initial }), set: async values => Object.assign(data, values) },
        onChanged: { addListener: callback => { storageChange = callback; } } },
      runtime: { onMessage: { addListener() {} } }
    }
  };
  vm.runInNewContext(readFileSync(require.resolve('../content.js'), 'utf8'), context);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  await flush();
  return { data, state, created, observe: () => observe([{ target: context.document.body }]), click: () => click({ target }), flush,
    choose(value, type) {
      const node = new Element(); node.innerText = value;
      node.matches = selector => !selector.includes(':disabled') && (selector === '[data-card-type]' || selector.includes('Categorizar como'));
      node.getAttribute = name => name === 'data-card-type' ? type : `Categorizar como ${value}`;
      node.closest = () => null;
      node.querySelector = () => ({ innerText: value });
      const source = new Element(); source.closest = () => node;
      click({ target: source });
    },
    pause: () => storageChange({ enabled: { newValue: false } }, 'local') };
}

test('guarda antes de recibir feedback y actualiza el mismo registro aunque cambie la pregunta', async () => {
  const h = await harness();
  h.click(); await h.flush();
  assert.equal(Object.values(h.data)[0].result, 'unknown');
  h.state.question = 'Pregunta dos'; h.state.score = 1; h.observe(); await h.flush();
  const records = Object.values(h.data);
  assert.equal(records.length, 1);
  assert.equal(records[0].question, 'Pregunta uno');
  assert.deepEqual(records[0].selected, ['Respuesta A']);
  assert.equal(records[0].result, 'correct');
});

test('una pérdida de vida registra incorrecta y pausar evita capturas nuevas', async () => {
  const h = await harness();
  h.click(); h.state.lives = 4; h.observe(); await h.flush();
  assert.equal(Object.values(h.data)[0].result, 'incorrect');
  h.pause(); h.state.question = 'Otra'; h.click(); await h.flush();
  assert.equal(Object.keys(h.data).length, 1);
});

test('no asigna el acierto de una pregunta posterior a una respuesta sin confirmar', async () => {
  const h = await harness();
  h.click(); await h.flush();
  h.state.question = 'Pregunta dos'; h.observe(); h.click(); await h.flush();
  h.state.score = 1; h.observe(); await h.flush();
  const records = Object.values(h.data);
  assert.equal(records.find(r => r.question === 'Pregunta uno').result, 'unknown');
  assert.equal(records.find(r => r.question === 'Pregunta dos').result, 'correct');
});

test('manifest restringe la captura a Platzi y solicita únicamente almacenamiento', () => {
  const manifest = JSON.parse(readFileSync(require.resolve('../manifest.json'), 'utf8'));
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://platzi.com/*', 'https://www.platzi.com/*']);
  for (const file of [...manifest.content_scripts[0].js, 'history.js']) {
    new vm.Script(readFileSync(require.resolve('../' + file), 'utf8'), { filename: file });
  }
});

test('lee acierto y error explícitos aunque no haya contadores', async () => {
  for (const result of ['correct', 'incorrect']) {
    const h = await harness();
    h.state.score = null; h.state.lives = null;
    h.click(); h.state.feedback = result; h.observe(); await h.flush();
    assert.equal(Object.values(h.data)[0].result, result);
    assert.match(Object.values(h.data)[0].evidence.source, /^visible-/);
  }
});

test('reconoce opciones reordenadas, sin mezclar cursos, formatos ni preguntas parecidas', () => {
  const record = { course: 'Curso', question: '¿Pregunta?', type: 'single-choice', options: ['A', 'B'] };
  const question = { course: ' Curso ', question: '¿Pregunta?', kind: 'single-choice', options: ['B', 'A'] };
  assert.equal(core.sameQuestion(record, question), true);
  for (const change of [{ course: 'Otro' }, { question: '¿Pregunta distinta?' }, { kind: 'matching' }, { options: ['A', 'C'] }]) {
    assert.equal(core.sameQuestion(record, { ...question, ...change }), false);
  }
});

test('un fallo global no convierte cada pareja en incorrecta y unknown nunca se presenta como error', () => {
  const combination = { type: 'matching', selected: ['A → B', 'C → D'], result: 'incorrect',
    steps: [{ prompt: 'A', answer: 'B', result: 'unknown' }, { prompt: 'C', answer: 'D', result: 'unknown' }] };
  assert.equal(core.notes(combination).length, 1);
  assert.match(core.notes(combination)[0].text, /combinación NO fue correcta/);
  const unknown = { type: 'single-choice', selected: ['A'], result: 'unknown' };
  assert.match(core.notes(unknown)[0].text, /sin confirmar/);
  assert.doesNotMatch(core.notes(unknown)[0].text, /NO es/);
});

test('muestra respuestas anteriores en un elemento HTML usando texto seguro', async () => {
  const record = { id: 'anterior', course: 'Curso de prueba', question: 'Pregunta uno', type: 'single-choice',
    options: ['Respuesta A'], selected: ['<img src=x onerror=alert(1)>'], result: 'incorrect' };
  const h = await harness({ 'answer:anterior': record });
  const panel = h.created.find(node => node.tagName === 'aside');
  assert.ok(panel);
  const body = panel.shadowRoot.children[1];
  assert.match(body.children[0].textContent, /Ya respondiste/);
  assert.equal(body.children[1].textContent, 'Esta NO es la respuesta: <img src=x onerror=alert(1)>');
});

test('un clic reenviado por un label no crea dos intentos', async () => {
  const h = await harness();
  h.click(); h.click(); await h.flush();
  assert.equal(Object.keys(h.data).length, 1);
});

test('guarda el orden y las parejas completas sin perder la asociación', async () => {
  const order = await harness({}, 'ordering');
  order.choose('Primero'); order.choose('Segundo'); await order.flush();
  assert.deepEqual(Object.values(order.data)[0].selected, ['Posición 1 → Primero', 'Posición 2 → Segundo']);
  const match = await harness({}, 'matching');
  match.choose('Concepto', 'concept'); await match.flush();
  assert.equal(Object.keys(match.data).length, 0);
  match.choose('Definición', 'definition'); await match.flush();
  assert.deepEqual(Object.values(match.data)[0].selected, ['Concepto → Definición']);
});

test('califica una tarjeta por su anuncio sin convertir la pregunta completa en correcta', async () => {
  const h = await harness({}, 'categorization');
  h.choose('Grupo A');
  h.state.announcement = 'Correcto. Tarjeta categorizado como Grupo A. 1 cartas restantes.';
  h.observe(); await h.flush();
  assert.equal(Object.values(h.data)[0].steps[0].result, 'correct');
  assert.equal(Object.values(h.data)[0].result, 'unknown');
});

test('captura huecos desde el DOM y conserva la afirmación estable al llenarlos', async () => {
  const h = await harness({}, 'fill-gaps');
  h.state.gaps = [{ className: 'GapSlot--correct__Prkny', getAttribute: name => name === 'data-gap-id' ? 'gap_1' : 'Gap filled with Irish',
    querySelector: () => ({ innerText: 'Irish' }) }];
  h.state.feedback = 'correct'; h.observe(); await h.flush();
  const record = Object.values(h.data)[0];
  assert.equal(record.question, 'Pregunta uno\nIreland: [gap_1]');
  assert.deepEqual(record.selected, ['Hueco gap_1 → Irish']);
  assert.equal(record.steps[0].result, 'correct');
  assert.equal(record.result, 'correct');
});
