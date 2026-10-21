const $ = id => document.getElementById(id);
const labels = { correct: "Correcta", incorrect: "Incorrecta", unknown: "Sin confirmar", skipped: "Omitida" };
let records = [];
let selectedCourse = null;
const courseKey = record => (record.course || "Sin curso").trim().replace(/\s+/g, " ").toLocaleLowerCase();
function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}
function render() {
  const query = $("search").value.trim().toLocaleLowerCase();
  const courses = new Map();
  for (const record of records) {
    const key = courseKey(record);
    if (!courses.has(key)) courses.set(key, { name: record.course || "Sin curso", answers: [] });
    courses.get(key).answers.push(record);
  }
  if (selectedCourse !== null && !courses.has(selectedCourse)) selectedCourse = null;
  $("back-courses").hidden = selectedCourse === null && !query;
  $("records").replaceChildren();
  if (!query && selectedCourse === null) {
    $("history-heading").textContent = "Cursos";
    $("summary").textContent = `${courses.size} cursos`;
    if (!courses.size) $("records").append(element("p", "Todavía no hay respuestas para mostrar."));
    for (const [key, course] of courses) {
      const button = element("button", "", "course-card");
      button.type = "button";
      button.append(element("h2", course.name), element("span", `${course.answers.length} respuestas · Ver preguntas`));
      button.addEventListener("click", () => { selectedCourse = key; render(); });
      $("records").append(button);
    }
    return;
  }
  const shown = query
    ? records.filter(r => [r.course, r.question, ...r.selected].join(" ").toLocaleLowerCase().includes(query))
    : courses.get(selectedCourse).answers;
  $("history-heading").textContent = query ? "Resultados en todos los cursos" : courses.get(selectedCourse).name;
  $("summary").textContent = `${shown.length} respuestas · ${shown.filter(r => r.result === "correct").length} correctas · ${shown.filter(r => r.result === "incorrect").length} incorrectas`;
  if (!shown.length) $("records").append(element("p", "No hay respuestas que coincidan con la búsqueda."));
  for (const record of shown) {
    const card = document.createElement("article");
    card.append(element("small", `${record.course} · ${new Date(record.capturedAt).toLocaleString()}`),
      element("h2", record.question), element("p", labels[record.result] || labels.unknown, `result ${record.result}`));
    const list = document.createElement("ul");
    for (const option of record.options) list.append(element("li", option, record.selected.includes(option) ? "selected" : ""));
    card.append(list, element("p", `${record.type === "ordering" ? "Orden elegido" : "Tu respuesta"}: ${record.selected.join(" → ") || "Sin selección"}`));
    if (record.steps?.length && record.type !== "single-choice") {
      for (const note of globalThis.PlatziHistory.notes(record)) card.append(element("p", note.text, note.result));
    }
    $("records").append(card);
  }
}
async function load() {
  const data = await chrome.storage.local.get(null);
  records = Object.entries(data).filter(([key]) => key.startsWith("answer:")).map(([, value]) => value)
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  $("enabled").checked = data.enabled !== false;
  render();
}
$("enabled").addEventListener("change", async () => {
  try { await chrome.storage.local.set({ enabled: $("enabled").checked }); await status(); }
  catch { $("status").textContent = "No se pudo cambiar la captura."; }
});
$("search").addEventListener("input", render);
$("back-courses").addEventListener("click", () => {
  selectedCourse = null;
  $("search").value = "";
  render();
});
$("open").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("history.html") }));
$("export").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `platzi-historial-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
async function status() {
  if (!$("enabled").checked) { $("status").textContent = "Captura pausada."; return; }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const state = await chrome.tabs.sendMessage(tab.id, { type: "status" });
    $("status").textContent = state.error || (!state.exam ? "En Platzi, esperando un examen." :
      !state.question ? "Examen detectado. Esperando una pregunta." : !state.supported ? "Formato de pregunta pendiente de adaptar." : "Captura activa en este examen.");
  } catch { $("status").textContent = "Abre Platzi. Si ya está abierto, recarga la página para activar la captura."; }
}
chrome.storage.onChanged.addListener(() => load().catch(() => { $("status").textContent = "No se pudo leer el historial."; }));
load().then(status).catch(() => { $("status").textContent = "No se pudo leer el historial."; });
