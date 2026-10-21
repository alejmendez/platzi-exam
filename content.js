(() => {
  const core = globalThis.PlatziHistory;
  const S = {
    container: '[class*="QuestionContainer_questionContainer__"]', question: '[class*="QuestionContent_questionText__"]',
    course: '[class*="ExamQuestionHeader__CourseTitle__"], [class*="WelcomeStep_courseName__"]',
    option: '[data-id="answer-option"]', optionText: '[class*="AnswerOption__Text__"]',
    orderLabel: '[class*="SelectableItem__label__"]', activeCard: '[class*="SwipeCardOuter"][tabindex="0"]',
    cardText: '[class*="SwipeCard__content__"]', match: '[data-card-type]',
    gap: '[data-gap-id]', gapLabel: '[class*="GapSlot__label__"]', word: '[data-testid^="draggable-word-"]',
    wordLabel: '[class*="DraggableWord__label__"]', statement: '[class*="FillTheGap__statement__"]'
  };
  let enabled = false, current = null, pending = null, error = "", course = "";
  let route = location.pathname, attempt = crypto.randomUUID(), writes = Promise.resolve();
  const records = new Map();
  let autoSuggest = false, historyGeneration = 0;
  const text = node => (node?.innerText || node?.textContent || "").trim();
  const all = (root, selector) => Array.from(root.querySelectorAll(selector));
  function questionText(container) {
    const heading = text(container?.querySelector(S.question));
    const statement = container?.querySelector(S.statement);
    if (!statement) return heading;
    const template = Array.from(statement.childNodes).map(node => node.nodeType === 1 && node.hasAttribute("data-gap-id") ? `[${node.getAttribute("data-gap-id")}]` : node.textContent).join("");
    return `${heading}\n${template}`;
  }
  const counter = () => core.counters(document.querySelector('[role="progressbar"]')?.getAttribute("aria-label"),
    document.querySelector('[aria-label*="vidas restantes"]')?.getAttribute("aria-label"));
  let panel = null, panelBody = null, panelFrame = null, panelToggle = null, panelKey = "", panelCollapsed = false;
  function removePanel() { panel?.remove(); panel = null; panelBody = null; panelFrame = null; panelToggle = null; panelKey = ""; }
  function togglePanel() {
    panelCollapsed = !panelCollapsed;
    panelFrame.setAttribute("data-collapsed", String(panelCollapsed));
    panelBody.hidden = panelCollapsed;
    panelToggle.textContent = panelCollapsed ? "Expandir" : "Contraer";
    panelToggle.setAttribute("aria-expanded", String(!panelCollapsed));
  }
  function renderPanel() {
    if (!enabled || !current) { removePanel(); return; }
    const previous = Array.from(records.values()).filter(r => r.id !== current.id && core.sameQuestion(r, { ...current, course }));
    const notes = previous.flatMap(core.notes);
    const key = JSON.stringify([current.id, notes, error, current.ai]);
    if (key === panelKey && panel?.isConnected) return;
    if (!panel?.isConnected) {
      panel = document.createElement("aside"); panel.id = "platzi-history-note";
      const shadow = panel.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = `
        :host{all:initial;--panel-top:clamp(16px,160px,calc(100dvh - 176px));display:block;position:fixed;right:16px;top:var(--panel-top);z-index:2147483647;font:14px/1.5 system-ui,sans-serif;color:#edf5f1;text-align:left;color-scheme:dark}
        *{box-sizing:border-box}
        .window{display:flex;flex-direction:column;direction:rtl;width:min(400px,calc(100vw - 32px));height:min(440px,calc(100dvh - var(--panel-top) - 16px));min-width:min(260px,calc(100vw - 32px));min-height:min(160px,calc(100dvh - var(--panel-top) - 16px));max-width:calc(100vw - 32px);max-height:calc(100dvh - var(--panel-top) - 16px);resize:both;overflow:hidden;background:#122b27;border:1px solid #427369;border-radius:12px;box-shadow:0 8px 32px #0008}
        header,.body{direction:ltr}
        .window[data-collapsed="true"]{width:240px!important;height:auto!important;min-width:0;min-height:0;resize:none}
        header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-bottom:1px solid #427369;flex:none}
        .body{padding:14px 16px;overflow:auto;overscroll-behavior:contain;min-height:0;flex:1}
        [hidden]{display:none!important}strong{display:block}p{margin:7px 0;overflow-wrap:anywhere}
        .correct{color:#81f5b7}.incorrect{color:#ffb1b1}.unknown,.skipped{color:#ffdc9d}
        .ai{border-top:1px solid #427369;margin-top:12px;padding-top:12px}
        button{background:#213e3a;border:1px solid #70c8a6;border-radius:7px;padding:8px 12px;color:#edf5f1;font:inherit;cursor:pointer}
        button:disabled{opacity:.6;cursor:default}button:focus-visible{outline:2px solid #0aeb8b;outline-offset:3px}
        .ai-line{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin:8px 0;overflow-wrap:anywhere}.ai-line span{min-width:0;max-width:100%}
        .ai-label{font-weight:600;color:#a1dcff}.ai-hint{font-size:12px;color:#b1c1cd}.ai-error{color:#ffb1b1}
      `;
      panelFrame = document.createElement("div"); panelFrame.className = "window";
      panelFrame.setAttribute("data-collapsed", String(panelCollapsed));
      const header = document.createElement("header");
      const heading = document.createElement("strong"); heading.textContent = "Mi historial · IA";
      panelToggle = document.createElement("button"); panelToggle.type = "button";
      panelToggle.textContent = panelCollapsed ? "Expandir" : "Contraer";
      panelToggle.setAttribute("aria-expanded", String(!panelCollapsed));
      panelToggle.setAttribute("aria-controls", "platzi-panel-content");
      panelToggle.addEventListener("click", togglePanel);
      header.append(heading, panelToggle);
      panelBody = document.createElement("section");
      panelBody.id = "platzi-panel-content"; panelBody.className = "body"; panelBody.hidden = panelCollapsed;
      panelBody.setAttribute("aria-label", "Historial personal de esta pregunta");
      panelFrame.append(header, panelBody);
      shadow.append(style, panelFrame);
      // Mount outside the exam card: its fixed-height header clips overflowing content.
      document.body.append(panel);
    }
    panelKey = key;
    const title = document.createElement("strong");
    title.textContent = previous.length ? `Ya respondiste esta pregunta · ${previous.length} registro(s)` : "Primera vez en tu historial";
    panelBody.replaceChildren(title);
    const unique = new Set();
    for (const note of notes) {
      if (unique.has(note.text)) continue;
      unique.add(note.text);
      const p = document.createElement("p"); p.className = note.result; p.textContent = note.text; panelBody.append(p);
    }
    if (!previous.length || error) {
      const p = document.createElement("p"); p.textContent = error || "Se guardarán tus elecciones y el resultado que muestre Platzi."; panelBody.append(p);
    }
    if (current.kind !== "unsupported") {
      const ai = document.createElement("div"); ai.className = "ai";
      const button = document.createElement("button"); button.type = "button";
      button.textContent = current.ai?.loading ? "Consultando…" : current.ai?.lines ? "Volver a consultar IA" : "Sugerir con IA";
      button.disabled = Boolean(current.ai?.loading);
      button.addEventListener("click", requestSuggestion);
      const hint = document.createElement("p"); hint.className = "ai-hint";
      hint.textContent = current.ai?.loading ? "Esperando al proveedor de IA. La consulta puede tardar hasta 90 segundos." : current.ai?.provider ? `Sugerencia ${current.ai.cached ? "guardada " : ""}de ${current.ai.provider} · Puede equivocarse.` : "Envía esta pregunta al proveedor configurado. La IA solo sugiere; tú seleccionas.";
      ai.append(button, hint);
      if (current.ai?.error) { const p = document.createElement("p"); p.className = "ai-error"; p.textContent = current.ai.error; ai.append(p); }
      if (current.ai?.warning) { const p = document.createElement("p"); p.className = "ai-error"; p.textContent = current.ai.warning; ai.append(p); }
      for (const line of current.ai?.lines || []) {
        const row = document.createElement("div"); row.className = "ai-line";
        const label = document.createElement("span"); label.className = "ai-label"; label.textContent = line.label;
        const value = document.createElement("span"); value.textContent = `→ ${line.text}`;
        row.append(label, value); ai.append(row);
      }
      panelBody.append(ai);
    }
    const resizeHint = document.createElement("p"); resizeHint.className = "ai-hint";
    resizeHint.textContent = "Ajusta el tamaño desde la esquina inferior izquierda.";
    panelBody.append(resizeHint);
  }
  async function requestSuggestion(event) {
    if (!event.isTrusted || !enabled || !current || current.ai?.loading) return;
    await suggest(false);
  }
  function aiQuestion(owner) {
    return { kind: owner.kind, course, question: owner.question, options: owner.options, groups: owner.groups };
  }
  async function prepareSuggestion() {
    if (!current || current.kind === "unsupported" || current.aiChecked) return;
    const owner = current, generation = historyGeneration;
    owner.aiChecked = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: "ai.cached", question: aiQuestion(owner) });
      if (current !== owner || !enabled || generation !== historyGeneration || owner.ai) return;
      if (response?.ok && response.lines) { owner.ai = { lines: response.lines, provider: response.provider, cached: true }; renderPanel(); }
      else if (autoSuggest && !Array.from(records.values()).some(record => record.selected?.length && core.sameQuestion(record, aiQuestion(owner)))) await suggest(true);
    } catch { /* Manual suggestions remain available if the extension was reloaded. */ }
  }
  async function suggest(automatic) {
    const owner = current, path = location.pathname;
    const generation = historyGeneration;
    owner.ai = { loading: true }; renderPanel();
    try {
      const response = await chrome.runtime.sendMessage({ type: "ai.suggest", auto: automatic, question: aiQuestion(owner) });
      if (current !== owner || location.pathname !== path || !enabled || generation !== historyGeneration) return;
      owner.ai = response?.skipped ? undefined : response?.ok ? { lines: response.lines, provider: response.provider, cached: response.cached, warning: response.warning } : { error: response?.error || "No se pudo consultar. Abre Configuración en la extensión." };
    } catch {
      if (current !== owner || location.pathname !== path || !enabled || generation !== historyGeneration) return;
      owner.ai = { error: "No se pudo consultar. Recarga la extensión y la pestaña de Platzi." };
    }
    renderPanel();
  }
  function save(record) {
    const snapshot = structuredClone(record); records.set(record.id, snapshot);
    const generation = historyGeneration;
    writes = writes.then(() => generation === historyGeneration ? chrome.storage.local.set({ ["answer:" + record.id]: snapshot }) : undefined)
      .then(() => { error = ""; }).catch(() => { error = "No se pudo guardar. Revisa el espacio local y recarga la extensión."; renderPanel(); });
  }
  function read() {
    if (!core.isExam(location.pathname)) return null;
    const container = document.querySelector(S.container);
    const question = questionText(container);
    if (!question) return null;
    let kind = "unsupported", options = [], groups = {};
    if (container.querySelector('[data-testid="fill-the-gap"]')) {
      kind = "fill-gaps";
      options = [...all(container, S.wordLabel).map(text), ...all(container, S.gapLabel).map(text)];
      groups.gaps = all(container, S.gap).map(gap => gap.getAttribute("data-gap-id"));
    } else if (container.querySelector('[data-testid="magnet-cards"]')) {
      kind = "ordering"; options = all(container, S.orderLabel).map(text);
    } else if (container.querySelector('[class*="MatchCardsAdapter"]')) {
      kind = "matching"; options = all(container, S.match).map(text);
      const cards = all(container, S.match);
      groups.left = cards.flatMap((card, i) => card.getAttribute("data-card-type") === "concept" ? [i + 1] : []);
      groups.right = cards.flatMap((card, i) => card.getAttribute("data-card-type") === "definition" ? [i + 1] : []);
    } else if (container.querySelector('[data-testid="swipe-cards"]')) {
      kind = "categorization";
      options = [...all(container, S.cardText).map(text), ...all(container, 'button[aria-label^="Categorizar como "]').map(e => e.getAttribute("aria-label").replace("Categorizar como ", ""))];
      const count = all(container, S.cardText).length;
      groups.left = options.slice(0, count).map((_, i) => i + 1);
      groups.right = options.slice(count).map((_, i) => count + i + 1);
    } else if (container.querySelector('[role="radiogroup"]')) {
      kind = "single-choice"; options = all(container, S.option).map(e => text(e.querySelector(S.optionText)));
    }
    return { container, question, options, kind, groups };
  }
  function finish(result, evidence) {
    if (!pending || result === "unknown") return;
    pending.result = result; pending.evidence = evidence; pending.resolvedAt = new Date().toISOString();
    if (result === "correct") for (const step of pending.steps) if (step.result === "unknown") { step.result = "correct"; step.evidence = evidence; }
    save(pending); pending = null;
  }
  function feedback() {
    if (!pending || pending.examPath !== location.pathname) return;
    const next = counter(), countersResult = core.result(pending.before, next);
    // Explicit feedback must still belong to the question that produced this response.
    if (current && questionText(current.container) === pending.question) {
      const root = current.container;
      if (root.querySelector('[class*="InlineCorrectFeedback_container__"]')) {
        finish("correct", { source: "visible-feedback", message: "¡Correcto!" }); return;
      }
      const wrong = root.querySelector('[data-id="answer-option"][class*="AnswerOption--error__"]');
      if (wrong) { finish("incorrect", { source: "visible-option-error", message: text(wrong.querySelector(S.optionText)) }); return; }
      // The live announcement grades one card, not the entire classification.
      if (current.kind === "categorization") {
        const step = pending.steps.at(-1);
        const announcement = all(root, '[role="status"]').map(text).find(value => /^(Incorrecto|Correcto)\./.test(value) && value.includes(step.prompt) && value.includes(step.answer));
        if (announcement && step.result === "unknown") {
          step.result = announcement.startsWith("Incorrecto") ? "incorrect" : "correct";
          step.evidence = { source: "visible-announcement", message: announcement }; save(pending);
        }
      }
    }
    if (countersResult !== "unknown") finish(countersResult, { source: "visible-counters", before: pending.before, after: next });
  }
  function syncGaps() {
    if (!current || current.kind !== "fill-gaps" || questionText(current.container) !== current.question) return;
    for (const gap of all(current.container, S.gap)) {
      const answer = text(gap.querySelector(S.gapLabel));
      if (!answer) continue;
      const prompt = `Hueco ${gap.getAttribute("data-gap-id")}`;
      let step = current.record?.steps.findLast(s => s.prompt === prompt);
      if (!step || step.answer !== answer) { capture(prompt, answer); step = current.record.steps.at(-1); }
      const result = gap.className.includes("GapSlot--correct__") ? "correct" :
        gap.className.includes("GapSlot--incorrect__") || gap.className.includes("GapSlot--error__") ? "incorrect" : "unknown";
      if (result !== "unknown" && step.result !== result) {
        step.result = result; step.evidence = { source: "visible-gap-state", message: gap.getAttribute("aria-label") }; save(current.record);
      }
    }
  }
  function scan() {
    if (!enabled) return;
    course = text(document.querySelector(S.course)) || course || document.title.replace(/\s*-\s*Examen\s*\|\s*Platzi.*$/i, "").trim();
    syncGaps(); feedback();
    if (route !== location.pathname) { route = location.pathname; attempt = crypto.randomUUID(); current = null; pending = null; course = ""; }
    const next = read();
    if (!next) { current = null; removePanel(); return; }
    if (!current || current.question !== next.question) {
      pending = null; current = { ...next, id: crypto.randomUUID(), before: counter(), pair: {} };
    } else current.container = next.container;
    syncGaps();
    if (current.kind === "single-choice" && !current.record) {
      const checked = current.container.querySelector('[role="radio"][aria-checked="true"]');
      if (checked) capture("", text(checked.closest(S.option)?.querySelector(S.optionText)));
    }
    feedback(); renderPanel(); prepareSuggestion();
  }
  function capture(prompt, answer) {
    if (!current || !answer) return;
    // A label can forward the same user click to its radio button.
    if (current.kind === "single-choice" && pending === current.record && pending?.selected[0] === answer) return;
    if (current.kind === "single-choice" && current.record) current.id = crypto.randomUUID();
    const record = current.kind === "single-choice" ? null : current.record;
    current.record = record || { id: current.id, attempt, examPath: route, course, question: current.question, type: current.kind,
      options: current.options, selected: [], steps: [], result: "unknown", before: current.before, capturedAt: new Date().toISOString() };
    current.record.steps.push({ prompt, answer, result: "unknown" });
    current.record.selected.push(prompt ? `${prompt} → ${answer}` : answer);
    pending = current.record; save(pending);
  }
  function onClick(event) {
    if (!enabled || !core.isExam(location.pathname)) return;
    scan();
    if (!current || !(event.target instanceof Element)) return;
    const control = event.target.closest('[data-id="answer-option"], [role="button"], button');
    if (!control || !current.container.contains(control) || control.matches(':disabled,[aria-disabled="true"]')) return;
    if (control.closest('[class*="Footer_skipButton__"]')) {
      pending = null;
      const record = current.record || { id: current.id, attempt, examPath: route, course, question: current.question,
        type: current.kind, options: current.options, selected: [], steps: [], capturedAt: new Date().toISOString() };
      record.result = "skipped"; save(record);
    } else if (current.kind === "single-choice" && control.matches('[data-id="answer-option"], [role="radio"]')) {
      capture("", text(control.closest(S.option)?.querySelector(S.optionText)));
    } else if (current.kind === "ordering" && control.querySelector(S.orderLabel)) {
      capture(`Posición ${(current.record?.steps.length || 0) + 1}`, text(control.querySelector(S.orderLabel)));
    } else if (current.kind === "matching" && control.matches(S.match)) {
      current.pair[control.getAttribute("data-card-type")] = text(control);
      if (current.pair.concept && current.pair.definition) { capture(current.pair.concept, current.pair.definition); current.pair = {}; }
    } else if (current.kind === "categorization" && control.matches('button[aria-label^="Categorizar como "]')) {
      const card = current.container.querySelector(S.activeCard);
      if (card) capture(text(card.querySelector(S.cardText)), control.getAttribute("aria-label").replace("Categorizar como ", ""));
    } else if (current.kind === "fill-gaps" && control.matches(S.word)) {
      const gap = all(current.container, S.gap).find(slot => !text(slot.querySelector(S.gapLabel)));
      if (gap) capture(`Hueco ${gap.getAttribute("data-gap-id")}`, text(control.querySelector(S.wordLabel)));
    }
  }
  function onKey(event) {
    if (!enabled || !current || current.kind !== "categorization" || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    if (!(event.target instanceof Element) || !event.target.matches(S.activeCard)) return;
    const button = all(current.container, 'button[aria-label^="Categorizar como "]')[event.key === "ArrowLeft" ? 0 : 1];
    if (button && !button.disabled) capture(text(event.target.querySelector(S.cardText)), button.getAttribute("aria-label").replace("Categorizar como ", ""));
  }
  async function initialize() {
    const data = await chrome.storage.local.get(null);
    for (const [key, value] of Object.entries(data)) if (key.startsWith("answer:")) records.set(value.id, value);
    enabled = data.enabled !== false;
    autoSuggest = data.aiSettings?.autoSuggest === true;
    const observer = new MutationObserver(mutations => {
      if (mutations.every(m => m.target === panel || panel?.contains(m.target))) return;
      scan();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["class", "aria-label", "aria-checked", "data-state", "disabled"] });
    document.addEventListener("click", onClick, true); document.addEventListener("keydown", onKey, true); scan();
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.historyClearedAt) {
      historyGeneration++; records.clear(); pending = null;
      if (current) { current.record = null; current.ai = undefined; current.aiChecked = true; current.id = crypto.randomUUID(); }
    }
    if (changes.aiSettings) {
      autoSuggest = changes.aiSettings.newValue?.autoSuggest === true;
      if (current && !current.ai) current.aiChecked = false;
      prepareSuggestion();
    }
    for (const [key, change] of Object.entries(changes)) if (key.startsWith("answer:")) {
      if (change.newValue) records.set(change.newValue.id, change.newValue);
      else if (change.oldValue) records.delete(change.oldValue.id);
    }
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false; current = null; pending = null;
      if (!enabled) removePanel(); scan();
    } else renderPanel();
  });
  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message.type === "status") reply({ enabled, exam: core.isExam(location.pathname), question: current?.question,
      supported: Boolean(current && current.kind !== "unsupported"), error });
  });
  initialize().catch(() => { error = "No se pudo iniciar. Recarga la página tras recargar la extensión."; });
})();
