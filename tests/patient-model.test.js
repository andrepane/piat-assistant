import test from "node:test";
import assert from "node:assert/strict";

import {
  createPatientDocumentId,
  getPatientClinicalRecord,
  getPatientName,
  getPatientStatus,
  normalizeMedicalRecordNumber,
  normalizeText,
  sortByNewest
} from "../src/patient-model.js";

test("normaliza nombres para detectar coincidencias", () => {
  assert.equal(normalizeText("  José   Pérez "), "jose perez");
});

test("normaliza NH sin separadores", () => {
  assert.equal(normalizeMedicalRecordNumber(" NH-12 34/A "), "nh1234a");
});

test("genera un ID estable y diferente por usuario", async () => {
  const first = await createPatientDocumentId("user-a", "1234");
  const repeated = await createPatientDocumentId("user-a", "1234");
  const otherUser = await createPatientDocumentId("user-b", "1234");

  assert.equal(first, repeated);
  assert.notEqual(first, otherUser);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("mantiene compatibilidad con pacientes antiguos", () => {
  assert.equal(getPatientName({ nombre: "Paciente antiguo" }), "Paciente antiguo");
  assert.equal(getPatientStatus({ estado: "pendiente_analisis" }), "pendiente_analisis");
  assert.deepEqual(getPatientClinicalRecord({ ficha: { salud: {} } }), { salud: {} });
  assert.deepEqual(getPatientClinicalRecord({ fichaClinica: { familia: {} } }), { familia: {} });
});

test("ordena el historial del más reciente al más antiguo", () => {
  const items = [
    { id: "old", date: "2026-01-01T00:00:00.000Z" },
    { id: "new", date: "2026-08-27T00:00:00.000Z" }
  ];

  assert.deepEqual(sortByNewest(items, (item) => item.date).map((item) => item.id), ["new", "old"]);
});
