import test from "node:test";
import assert from "node:assert/strict";

import {
  getGeminiReportError,
  isRetryableGeminiStatus,
  isSupportedReportRequest
} from "../api/generate-report.js";

test("solo admite PIAT de revisión con contexto clínico", () => {
  assert.equal(isSupportedReportRequest("piat_revision", { fichaActual: {} }), true);
  assert.equal(isSupportedReportRequest("informe_escolar", { fichaActual: {} }), false);
  assert.equal(isSupportedReportRequest("piat_revision", null), false);
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
