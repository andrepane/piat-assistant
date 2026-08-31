import test from "node:test";
import assert from "node:assert/strict";

import { buildPiatWordData, buildPiatWordFilename } from "../src/piat-word-export.js";

test("buildPiatWordData combines local identification with edited sections", () => {
  const data = buildPiatWordData({
    patient: {
      nombre: "Paciente Ejemplo",
      nh: "12345",
      ficha: { identificacion: {
        edad: { valor: "36 meses" },
        fecha_nacimiento: { valor: "01/01/2023" },
        sexo: { valor: "No indicado" }
      } }
    },
    sections: [{ id: "objetivos_actuales", contenido: "Objetivo revisado manualmente" }],
    reportDate: new Date("2026-08-31T12:00:00Z")
  });

  assert.equal(data.nombre, "Paciente Ejemplo");
  assert.equal(data.nh, "12345");
  assert.equal(data.edad, "36 meses");
  assert.equal(data.fecha_nacimiento, "01/01/2023");
  assert.equal(data.objetivos_actuales, "Objetivo revisado manualmente");
  assert.equal(data.fecha_informe, "31/08/2026");
});

test("buildPiatWordData marks absent values explicitly", () => {
  const data = buildPiatWordData({
    patient: { nombre: "Paciente" },
    sections: [{ id: "familia", contenido: "" }],
    reportDate: new Date("2026-08-31T12:00:00Z")
  });
  assert.equal(data.nh, "No consta");
  assert.equal(data.edad, "No consta");
  assert.equal(data.familia, "Pendiente de completar");
});

test("buildPiatWordFilename removes unsafe filename characters", () => {
  assert.equal(
    buildPiatWordFilename({ nombre: "Álex / Ejemplo" }),
    "piat-revision-alex-ejemplo.docx"
  );
});

test("buildPiatWordData removes internal draft notices from the exported content", () => {
  const data = buildPiatWordData({
    patient: { nombre: "Paciente" },
    sections: [{
      id: "informacion_diagnostica_y_medica",
      contenido: "Contenido clínico. Nota: Este documento es un borrador sujeto a revisión profesional."
    }],
    reportDate: new Date("2026-08-31T12:00:00Z")
  });
  assert.equal(data.informacion_diagnostica_y_medica, "Contenido clínico.");
});
