const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ai = require('../ai.js');
const single = { kind: 'single-choice', course: 'Curso', question: 'Elige una opción', options: ['Uno', 'Dos', 'Tres', 'Cuatro'] };
const answer = answers => JSON.stringify({ answers });

test('cada formato produce instrucciones concretas y respuestas breves con textos de las opciones', () => {
  assert.deepEqual(ai.parse(answer([{ target: 'answer', option: 4 }]), single), [{ label: 'Respuesta sugerida: D', text: 'Cuatro' }]);
  const ordering = { ...single, kind: 'ordering', options: ['Segundo', 'Primero'] };
  assert.deepEqual(ai.parse(answer([{ target: '2', option: 1 }, { target: '1', option: 2 }]), ordering), [
    { label: '1.', text: 'Primero' }, { label: '2.', text: 'Segundo' }
  ]);
  const gaps = { ...single, kind: 'fill-gaps', question: 'Ireland: [gap_1]; Germany: [gap_2]', options: ['German', 'Irish', 'Spanish'], groups: { gaps: ['gap_1', 'gap_2'] } };
  assert.deepEqual(ai.parse(answer([{ target: 'gap_2', option: 1 }, { target: 'gap_1', option: 2 }]), gaps), [
    { label: 'Hueco 1', text: 'Irish' }, { label: 'Hueco 2', text: 'German' }
  ]);
  const matching = { ...single, kind: 'matching', options: ['Germany', 'Ireland', 'Irish', 'German'], groups: { left: [1, 2], right: [3, 4] } };
  assert.deepEqual(ai.parse(answer([{ target: '1', option: 4 }, { target: '2', option: 3 }]), matching), [
    { label: 'Germany', text: 'German' }, { label: 'Ireland', text: 'Irish' }
  ]);
  const categories = { ...matching, kind: 'categorization' };
  assert.equal(ai.parse(answer([{ target: '1', option: 3 }, { target: '2', option: 3 }]), categories).length, 2);
  for (const q of [single, ordering, gaps, matching, categories]) {
    const prompt = ai.prompt(q);
    assert.ok(JSON.parse(prompt.user).task.length > 20);
    assert.match(prompt.system, /Sin explicación/);
  }
});

test('rechaza opciones inventadas, huecos faltantes, duplicados y parejas fuera de su columna', () => {
  assert.throws(() => ai.parse(answer([{ target: 'answer', option: 9 }]), single));
  assert.throws(() => ai.parse('No estoy seguro', single));
  assert.throws(() => ai.parse('null', single));
  assert.throws(() => ai.parse(answer([]), single));
  const q = { ...single, kind: 'matching', groups: { left: [1, 2], right: [3, 4] } };
  for (const invalid of [
    [{ target: '1', option: 1 }, { target: '2', option: 4 }],
    [{ target: '1', option: 3 }, { target: '2', option: 3 }],
    [{ target: '1', option: 3 }, { target: '1', option: 4 }]
  ]) assert.throws(() => ai.parse(answer(invalid), q));
  assert.throws(() => ai.checkQuestion({ ...q, groups: { left: [1], right: [1, 2, 3, 4] } }));
  assert.throws(() => ai.checkQuestion({ ...single, options: ['A'.repeat(3001), 'B'] }));
});

test('los proveedores reciben la clave solo en cabeceras, y el prompt solo contiene el ejercicio', () => {
  for (const provider of ['gemini', 'openrouter']) {
    const r = ai.request(provider, ai.providers[provider].model, 'test-key', { ...single, apiKey: 'discard-me', history: ['no enviar'], html: '<body>privado</body>' });
    assert.doesNotMatch(r.url, /test-key/);
    const body = JSON.stringify(r.body);
    assert.doesNotMatch(body, /test-key|discard-me|no enviar|<body>/);
    assert.match(JSON.stringify(r.headers), /test-key/);
  }
  assert.throws(() => ai.request('__proto__', 'model', 'test-key', single));
  assert.throws(() => ai.request('gemini', 'model?key=leak', 'test-key', single));
});

test('consulta ambos protocolos y normaliza las respuestas sin incluir explicaciones del modelo', async () => {
  for (const provider of ['gemini', 'openrouter']) {
    const result = await ai.suggest({ provider, model: ai.providers[provider].model }, 'test-key', single, async (url, options) => {
      assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
      assert.ok(options.signal);
      const body = JSON.parse(options.body);
      assert.equal(provider === 'gemini' ? body.generationConfig.maxOutputTokens : body.max_tokens, 4096);
      const raw = answer([{ target: 'answer', option: 2 }]);
      return { ok: true, json: async () => provider === 'gemini' ? { candidates: [{ content: { parts: [{ text: 'razonamiento oculto', thought: true }, { text: raw }] } }] } : { choices: [{ message: { content: raw } }] } };
    });
    assert.deepEqual(result, [{ label: 'Respuesta sugerida: B', text: 'Dos' }]);
  }
});

