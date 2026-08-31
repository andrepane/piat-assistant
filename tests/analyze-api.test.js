import test from "node:test";
import assert from "node:assert/strict";

import { getAnalysisInputKind, hasPrivacyConfirmation } from "../api/analyze.js";

test("acepta únicamente una confirmación de privacidad explícita", () => {
  assert.equal(hasPrivacyConfirmation(true), true);
  assert.equal(hasPrivacyConfirmation(false), false);
  assert.equal(hasPrivacyConfirmation("true"), false);
  assert.equal(hasPrivacyConfirmation(undefined), false);
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
