(function (root) {
  const api = {
    normalize(value) { return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase(); },
    sameQuestion(record, question) {
      const norm = api.normalize;
      const options = list => [...new Set(list.map(norm))].sort().join("\n");
      return norm(record.course) === norm(question.course) && norm(record.question) === norm(question.question) &&
        record.type === question.kind && options(record.options) === options(question.options);
    },
    notes(record) {
      if (record.steps?.length && record.type !== "single-choice") {
        const notes = record.steps.filter(s => s.result !== "unknown").map(s => ({ result: s.result,
          text: `${s.result === "correct" ? "Correcto" : "NO es correcto"}: ${s.prompt ? s.prompt + " → " : ""}${s.answer}` }));
        if (record.result === "incorrect" && !record.steps.some(s => s.result === "incorrect") || record.result !== "correct" && !notes.length) notes.push({ result: record.result,
          text: `${record.result === "incorrect" ? "Esta combinación NO fue correcta" : "Combinación sin confirmar"}: ${record.selected.join(" · ")}` });
        return notes;
      }
      const prefix = { correct: "Respuesta correcta registrada", incorrect: "Esta NO es la respuesta", unknown: "Respuesta anterior sin confirmar", skipped: "Pregunta omitida" };
      return [{ result: record.result, text: `${prefix[record.result] || prefix.unknown}: ${record.selected.join(" → ") || "Sin selección"}` }];
    },
    isExam(path) { return /^\/(evaluacion|examen|exam)(\/|$)/i.test(path); },
    result(before, after) {
      const correct = before.correct !== null && after.correct !== null && after.correct > before.correct;
      const incorrect = before.lives !== null && after.lives !== null && after.lives < before.lives;
      if (correct === incorrect) return "unknown";
      return correct ? "correct" : "incorrect";
    },
    counters(progress, lives) {
      const score = /Correctas\s+(\d+)\s*\//i.exec(progress || "");
      const hearts = /^(\d+)\s+de\s+\d+\s+vidas/i.exec(lives || "");
      return { correct: score ? Number(score[1]) : null, lives: hearts ? Number(hearts[1]) : null };
    }
  };
  root.PlatziHistory = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
