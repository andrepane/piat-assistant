import test from "node:test";
import assert from "node:assert/strict";

import { hasPrivacyConfirmation } from "../api/analyze.js";

test("acepta únicamente una confirmación de privacidad explícita", () => {
  assert.equal(hasPrivacyConfirmation(true), true);
  assert.equal(hasPrivacyConfirmation(false), false);
  assert.equal(hasPrivacyConfirmation("true"), false);
  assert.equal(hasPrivacyConfirmation(undefined), false);
});