test('maneja clave ausente, cupo, autenticación, modelos y timeout sin filtrar respuestas del servidor', async () => {
  const settings = { provider: 'gemini', model: ai.providers.gemini.model };
  await assert.rejects(ai.suggest(settings, '', single), /API key/);
  for (const status of [400, 401, 402, 403, 404, 429, 503]) {
    await assert.rejects(ai.suggest(settings, 'test-key', single, async () => ({ ok: false, status, json: () => { throw new Error('test-key'); } })), error => !error.message.includes('test-key'));
  }
  await assert.rejects(ai.suggest(settings, 'test-key', single, async () => { throw { name: 'TimeoutError' }; }), /tardó demasiado/);
});

function background() {
  let listener;
  const keys = new Map(), local = {};
  const context = {
    URL, AbortController, crypto: require('node:crypto').webcrypto, TextEncoder, importScripts() {}, PlatziAI: { ...ai }, PlatziHistory: require('../core.js'),
    PlatziVault: { async access(provider, operation, value) { if (operation === 'put') keys.set(provider, value); if (operation === 'delete') keys.delete(provider); return keys.get(provider); } },
    chrome: { runtime: { getURL: path => `chrome-extension://test/${path}`, onMessage: { addListener(fn) { listener = fn; } } },
      storage: { local: { get: async () => local, set: async data => Object.assign(local, data), remove: async keys => keys.forEach(key => delete local[key]) } },
      permissions: { contains: async () => true } }
  };
  vm.runInNewContext(readFileSync(require.resolve('../background.js'), 'utf8'), context);
  return { context, keys, local, send: (message, sender) => new Promise(resolve => listener(message, sender, resolve)) };
}
const popup = { url: 'chrome-extension://test/history.html' };
const exam = { url: 'https://platzi.com/evaluacion/test/', documentId: 'first-document', tab: { id: 1 } };

test('las páginas de Platzi no pueden leer ni cambiar claves y el historial exportable no las contiene', async () => {
  const h = background();
  assert.equal((await h.send({ type: 'ai.settings.save', provider: 'gemini', model: ai.providers.gemini.model, apiKey: 'test-key' }, popup)).ok, true);
  assert.equal(h.keys.get('gemini'), 'test-key');
  assert.doesNotMatch(JSON.stringify(h.local), /test-key/);
  const visible = await h.send({ type: 'ai.settings.get' }, popup);
  assert.equal(visible.configured.gemini, true); assert.doesNotMatch(JSON.stringify(visible), /test-key/);
  assert.equal((await h.send({ type: 'ai.settings.get' }, exam)).ok, false);
  assert.equal((await h.send({ type: 'ai.settings.deleteKey', provider: 'gemini' }, exam)).ok, false);
  assert.equal((await h.send({ type: 'ai.suggest', question: single }, { url: 'https://example.com/evaluacion/test/', tab: { id: 1 } })).ok, false);
  assert.equal((await h.send({ type: 'ai.settings.deleteKey', provider: 'gemini' }, popup)).ok, true);
  assert.equal(h.keys.has('gemini'), false);
});

test('el fondo admite una sola consulta simultánea por pestaña', async () => {
  const h = background();
  h.keys.set('gemini', 'test-key');
  let finish, started;
  const ready = new Promise(resolve => { started = resolve; });
  h.context.PlatziAI.suggest = () => new Promise(resolve => { finish = resolve; started(); });
  const first = h.send({ type: 'ai.suggest', question: single }, exam);
  await ready;
  const second = await h.send({ type: 'ai.suggest', question: single }, exam);
  assert.equal(second.ok, false); assert.match(second.error, /consulta en curso/);
  finish([{ label: 'Respuesta sugerida: A', text: 'Uno' }]);
  assert.equal((await first).ok, true);
});

test('la caché conserva la respuesta y recalcula la letra si cambia el orden', () => {
  const saved = { question: single, lines: ai.parse(answer([{ target: 'answer', option: 4 }]), single) };
  const shuffled = { ...single, options: ['Cuatro', 'Tres', 'Dos', 'Uno'] };
  assert.deepEqual(ai.reuseSuggestion(saved, shuffled), [{ label: 'Respuesta sugerida: A', text: 'Cuatro' }]);
  assert.equal(ai.reuseSuggestion(saved, { ...single, course: 'Otro curso' }), null);
  const matching = { ...single, kind: 'matching', options: ['A', 'B', 'Uno', 'Dos'], groups: { left: [1, 2], right: [3, 4] } };
  const pairs = { question: matching, lines: ai.parse(answer([{ target: '1', option: 3 }, { target: '2', option: 4 }]), matching) };
  assert.deepEqual(ai.reuseSuggestion(pairs, { ...matching, options: ['B', 'A', 'Dos', 'Uno'] }), [{ label: 'B', text: 'Dos' }, { label: 'A', text: 'Uno' }]);
  assert.equal(ai.reuseSuggestion(pairs, { ...matching, groups: { left: [1, 3], right: [2, 4] } }), null);
});

