import test from "node:test";
import assert from "node:assert/strict";

import {
  applyClinicalRecordEdits,
  applyClinicalComparison,
  buildClinicalComparison,
  CLINICAL_SECTION_ORDER,
  createPatientDocumentId,
  getPatientClinicalRecord,
  getPatientName,
  getPatientStatus,
  hasPdfSignature,
  linkDocumentsWithAnalyses,
  normalizeMedicalRecordNumber,
  normalizeText,
  orderedEntries,
  sortByNewest,
  valuesAreEqual
} from "../src/patient-model.js";

test("propone solo datos nuevos útiles que difieren de la ficha", () => {
  const comparisons = buildClinicalComparison(
    { identificacion: { edad: { valor: "32 meses" }, sexo: { valor: "Varón" } } },
    {
      identificacion: {
        edad: { valor: "33 meses", confianza: "alta" },
        sexo: { valor: "Varón", confianza: "alta" },
        fecha_nacimiento: { valor: null, confianza: "baja" }
      }
    }
  );
  assert.equal(comparisons.length, 1);
  assert.deepEqual(comparisons[0].path, ["identificacion", "edad"]);
  assert.equal(comparisons[0].currentValue, "32 meses");
  assert.equal(comparisons[0].newValue, "33 meses");
});

test("incorpora únicamente los cambios seleccionados y conserva trazabilidad", () => {
  const current = { identificacion: { edad: { valor: "32 meses" } } };
  const comparisons = buildClinicalComparison(current, {
    identificacion: {
      edad: { valor: "33 meses", confianza: "alta" },
      sexo: { valor: "Varón", confianza: "alta" }
    }
  });
  const result = applyClinicalComparison(
    current,
    comparisons,
    ["identificacion.edad"],
    { analysisId: "analysis-1", incorporatedAt: "2026-08-31T10:00:00.000Z" }
  );
  assert.equal(result.updatedRecord.identificacion.edad.valor, "33 meses");
  assert.equal(result.updatedRecord.identificacion.edad.incorporadoDesdeAnalisisId, "analysis-1");
  assert.equal(result.updatedRecord.identificacion.sexo, undefined);
  assert.equal(result.changes.length, 1);
});

test("comprueba la firma real de un PDF", () => {
  assert.equal(hasPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(hasPdfSignature(new Uint8Array([0x50, 0x44, 0x46])), false);
});

test("mantiene un orden clínico estable aunque Firestore reordene las claves", () => {
  const record = { familia: {}, identificacion: {}, salud: {}, diagnostico: {} };
  assert.deepEqual(
    orderedEntries(record, CLINICAL_SECTION_ORDER).map(([key]) => key),
    ["identificacion", "diagnostico", "salud", "familia"]
  );
  assert.deepEqual(
    orderedEntries({ zeta: 1, alfa: 2, beta: 3 }).map(([key]) => key),
    ["alfa", "beta", "zeta"]
  );
  assert.deepEqual(orderedEntries(["primero", "segundo"]), [
    ["0", "primero"],
    ["1", "segundo"]
  ]);
});

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

test("relaciona cada documento con su análisis y admite registros antiguos", () => {
  const analyses = [
    { id: "analysis-1", documentId: "document-1" },
    { id: "analysis-legacy", documentId: "document-legacy" }
  ];
  const documents = [
    { id: "document-1", analysisId: "analysis-1" },
    { id: "document-legacy" },
    { id: "document-without-analysis" }
  ];

  const linked = linkDocumentsWithAnalyses(documents, analyses);

  assert.equal(linked[0].analysis.id, "analysis-1");
  assert.equal(linked[1].analysis.id, "analysis-legacy");
  assert.equal(linked[2].analysis, null);
});
