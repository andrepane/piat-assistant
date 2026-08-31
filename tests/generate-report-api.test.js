import test from "node:test";
import assert from "node:assert/strict";

import { isSupportedReportRequest } from "../api/generate-report.js";

test("solo admite PIAT de revisión con contexto clínico", () => {
  assert.equal(isSupportedReportRequest("piat_revision", { fichaActual: {} }), true);
  assert.equal(isSupportedReportRequest("informe_escolar", { fichaActual: {} }), false);
  assert.equal(isSupportedReportRequest("piat_revision", null), false);
});
