importScripts("ai.js", "vault.js", "core.js");
const inFlight = new Map();
const documents = new Map();
let historyGeneration = 0;
let debugGeneration = 0, debugWrites = Promise.resolve();
function writeDiagnostic(entry, generation = debugGeneration) {
  debugWrites = debugWrites.then(async () => {
    if (generation !== debugGeneration) return;
    await chrome.storage.local.set({ ["ai-debug:" + entry.id]: entry });
    const data = await chrome.storage.local.get(null);
    const entries = Object.entries(data).filter(([key]) => key.startsWith("ai-debug:")).sort((a, b) => b[1].startedAt.localeCompare(a[1].startedAt));
    if (entries.length > 20) await chrome.storage.local.remove(entries.slice(20).map(([key]) => key));
  }).catch(() => {}); // Diagnostics must never prevent a provider request.
  return debugWrites;
}
async function cacheKey(question) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PlatziAI.cacheIdentity(question)));
  return "ai-cache:" + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
function extensionPage(sender) { return sender.url?.startsWith(chrome.runtime.getURL("")); }
function examPage(sender) {
  try {
    const url = new URL(sender.url);
    return sender.tab?.id !== undefined && url.protocol === "https:" && ["platzi.com", "www.platzi.com"].includes(url.hostname) && /^\/(evaluacion|examen|exam)(\/|$)/i.test(url.pathname);
  } catch { return false; }
}
async function configuration() {
  const { aiSettings } = await chrome.storage.local.get("aiSettings");
  const provider = Object.hasOwn(PlatziAI.providers, aiSettings?.provider) ? aiSettings.provider : "gemini";
  return { provider, model: aiSettings?.model || PlatziAI.providers[provider].model, autoSuggest: aiSettings?.autoSuggest === true };
}
async function handle(message, sender) {
  if (message.type === "ai.suggest" || message.type === "ai.cached") {
    if (!examPage(sender)) throw new Error("La consulta solo está disponible desde un examen de Platzi.");
    PlatziAI.checkQuestion(message.question);
    const documentId = sender.documentId || sender.url;
    documents.set(sender.tab.id, documentId);
    const previous = inFlight.get(sender.tab.id);
    if (previous && previous.documentId !== documentId) {
      previous.controller.abort();
      inFlight.delete(sender.tab.id);
    }
    const generation = historyGeneration;
    const keyName = await cacheKey(message.question);
    if (documents.get(sender.tab.id) !== documentId) return { skipped: true };
    if (message.type === "ai.cached" || message.auto) {
      const data = await chrome.storage.local.get(message.auto ? null : keyName);
      const cached = data[keyName];
      const lines = PlatziAI.reuseSuggestion(cached, message.question);
      if (lines) {
        await writeDiagnostic({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), kind: "cache", provider: cached.provider,
          model: cached.model, question: message.question.question, course: message.question.course, state: "Caché reutilizada · Sin fetch" });
        return { lines, provider: cached.provider, model: cached.model, cached: true };
      }
      if (message.type === "ai.cached") return {};
      const settings = await configuration();
      if (!settings.autoSuggest || Object.entries(data).some(([key, record]) => key.startsWith("answer:") && record.selected?.length && PlatziHistory.sameQuestion(record, message.question))) return { skipped: true };
    }
    if (documents.get(sender.tab.id) !== documentId) return { skipped: true };
    if (inFlight.has(sender.tab.id)) throw new Error("Ya hay una consulta en curso en este examen.");
    const operation = { documentId, controller: new AbortController() };
    inFlight.set(sender.tab.id, operation);
    let diagnostic;
    const diagnosticGeneration = debugGeneration;
    try {
      const settings = await configuration();
      diagnostic = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), kind: "network", state: "Solicitud no enviada", fetchInvoked: false,
        provider: PlatziAI.providers[settings.provider].name, model: settings.model, source: message.auto ? "Automática" : "Manual",
        question: message.question.question, course: message.question.course };
      const granted = await chrome.permissions.contains({ origins: [PlatziAI.providers[settings.provider].origin] });
      if (!granted) throw new Error("Abre Configuración y guarda el proveedor para permitir la conexión.");
      const key = await PlatziVault.access(settings.provider, "get");
      if (operation.controller.signal.aborted) return { skipped: true };
      const fetchWithDiagnostics = async (url, options) => {
        Object.assign(diagnostic, { state: "Preparando solicitud", url, method: options.method,
          headers: { "Content-Type": options.headers["Content-Type"],
            ...(settings.provider === "gemini" ? { "x-goog-api-key": "[OCULTA]" } : { Authorization: "[OCULTA]" }) },
          body: JSON.parse(options.body) });
        if (operation.controller.signal.aborted) throw new DOMException("Cancelada", "AbortError");
        const pendingFetch = fetch(url, options);
        diagnostic.fetchInvoked = true; diagnostic.state = "Fetch invocado · Esperando respuesta";
        const saved = writeDiagnostic(diagnostic, diagnosticGeneration);
        const response = await pendingFetch;
        await saved;
        diagnostic.httpStatus = response.status;
        return response;
      };
      const lines = await PlatziAI.suggest(settings, key, message.question, fetchWithDiagnostics, operation.controller.signal);
      if (diagnostic) {
        diagnostic.state = "Respuesta recibida y validada";
        diagnostic.durationMs = Date.now() - Date.parse(diagnostic.startedAt);
        await writeDiagnostic(diagnostic, diagnosticGeneration);
      }
      const provider = PlatziAI.providers[settings.provider].name;
      if (generation !== historyGeneration || operation.controller.signal.aborted) return { skipped: true };
      try {
        await chrome.storage.local.set({ [keyName]: { question: message.question, lines, provider, model: settings.model, savedAt: new Date().toISOString() } });
      } catch { return { lines, provider, model: settings.model, warning: "No se pudo guardar la sugerencia. Revisa el espacio local." }; }
      return { lines, provider, model: settings.model };
    } catch (error) {
      if (diagnostic) {
        diagnostic.state = operation.controller.signal.aborted ? "Cancelada al recargar o cambiar de página" : "Error";
        diagnostic.error = operation.controller.signal.aborted ? "Consulta cancelada; no se reutilizó su resultado." : error.message;
        diagnostic.durationMs = Date.now() - Date.parse(diagnostic.startedAt);
        await writeDiagnostic(diagnostic, diagnosticGeneration);
      }
      if (operation.controller.signal.aborted) return { skipped: true };
      throw error;
    } finally {
      if (inFlight.get(sender.tab.id) === operation) inFlight.delete(sender.tab.id);
    }
  }
  if (!extensionPage(sender)) throw new Error("Esta acción solo está disponible en Configuración.");
  if (message.type === "ai.debug.list") {
    const data = await chrome.storage.local.get(null);
    return { entries: Object.entries(data).filter(([key]) => key.startsWith("ai-debug:")).map(([, value]) => value).sort((a, b) => b.startedAt.localeCompare(a.startedAt)) };
  }
  if (message.type === "ai.debug.clear") {
    debugGeneration++;
    await debugWrites;
    const data = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(data).filter(key => key.startsWith("ai-debug:")));
    return { cleared: true };
  }
  if (message.type === "ai.settings.get") {
    const settings = await configuration();
    const configured = {};
    for (const provider of Object.keys(PlatziAI.providers)) configured[provider] = Boolean(await PlatziVault.access(provider, "get"));
    return { ...settings, configured };
  }
  if (message.type === "ai.settings.save") {
    const { provider, model, apiKey } = message;
    if (!Object.hasOwn(PlatziAI.providers, provider) || typeof model !== "string" || !/^[\w./:-]{1,120}$/.test(model) || typeof apiKey !== "string" || apiKey.length > 512 || /[\r\n]/.test(apiKey)) throw new Error("Revisa el proveedor, modelo y API key.");
    if (!apiKey.trim() && !await PlatziVault.access(provider, "get")) throw new Error("Introduce una API key para este proveedor.");
    if (apiKey.trim()) await PlatziVault.access(provider, "put", apiKey.trim());
    await chrome.storage.local.set({ aiSettings: { provider, model, autoSuggest: message.autoSuggest === true } });
    return { saved: true };
  }
  if (message.type === "ai.settings.deleteKey") {
    if (!Object.hasOwn(PlatziAI.providers, message.provider)) throw new Error("Proveedor no válido.");
    await PlatziVault.access(message.provider, "delete");
    return { deleted: true };
  }
  if (message.type === "ai.history.clear") {
    historyGeneration++;
    debugGeneration++;
    await debugWrites;
    await chrome.storage.local.set({ historyClearedAt: Date.now() });
    const data = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(data).filter(key => key.startsWith("answer:") || key.startsWith("ai-cache:") || key.startsWith("ai-debug:")));
    return { cleared: true };
  }
  throw new Error("Acción no reconocida.");
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message?.type?.startsWith("ai.")) return;
  handle(message, sender).then(data => reply({ ok: true, ...data })).catch(error => reply({ ok: false, error: error.message }));
  return true;
});
