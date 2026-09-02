import test from "node:test";
import assert from "node:assert/strict";

import {
  getGeminiReportError,
  isRetryableGeminiStatus,
  isSupportedReportRequest
} from "../api/generate-report.js";
import {
  PIAT_REVISION_GENERATION_BATCHES,
  PIAT_REVISION_SECTIONS
} from "../src/report-model.js";
import {
  buildPiatRevisionReportPrompt,
  buildPiatRevisionWritingGuide,
  PIAT_REVISION_WRITING_GUIDES
} from "../src/report-writing-guides.js";

test("solo admite PIAT de revisión con contexto clínico", () => {
  const batch = PIAT_REVISION_GENERATION_BATCHES[0];
  assert.equal(isSupportedReportRequest("piat_revision", { fichaActual: {} }, batch), true);
  assert.equal(isSupportedReportRequest("informe_escolar", { fichaActual: {} }, batch), false);
  assert.equal(isSupportedReportRequest("piat_revision", null, batch), false);
  assert.equal(isSupportedReportRequest("piat_revision", { fichaActual: {} }), false);
  assert.equal(isSupportedReportRequest("piat_revision", { fichaActual: {} }, ["desconocida"]), false);
});

test("identifica los errores temporales de Gemini que admiten reintento", () => {
  assert.equal(isRetryableGeminiStatus(429), true);
  assert.equal(isRetryableGeminiStatus(503), true);
  assert.equal(isRetryableGeminiStatus(400), false);
  assert.equal(isRetryableGeminiStatus(403), false);
});

test("devuelve al usuario un motivo útil sin exponer la respuesta interna de Gemini", () => {
  assert.deepEqual(getGeminiReportError(429), {
    status: 429,
    code: "GEMINI_RATE_LIMIT",
    error: "Gemini ha alcanzado temporalmente su límite de uso. Espera un minuto y vuelve a intentarlo."
  });
  assert.equal(getGeminiReportError(503).code, "GEMINI_TEMPORARILY_UNAVAILABLE");
  assert.equal(getGeminiReportError(403).code, "GEMINI_CONFIGURATION_ERROR");
});

test("cada apartado del PIAT tiene una guía y un modelo de redacción", () => {
  const expectedIds = PIAT_REVISION_SECTIONS.map(([id]) => id);
  assert.deepEqual(Object.keys(PIAT_REVISION_WRITING_GUIDES), expectedIds);
  expectedIds.forEach((id) => {
    const item = PIAT_REVISION_WRITING_GUIDES[id];
    assert.ok(item.buscar);
    assert.ok(item.redactar);
    assert.ok(item.evitar);
    assert.ok(item.modelo);
  });
});

test("el prompt aplica modelos anonimizados sin reutilizar sus hechos clínicos", () => {
  const schema = PIAT_REVISION_SECTIONS.map(([id, titulo]) => ({ id, titulo, contenido: "" }));
  const prompt = buildPiatRevisionReportPrompt(PIAT_REVISION_SECTIONS, schema);
  assert.match(prompt, /GUÍAS ESPECÍFICAS Y MODELOS ANONIMIZADOS POR APARTADO/);
  assert.match(prompt, /nunca copies sus hechos clínicos/i);
  assert.match(prompt, /No conviertas la ausencia de un dato en una negación clínica/i);
  assert.match(prompt, /Afirmar evolución favorable solo porque sube la PD/i);
  assert.match(prompt, /clasificación incluida en confirmacionProfesional.+es vinculante/i);
  assert.match(prompt, /No deduzcas conductas observadas a partir de objetivos/i);
  assert.equal((prompt.match(/MODELO DE ESTILO/g) || []).length, PIAT_REVISION_SECTIONS.length);
  assert.doesNotMatch(prompt, /IDENTIFICADOR_PRIVADO_DE_PRUEBA/);
  assert.ok(buildPiatRevisionWritingGuide(PIAT_REVISION_SECTIONS).length > 1000);
});
