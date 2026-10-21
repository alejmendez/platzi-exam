importScripts("ai.js", "vault.js");
const inFlight = new Set();
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
  return { provider, model: aiSettings?.model || PlatziAI.providers[provider].model };
}
async function handle(message, sender) {
  if (message.type === "ai.suggest") {
    if (!examPage(sender)) throw new Error("La consulta solo está disponible desde un examen de Platzi.");
    PlatziAI.checkQuestion(message.question);
    if (inFlight.has(sender.tab.id)) throw new Error("Ya hay una consulta en curso en este examen.");
    inFlight.add(sender.tab.id);
    try {
      const settings = await configuration();
      const granted = await chrome.permissions.contains({ origins: [PlatziAI.providers[settings.provider].origin] });
      if (!granted) throw new Error("Abre Configuración y guarda el proveedor para permitir la conexión.");
      const key = await PlatziVault.access(settings.provider, "get");
      return { lines: await PlatziAI.suggest(settings, key, message.question), provider: PlatziAI.providers[settings.provider].name };
    } finally { inFlight.delete(sender.tab.id); }
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
    await chrome.storage.local.set({ aiSettings: { provider, model } });
    return { saved: true };
  }
  if (message.type === "ai.settings.deleteKey") {
    if (!Object.hasOwn(PlatziAI.providers, message.provider)) throw new Error("Proveedor no válido.");
    await PlatziVault.access(message.provider, "delete");
    return { deleted: true };
  }
  throw new Error("Acción no reconocida.");
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message?.type?.startsWith("ai.")) return;
  handle(message, sender).then(data => reply({ ok: true, ...data })).catch(error => reply({ ok: false, error: error.message }));
  return true;
});
