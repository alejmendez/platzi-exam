(() => {
  const get = id => document.getElementById(id);
  const providers = globalThis.PlatziAI.providers;
  let configured = {}, models = {}, ready = false;
  const tabs = ["history", "settings", "debug"];
  function showActive(provider, model) {
    get("active-provider").textContent = `Proveedor activo: ${providers[provider].name} · ${model}`;
  }
  function selectTab(name) {
    for (const tab of tabs) {
      const selected = tab === name;
      get(`tab-${tab}`).setAttribute("aria-selected", String(selected));
      get(`tab-${tab}`).tabIndex = selected ? 0 : -1;
      get(`page-${tab}`).hidden = !selected;
    }
    if (name === "debug") loadDiagnostics();
  }
  for (const tab of tabs) {
    const button = get(`tab-${tab}`);
    button.addEventListener("click", () => selectTab(tab));
    button.addEventListener("keydown", event => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs[(tabs.indexOf(tab) + (event.key === "ArrowLeft" ? tabs.length - 1 : 1)) % tabs.length];
        selectTab(next); get(`tab-${next}`).focus();
      }
    });
  }
  function showProvider() {
    const provider = get("ai-provider").value;
    get("ai-model").value = models[provider] || providers[provider].model;
    get("ai-key").value = "";
    get("key-status").textContent = configured[provider] ? "Clave guardada. Deja el campo vacío para conservarla." : "Todavía no hay una clave guardada para este proveedor.";
    get("model-hint").textContent = provider === "minimax" ? "Elige MiniMax-M3.1-Flash o MiniMax-M3. La disponibilidad y el consumo dependen de tu plan." : provider === "openrouter" ? "openrouter/free elige un modelo gratuito disponible." : "Puedes cambiar el identificador por otro modelo disponible en tu cuenta de Gemini.";
    get("minimax-hint").hidden = provider !== "minimax";
    get("ai-models").replaceChildren(...(provider === "minimax" ? ["MiniMax-M3.1-Flash", "MiniMax-M3"] : []).map(model => {
      const option = document.createElement("option"); option.value = model; return option;
    }));
    get("ai-delete").disabled = !configured[provider];
  }
  function busy(value) { get("ai-save").disabled = value; get("ai-provider").disabled = value; get("ai-delete").disabled = value || !configured[get("ai-provider").value]; }
  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "No se pudo guardar la configuración.");
    return result;
  }
  async function loadDiagnostics() {
    try {
      const { entries } = await send({ type: "ai.debug.list" });
      const container = get("debug-records");
      const expanded = new Set(Array.from(container.querySelectorAll("details[open]")).map(node => node.dataset.id));
      container.replaceChildren();
      get("debug-status").textContent = entries.length ? `${entries.length} registro(s). Se actualizan mientras esta pestaña está abierta.` : "Aún no hay registros. Solicita una sugerencia en Platzi; las consultas anteriores a esta versión no aparecen aquí.";
      for (const entry of entries) {
        const card = document.createElement("article");
        const title = document.createElement("h2"); title.textContent = `${entry.provider} · ${entry.state}`;
        const meta = document.createElement("p");
        meta.textContent = `${new Date(entry.startedAt).toLocaleString()} · ${entry.model || "Modelo guardado"}${entry.source ? ` · ${entry.source}` : ""}${entry.durationMs !== undefined ? ` · ${(entry.durationMs / 1000).toFixed(1)} s` : ""}`;
        const question = document.createElement("p"); question.textContent = `${entry.course} · ${entry.question}`;
        const result = document.createElement("p");
        result.textContent = entry.kind === "cache" ? "Sin solicitud de red: se reutilizó una sugerencia guardada." : `Fetch invocado: ${entry.fetchInvoked ? "Sí" : "No"} · HTTP: ${entry.httpStatus ?? "Sin respuesta HTTP registrada"}${entry.error ? ` · ${entry.error}` : ""}`;
        card.append(title, meta, question, result);
        if (entry.kind === "network") {
          const details = document.createElement("details"); details.dataset.id = entry.id; details.open = expanded.has(entry.id);
          const summary = document.createElement("summary"); summary.textContent = "Ver URL, cabeceras y parámetros enviados";
          const code = document.createElement("pre");
          code.textContent = JSON.stringify({ url: entry.url, method: entry.method, headers: entry.headers, body: entry.body }, null, 2);
          details.append(summary, code); card.append(details);
        }
        container.append(card);
      }
    } catch { get("debug-status").textContent = "No se pudo cargar el diagnóstico. Recarga la extensión y vuelve a abrirla."; }
  }
  get("debug-refresh").addEventListener("click", loadDiagnostics);
  get("debug-clear").addEventListener("click", async () => {
    get("debug-clear").disabled = true;
    try { await send({ type: "ai.debug.clear" }); await loadDiagnostics(); }
    catch { get("debug-status").textContent = "No se pudo limpiar el diagnóstico."; }
    finally { get("debug-clear").disabled = false; }
  });
  get("debug-open").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("history.html#debug") }));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.aiSettings?.newValue?.provider && Object.hasOwn(providers, changes.aiSettings.newValue.provider)) showActive(changes.aiSettings.newValue.provider, changes.aiSettings.newValue.model);
    if (area === "local" && !get("page-debug").hidden && Object.keys(changes).some(key => key.startsWith("ai-debug:"))) loadDiagnostics();
  });
  if (location.hash === "#debug") selectTab("debug");
  async function loadSettings() {
    const settings = await send({ type: "ai.settings.get" });
    configured = settings.configured; models[settings.provider] = settings.model;
    showActive(settings.provider, settings.model);
    get("ai-auto").checked = settings.autoSuggest === true;
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
      await send({ type: "ai.settings.save", provider, model, apiKey, autoSuggest: get("ai-auto").checked });
      configured[provider] = configured[provider] || Boolean(apiKey);
      models[provider] = model; showProvider();
      showActive(provider, model);
      get("settings-status").textContent = `Configuración guardada. Las consultas nuevas usarán ${providers[provider].name} · ${model}.`;
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
  get("history-clear").addEventListener("click", async () => {
    if (!confirm("¿Eliminar todas tus respuestas, sugerencias de IA y diagnósticos guardados? No se puede deshacer. Tus claves y configuración se conservan.")) return;
    get("history-clear").disabled = true;
    try { await send({ type: "ai.history.clear" }); get("purge-status").textContent = "Historial y sugerencias eliminados. Se conservaron las claves y la configuración."; }
    catch (error) { get("purge-status").textContent = error.message; }
    finally { get("history-clear").disabled = false; }
  });
  loadSettings().then(() => busy(false)).catch(() => { get("settings-status").textContent = "No se pudo cargar Configuración. Recarga la extensión y vuelve a abrirla."; });
})();
