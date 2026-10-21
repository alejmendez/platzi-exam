(() => {
  const get = id => document.getElementById(id);
  const providers = globalThis.PlatziAI.providers;
  let configured = {}, models = {}, ready = false;
  function selectTab(name) {
    for (const tab of ["history", "settings"]) {
      const selected = tab === name;
      get(`tab-${tab}`).setAttribute("aria-selected", String(selected));
      get(`tab-${tab}`).tabIndex = selected ? 0 : -1;
      get(`page-${tab}`).hidden = !selected;
    }
  }
  for (const tab of ["history", "settings"]) {
    const button = get(`tab-${tab}`);
    button.addEventListener("click", () => selectTab(tab));
    button.addEventListener("keydown", event => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? "history" : event.key === "End" ? "settings" : tab === "history" ? "settings" : "history";
        selectTab(next); get(`tab-${next}`).focus();
      }
    });
  }
  function showProvider() {
    const provider = get("ai-provider").value;
    get("ai-model").value = models[provider] || providers[provider].model;
    get("ai-key").value = "";
    get("key-status").textContent = configured[provider] ? "Clave guardada. Deja el campo vacío para conservarla." : "Todavía no hay una clave guardada para este proveedor.";
    get("model-hint").textContent = provider === "openrouter" ? "openrouter/free elige un modelo gratuito disponible." : "Puedes cambiar el identificador por otro modelo disponible en tu cuenta de Gemini.";
    get("ai-delete").disabled = !configured[provider];
  }
  function busy(value) { get("ai-save").disabled = value; get("ai-provider").disabled = value; get("ai-delete").disabled = value || !configured[get("ai-provider").value]; }
  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "No se pudo guardar la configuración.");
    return result;
  }
  async function loadSettings() {
    const settings = await send({ type: "ai.settings.get" });
    configured = settings.configured; models[settings.provider] = settings.model;
    get("ai-provider").value = settings.provider; ready = true; showProvider();
  }
  get("ai-provider").addEventListener("change", () => { get("settings-status").textContent = ""; showProvider(); });
  get("ai-model").addEventListener("input", () => { models[get("ai-provider").value] = get("ai-model").value; });
  get("ai-form").addEventListener("submit", async event => {
    event.preventDefault(); if (!ready) return;
    const provider = get("ai-provider").value, model = get("ai-model").value.trim(), apiKey = get("ai-key").value.trim();
    busy(true); get("settings-status").textContent = "Guardando…";
    try {
      if (!apiKey && !configured[provider]) throw new Error("Introduce una API key para este proveedor.");
      // Request access from the user's save gesture, and only for the chosen provider.
      const granted = await chrome.permissions.request({ origins: [providers[provider].origin] });
      if (!granted) throw new Error("No se autorizó la conexión al proveedor. Puedes intentarlo de nuevo.");
      await send({ type: "ai.settings.save", provider, model, apiKey });
      configured[provider] = configured[provider] || Boolean(apiKey);
      models[provider] = model; showProvider();
      get("settings-status").textContent = "Configuración guardada. Ya puedes pedir sugerencias en el examen.";
    } catch (error) { get("settings-status").textContent = error.message; }
    finally { busy(false); }
  });
  get("ai-delete").addEventListener("click", async () => {
    const provider = get("ai-provider").value; busy(true);
    try { await send({ type: "ai.settings.deleteKey", provider }); configured[provider] = false; showProvider(); get("settings-status").textContent = "Clave eliminada de este navegador."; }
    catch (error) { get("settings-status").textContent = error.message; }
    finally { busy(false); }
  });
  busy(true);
  loadSettings().then(() => busy(false)).catch(() => { get("settings-status").textContent = "No se pudo cargar Configuración. Recarga la extensión y vuelve a abrirla."; });
})();
