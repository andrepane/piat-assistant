import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeForPrivacyScan,
  scanTextForIdentifiers
} from "../src/privacy-scanner.js";

test("normaliza tildes y espacios para buscar identificadores", () => {
  assert.equal(normalizeForPrivacyScan("  ÁLVARO   Pérez "), "alvaro perez");
});

test("detecta el nombre y NH conocidos", () => {
  const findings = scanTextForIdentifiers({
    text: "Paciente: Álvaro Pérez. Número de historia 23-53.",
    known: { name: "Álvaro Pérez", nh: "2353" }
  });
  assert.deepEqual(findings.map((finding) => finding.type), ["known-name", "known-nh"]);
  assert.equal(findings.every((finding) => finding.blocking), true);
});

test("detecta correo, DNI y teléfono como coincidencias bloqueantes", () => {
  const findings = scanTextForIdentifiers({
    text: "correo familia@example.com DNI 12345678Z teléfono 612 345 678"
  });
  assert.deepEqual(findings.map((finding) => finding.type), ["email", "dni-nie", "phone"]);
});

test("marca campos sensibles genéricos para revisión sin bloquear", () => {
  const findings = scanTextForIdentifiers({ text: "Centro escolar: CEIP Ejemplo" });
  assert.equal(findings[0].type, "label-centro escolar:");
  assert.equal(findings[0].blocking, false);
});
