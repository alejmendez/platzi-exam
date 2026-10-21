importScripts("ai.js", "vault.js", "core.js");
const inFlight = new Map();
const documents = new Map();
let historyGeneration = 0;
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
      if (lines) return { lines, provider: cached.provider, cached: true };
      if (message.type === "ai.cached") return {};
      const settings = await configuration();
      if (!settings.autoSuggest || Object.entries(data).some(([key, record]) => key.startsWith("answer:") && record.selected?.length && PlatziHistory.sameQuestion(record, message.question))) return { skipped: true };
    }
    if (documents.get(sender.tab.id) !== documentId) return { skipped: true };
    if (inFlight.has(sender.tab.id)) throw new Error("Ya hay una consulta en curso en este examen.");
    const operation = { documentId, controller: new AbortController() };
    inFlight.set(sender.tab.id, operation);
    try {
      const settings = await configuration();
      const granted = await chrome.permissions.contains({ origins: [PlatziAI.providers[settings.provider].origin] });
      if (!granted) throw new Error("Abre Configuración y guarda el proveedor para permitir la conexión.");
      const key = await PlatziVault.access(settings.provider, "get");
      if (operation.controller.signal.aborted) return { skipped: true };
      const lines = await PlatziAI.suggest(settings, key, message.question, undefined, operation.controller.signal);
      const provider = PlatziAI.providers[settings.provider].name;
      if (generation !== historyGeneration || operation.controller.signal.aborted) return { skipped: true };
      try {
        await chrome.storage.local.set({ [keyName]: { question: message.question, lines, provider, model: settings.model, savedAt: new Date().toISOString() } });
      } catch { return { lines, provider, warning: "No se pudo guardar la sugerencia. Revisa el espacio local." }; }
      return { lines, provider };
    } catch (error) {
      if (operation.controller.signal.aborted) return { skipped: true };
      throw error;
    } finally {
      if (inFlight.get(sender.tab.id) === operation) inFlight.delete(sender.tab.id);
    }
  }
  if (!extensionPage(sender)) throw new Error("Esta acción solo está disponible en Configuración.");
  if (message.type === "ai.settings.get") {
    const settings = await configuration();
    return { ...settings, configured: { gemini: Boolean(await PlatziVault.access("gemini", "get")), openrouter: Boolean(await PlatziVault.access("openrouter", "get")) } };
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
    await chrome.storage.local.set({ historyClearedAt: Date.now() });
    const data = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(data).filter(key => key.startsWith("answer:") || key.startsWith("ai-cache:")));
    return { cleared: true };
  }
  throw new Error("Acción no reconocida.");
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message?.type?.startsWith("ai.")) return;
  handle(message, sender).then(data => reply({ ok: true, ...data })).catch(error => reply({ ok: false, error: error.message }));
  return true;
});
