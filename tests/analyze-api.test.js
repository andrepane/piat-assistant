import test from "node:test";
import assert from "node:assert/strict";

import {
  getAnalysisInputKind,
  getEvaluationExtractionInstructions,
  hasExpectedEvaluationExtractionShape,
  hasPrivacyConfirmation,
  isSupportedDocumentType
} from "../api/analyze.js";

test("acepta únicamente una confirmación de privacidad explícita", () => {
  assert.equal(hasPrivacyConfirmation(true), true);
  assert.equal(hasPrivacyConfirmation(false), false);
  assert.equal(hasPrivacyConfirmation("true"), false);
  assert.equal(hasPrivacyConfirmation(undefined), false);
});

test("solo admite los tipos de documento disponibles en la interfaz", () => {
  assert.equal(isSupportedDocumentType("evaluacion"), true);
  assert.equal(isSupportedDocumentType("piat_revision"), true);
  assert.equal(isSupportedDocumentType("imagen"), false);
});

test("activa instrucciones exhaustivas únicamente para evaluaciones", () => {
  const instructions = getEvaluationExtractionInstructions("evaluacion");
  assert.equal(instructions.includes("todas las filas"), true);
  assert.equal(instructions.includes("Personal-Social"), true);
  assert.equal(getEvaluationExtractionInstructions("piat_revision"), "");
});

test("rechaza una evaluación que no conserve pruebas y áreas estructuradas", () => {
  const base = { identificacion: {}, diagnostico: {}, salud: {} };
  assert.equal(hasExpectedEvaluationExtractionShape({ ...base, evaluaciones: [] }), false);
  assert.equal(hasExpectedEvaluationExtractionShape({
    ...base,
    evaluaciones: [{ nombre_prueba: { valor: "Battelle" }, resultado_global: {}, areas: [] }]
  }), true);
});

test("acepta un único tipo de entrada para el análisis", () => {
  assert.equal(getAnalysisInputKind({ fileBase64: "JVBERg==" }), "pdf");
  assert.equal(getAnalysisInputKind({ documentText: "Texto anonimizado" }), "anonymized_text");
  assert.equal(getAnalysisInputKind({}), null);
  assert.equal(
    getAnalysisInputKind({ fileBase64: "JVBERg==", documentText: "Texto" }),
    null
  );
});