test('recargar cancela la consulta vieja y su finalizacion no desbloquea la nueva', async () => {
  const h = background(); h.keys.set('gemini', 'test-key');
  const requests = [];
  let notify;
  h.context.PlatziAI.suggest = (_settings, _key, _question, _fetcher, signal) => new Promise(resolve => {
    requests.push({ resolve, signal }); notify?.();
  });
  const waitForRequest = () => new Promise(resolve => { notify = resolve; });
  let started = waitForRequest();
  const old = h.send({ type: 'ai.suggest', question: single }, exam);
  await started;
  const reloaded = { ...exam, documentId: 'reloaded-document' };
  // Reading the cache from the new page cancels work belonging to the old page.
  assert.equal((await h.send({ type: 'ai.cached', question: single }, reloaded)).ok, true);
  assert.equal(requests[0].signal.aborted, true);
  started = waitForRequest();
  const fresh = h.send({ type: 'ai.suggest', auto: true, question: single }, reloaded);
  h.local.aiSettings = { autoSuggest: true };
  await started;
  requests[0].resolve([{ label: 'Respuesta sugerida: A', text: 'Uno' }]);
  assert.equal((await old).skipped, true);
  assert.equal(Object.keys(h.local).some(key => key.startsWith('ai-cache:')), false);
  assert.equal((await h.send({ type: 'ai.suggest', question: single }, reloaded)).ok, false);
  requests[1].resolve([{ label: 'Respuesta sugerida: B', text: 'Dos' }]);
  assert.equal((await fresh).ok, true);
  const cached = await h.send({ type: 'ai.cached', question: single }, reloaded);
  assert.equal(cached.lines[0].text, 'Dos');
});

test('la cancelacion de una pagina se propaga a la peticion del proveedor', async () => {
  const controller = new AbortController(); let requestSignal;
  const result = ai.suggest({ provider: 'gemini', model: ai.providers.gemini.model }, 'test-key', single,
    async (_url, options) => {
      requestSignal = options.signal;
      return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject({ name: 'AbortError' }), { once: true }));
    }, controller.signal);
  controller.abort();
  assert.equal(requestSignal.aborted, true);
  await assert.rejects(result, /Pulsa Sugerir con IA/);
});

test('automático apagado no consulta, encendido omite respuestas previas y reutiliza IA', async () => {
  const h = background(); let calls = 0;
  h.keys.set('gemini', 'test-key');
  h.context.PlatziAI.suggest = async () => { calls++; return [{ label: 'Respuesta sugerida: A', text: 'Uno' }]; };
  assert.equal((await h.send({ type: 'ai.suggest', auto: true, question: single }, exam)).skipped, true);
  h.local.aiSettings = { autoSuggest: true };
  h.local['answer:old'] = { ...single, type: single.kind, selected: ['Uno'] };
  assert.equal((await h.send({ type: 'ai.suggest', auto: true, question: single }, exam)).skipped, true);
  delete h.local['answer:old'];
  assert.equal((await h.send({ type: 'ai.suggest', auto: true, question: single }, exam)).ok, true);
  const cached = await h.send({ type: 'ai.cached', question: { ...single, options: ['Cuatro', 'Tres', 'Dos', 'Uno'] } }, exam);
  assert.equal(cached.cached, true); assert.equal(cached.lines[0].label, 'Respuesta sugerida: D');
  await h.send({ type: 'ai.suggest', auto: true, question: single }, exam);
  assert.equal(calls, 1);
});

test('limpiar elimina respuestas y caché, conserva claves y bloquea resultados pendientes', async () => {
  const h = background(); let finish, started;
  const ready = new Promise(resolve => { started = resolve; });
  h.keys.set('gemini', 'test-key'); h.local.aiSettings = { autoSuggest: true };
  h.local['answer:old'] = {}; h.local['ai-cache:old'] = {};
  h.context.PlatziAI.suggest = () => new Promise(resolve => { finish = resolve; started(); });
  const pending = h.send({ type: 'ai.suggest', question: single }, exam);
  await ready;
  assert.equal((await h.send({ type: 'ai.history.clear' }, exam)).ok, false);
  assert.equal((await h.send({ type: 'ai.history.clear' }, popup)).ok, true);
  finish([{ label: 'Respuesta sugerida: A', text: 'Uno' }]);
  assert.equal((await pending).skipped, true);
  assert.equal(Object.keys(h.local).some(key => /^(answer:|ai-cache:)/.test(key)), false);
  assert.equal(h.keys.get('gemini'), 'test-key'); assert.equal(h.local.aiSettings.autoSuggest, true);
});
