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
  let panel = null, panelBody = null, panelKey = "";
  function removePanel() { panel?.remove(); panel = null; panelBody = null; panelKey = ""; }
  function renderPanel() {
    if (!enabled || !current) { removePanel(); return; }
    const previous = Array.from(records.values()).filter(r => r.id !== current.id && core.sameQuestion(r, { ...current, course }));
    const notes = previous.flatMap(core.notes);
    const key = JSON.stringify([current.id, notes, error]);
    if (key === panelKey && panel?.isConnected) return;
    if (!panel?.isConnected) {
      panel = document.createElement("aside"); panel.id = "platzi-history-note";
      const shadow = panel.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = ':host{display:block;margin:16px 0;width:100%;font:14px/1.5 system-ui,sans-serif;color:#edf5f1}section{padding:14px 16px;background:#122b27;border:1px solid #427369;border-radius:10px}strong{display:block}p{margin:7px 0;overflow-wrap:anywhere}.correct{color:#81f5b7}.incorrect{color:#ffb1b1}.unknown,.skipped{color:#ffdc9d}';
      panelBody = document.createElement("section");
      panelBody.setAttribute("aria-label", "Historial personal de esta pregunta");
      shadow.append(style, panelBody);
      current.container.querySelector(S.question).after(panel);
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
  }
  function save(record) {
    const snapshot = structuredClone(record); records.set(record.id, snapshot);
    writes = writes.then(() => chrome.storage.local.set({ ["answer:" + record.id]: snapshot }))
      .then(() => { error = ""; }).catch(() => { error = "No se pudo guardar. Revisa el espacio local y recarga la extensión."; renderPanel(); });
  }
  function read() {
    if (!core.isExam(location.pathname)) return null;
    const container = document.querySelector(S.container);
    const question = questionText(container);
    if (!question) return null;
    let kind = "unsupported", options = [];
    if (container.querySelector('[data-testid="fill-the-gap"]')) {
      kind = "fill-gaps";
      options = [...all(container, S.wordLabel).map(text), ...all(container, S.gapLabel).map(text)];
    } else if (container.querySelector('[data-testid="magnet-cards"]')) {
      kind = "ordering"; options = all(container, S.orderLabel).map(text);
    } else if (container.querySelector('[class*="MatchCardsAdapter"]')) {
      kind = "matching"; options = all(container, S.match).map(text);
    } else if (container.querySelector('[data-testid="swipe-cards"]')) {
      kind = "categorization";
      options = [...all(container, S.cardText).map(text), ...all(container, 'button[aria-label^="Categorizar como "]').map(e => e.getAttribute("aria-label").replace("Categorizar como ", ""))];
    } else if (container.querySelector('[role="radiogroup"]')) {
      kind = "single-choice"; options = all(container, S.option).map(e => text(e.querySelector(S.optionText)));
    }
    return { container, question, options, kind };
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
    feedback(); renderPanel();
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
