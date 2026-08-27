import test from "node:test";
import assert from "node:assert/strict";

import {
  applyClinicalRecordEdits,
  createPatientDocumentId,
  getPatientClinicalRecord,
  getPatientName,
  getPatientStatus,
  normalizeMedicalRecordNumber,
  normalizeText,
  sortByNewest,
  valuesAreEqual
} from "../src/patient-model.js";

test("considera iguales mapas de Firestore aunque cambie el orden de sus claves", () => {
  const loadedRecord = {
    identificacion: {
      edad: { valor: "32 meses", confianza: "alta", evidencia: "Edad: 32 meses" },
      sexo: { valor: "Varón", confianza: "alta" }
    }
  };
  const transactionRecord = {
    identificacion: {
      sexo: { confianza: "alta", valor: "Varón" },
      edad: { evidencia: "Edad: 32 meses", confianza: "alta", valor: "32 meses" }
    }
  };

  assert.equal(valuesAreEqual(loadedRecord, transactionRecord), true);
  transactionRecord.identificacion.edad.valor = "33 meses";
  assert.equal(valuesAreEqual(loadedRecord, transactionRecord), false);
});

test("aplica solo cambios reales y conserva la trazabilidad del campo", () => {
  const original = {
    identificacion: {
      edad: { valor: "32 meses", confianza: "alta", evidencia: "Edad: 32 meses" },
      nombre: { valor: "Paciente" },
      hermanos: 1
    }
  };

  const result = applyClinicalRecordEdits(original, [
    { path: ["identificacion", "edad"], rawValue: "33 meses" },
    { path: ["identificacion", "nombre"], rawValue: "Paciente" },
    { path: ["identificacion", "hermanos"], rawValue: "2" }
  ]);

  assert.equal(result.updatedRecord.identificacion.edad.valor, "33 meses");
  assert.equal(result.updatedRecord.identificacion.edad.valorAnterior, "32 meses");
  assert.equal(result.updatedRecord.identificacion.edad.procedenciaValor, "manual");
  assert.equal(result.updatedRecord.identificacion.edad.revisadoManualmente, true);
  assert.equal(result.updatedRecord.identificacion.hermanos, 2);
  assert.deepEqual(result.changes, [
    { ruta: "identificacion.edad", valorAnterior: "32 meses", valorNuevo: "33 meses" },
    { ruta: "identificacion.hermanos", valorAnterior: 1, valorNuevo: 2 }
  ]);
  assert.equal(original.identificacion.edad.valor, "32 meses");
});

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
