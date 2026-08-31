import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPiatRevisionContext,
  hasExpectedReportShape,
  minimizeClinicalData,
  PIAT_REVISION_SECTIONS
} from "../src/report-model.js";

test("minimiza la ficha y excluye identificadores directos y evidencia", () => {
  const result = minimizeClinicalData({
    identificacion: {
      fecha_nacimiento: { valor: "01/01/2020", evidencia: "Fecha exacta" },
      edad: { valor: "6 años", confianza: "alta", evidencia: "Edad" },
      nombre: { valor: "Paciente" }
    },
    escolarizacion: { centro: { valor: "Colegio identificable" }, curso: { valor: "Infantil" } },
    apoyo_profesional: { profesionales: ["Nombre identificable"], intervenciones_externas: ["Logopedia"] }
  });

  assert.equal(result.identificacion.fecha_nacimiento, undefined);
  assert.equal(result.identificacion.nombre, undefined);
  assert.equal(result.identificacion.edad, "6 años");
  assert.equal(result.escolarizacion.centro, undefined);
  assert.equal(result.escolarizacion.curso, "Infantil");
  assert.equal(result.apoyo_profesional.profesionales, undefined);
  assert.equal(JSON.stringify(result).includes("evidencia"), false);
});

test("construye contexto longitudinal sin nombres de archivos", () => {
  const context = buildPiatRevisionContext({
    clinicalRecord: { familia: { prioridades: { valor: "Comunicación" } } },
    documents: [{ nombreOriginal: "Nombre real.pdf", tipo: "piat_revision", fechaDocumento: "2026-08-01" }],
    revisions: [{ tipoEvento: "revision_manual", cambios: [
      { ruta: "familia.prioridades", valorNuevo: "Lenguaje" },
      { ruta: "identificacion.nombre", valorNuevo: "Nombre real" }
    ] }]
  });

  assert.equal(context.documentos[0].nombreOriginal, undefined);
  assert.equal(context.fichaActual.familia.prioridades, "Comunicación");
  assert.equal(context.evolucion.length, 1);
  assert.equal(JSON.stringify(context).includes("Nombre real"), false);
});

test("valida que Gemini devuelva todas las secciones en orden", () => {
  const valid = {
    titulo: "PIAT",
    secciones: PIAT_REVISION_SECTIONS.map(([id, titulo]) => ({ id, titulo, contenido: "Texto" }))
  };
  assert.equal(hasExpectedReportShape(valid), true);
  assert.equal(hasExpectedReportShape({ ...valid, secciones: valid.secciones.slice(1) }), false);
});
