import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProfessionalConfirmation,
  buildPiatRevisionContext,
  getPreviousPiatObjectives,
  getReportResponseErrorMessage,
  getReportSectionsByIds,
  hasExpectedReportShape,
  minimizeClinicalData,
  PIAT_REVISION_GENERATION_BATCHES,
  PIAT_REVISION_SECTIONS
} from "../src/report-model.js";

test("minimiza la ficha y excluye identificadores directos y evidencia", () => {
  const result = minimizeClinicalData({
    identificacion: {
      fecha_nacimiento: { valor: "01/01/2020", evidencia: "Fecha exacta" },
      edad: { valor: "6 años", confianza: "alta", evidencia: "Edad" },
      nombre: { valor: "IDENTIFICADOR_PRIVADO_DE_PRUEBA" }
    },
    escolarizacion: { centro: { valor: "CENTRO_PRIVADO_DE_PRUEBA" }, curso: { valor: "Infantil" } },
    apoyo_profesional: { profesionales: ["PROFESIONAL_PRIVADO_DE_PRUEBA"], intervenciones_externas: ["Logopedia"] }
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
    documents: [{ id: "doc-1", nombreOriginal: "ARCHIVO_PRIVADO.pdf", tipo: "piat_revision", fechaDocumento: "2026-08-01" }],
    analyses: [{
      documentId: "doc-1",
      extraccionRevisada: {
        identificacion: { nombre: { valor: "IDENTIFICADOR_PRIVADO_DE_PRUEBA" }, edad: { valor: "5 años", evidencia: "Edad" } },
        evaluaciones: [{ prueba: "Battelle", resultado: "Comunicación por debajo de lo esperado" }]
      }
    }],
    revisions: [{ tipoEvento: "revision_manual", cambios: [
      { ruta: "familia.prioridades", valorNuevo: "Lenguaje" },
      { ruta: "identificacion.nombre", valorNuevo: "IDENTIFICADOR_PRIVADO_DE_PRUEBA" }
    ] }]
  });

  assert.equal(context.documentos[0].nombreOriginal, undefined);
  assert.equal(context.fichaActual.familia.prioridades, "Comunicación");
  assert.equal(context.documentos[0].informacionExtraida.identificacion.edad, "5 años");
  assert.equal(context.documentos[0].informacionExtraida.identificacion.nombre, undefined);
  assert.equal(context.documentos[0].informacionExtraida.evaluaciones[0].prueba, "Battelle");
  assert.equal(context.evolucion.length, 1);
  assert.equal(JSON.stringify(context).includes("IDENTIFICADOR_PRIVADO_DE_PRUEBA"), false);
});

test("enlaza cada documento con su extracción revisada y no con la original", () => {
  const context = buildPiatRevisionContext({
    clinicalRecord: {},
    documents: [
      {
        id: "piat",
        tipo: "piat_revision",
        fechaDocumento: null,
        fechaAnalisis: "2026-08-21T09:00:00Z"
      },
      {
        id: "battelle",
        tipo: "evaluacion",
        fechaDocumento: "2026-08-20",
        fechaAnalisis: "2026-08-21T10:00:00Z"
      }
    ],
    analyses: [
      {
        documentId: "battelle",
        fechaAnalisis: "2026-08-21T10:00:00Z",
        extraccionOriginal: { evaluaciones: [{ resultado: "Sin revisar" }] },
        extraccionRevisada: { evaluaciones: [{ resultado: "Resultado revisado" }] }
      }
    ]
  });

  assert.equal(context.documentos[0].tipo, "piat_revision");
  assert.deepEqual(context.documentos[0].informacionExtraida, {});
  assert.equal(context.documentos[1].tipo, "evaluacion");
  assert.equal(context.documentos[1].informacionExtraida.evaluaciones[0].resultado, "Resultado revisado");
  assert.equal(JSON.stringify(context).includes("Sin revisar"), false);
});

test("valida que Gemini devuelva todas las secciones en orden", () => {
  const valid = {
    titulo: "PIAT",
    secciones: PIAT_REVISION_SECTIONS.map(([id, titulo]) => ({ id, titulo, contenido: "Texto" }))
  };
  assert.equal(hasExpectedReportShape(valid), true);
  assert.equal(hasExpectedReportShape({ ...valid, secciones: valid.secciones.slice(1) }), false);
});

test("divide la generación en bloques que cubren todas las secciones una sola vez", () => {
  const flattenedIds = PIAT_REVISION_GENERATION_BATCHES.flat();
  assert.deepEqual(flattenedIds, PIAT_REVISION_SECTIONS.map(([id]) => id));
  assert.equal(new Set(flattenedIds).size, PIAT_REVISION_SECTIONS.length);
  PIAT_REVISION_GENERATION_BATCHES.forEach((ids) => {
    assert.ok(ids.length > 0 && ids.length <= 5);
    assert.deepEqual(getReportSectionsByIds(ids).map(([id]) => id), ids);
  });
});

test("valida una respuesta parcial y rechaza lotes desconocidos o desordenados", () => {
  const sectionEntries = getReportSectionsByIds(PIAT_REVISION_GENERATION_BATCHES[0]);
  const partial = {
    titulo: "PIAT",
    secciones: sectionEntries.map(([id, titulo]) => ({ id, titulo, contenido: "Texto" }))
  };
  assert.equal(hasExpectedReportShape(partial, sectionEntries), true);
  assert.equal(getReportSectionsByIds(["desconocida"]), null);
  assert.equal(getReportSectionsByIds([...PIAT_REVISION_GENERATION_BATCHES[0]].reverse()), null);
});

test("recupera los objetivos del PIAT anterior más reciente", () => {
  const context = {
    fichaActual: { objetivos: { actuales: ["Objetivo consolidado antiguo"] } },
    documentos: [
      { tipo: "piat_inicial", informacionExtraida: { objetivos: { actuales: ["Objetivo inicial"] } } },
      { tipo: "evaluacion", informacionExtraida: { objetivos: { actuales: ["No usar"] } } },
      {
        tipo: "piat_revision",
        informacionExtraida: {
          objetivos: { actuales: [{ valor: "Mejorar la comunicación funcional." }, "Potenciar la atención."] }
        }
      }
    ]
  };
  assert.deepEqual(getPreviousPiatObjectives(context), [
    "Mejorar la comunicación funcional.",
    "Potenciar la atención."
  ]);
});

test("la confirmación profesional exige clasificar todos los objetivos", () => {
  assert.throws(
    () => buildProfessionalConfirmation({ objectiveReviews: [{ text: "Objetivo", status: "" }] }),
    /deben estar clasificados/
  );
  assert.deepEqual(buildProfessionalConfirmation({
    objectiveReviews: [
      { text: "Objetivo uno", status: "conseguido" },
      { text: "Objetivo dos", status: "descartado" }
    ],
    clinicalUpdate: { comunicacion_lenguaje: "Utiliza frases de tres elementos.", autonomia: "" }
  }), {
    objetivosAnteriores: [
      { texto: "Objetivo uno", clasificacion: "conseguido" },
      { texto: "Objetivo dos", clasificacion: "descartado" }
    ],
    actualizacionClinica: { comunicacion_lenguaje: "Utiliza frases de tres elementos." },
    confirmadoPorProfesional: true
  });
});

test("explica los errores de infraestructura aunque Vercel no devuelva JSON", () => {
  assert.match(getReportResponseErrorMessage(504), /ha tardado demasiado/i);
  assert.match(getReportResponseErrorMessage(503), /temporalmente saturado/i);
  assert.match(getReportResponseErrorMessage(500), /no ha podido generar/i);
});
