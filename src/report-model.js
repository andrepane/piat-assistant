export const REPORT_TYPE = Object.freeze({
  PIAT_REVISION: "piat_revision"
});

export const REPORT_STATUS = Object.freeze({
  DRAFT: "borrador"
});

export const PIAT_REVISION_SECTIONS = Object.freeze([
  ["informacion_diagnostica_y_medica", "Información diagnóstica y médica"],
  ["antecedentes_personales", "Antecedentes personales"],
  ["antecedentes_familiares", "Antecedentes familiares"],
  ["otros_datos_salud", "Otros datos de salud"],
  ["datos_escolarizacion", "Datos de escolarización"],
  ["aspectos_biopsicosociales", "Aspectos biopsicosociales"],
  ["red_apoyo_profesional", "Red de apoyo profesional"],
  ["exploracion_pruebas", "Exploración y pruebas"],
  ["interpretacion_evolucion", "Interpretación de la evolución"],
  ["exploracion_cualitativa", "Exploración cualitativa"],
  ["preocupaciones_familia", "Preocupaciones de la familia"],
  ["objetivos_conseguidos", "Objetivos conseguidos"],
  ["objetivos_en_proceso", "Objetivos en proceso"],
  ["objetivos_actuales", "Objetivos propuestos"],
  ["familia", "Actuaciones con la familia"],
  ["entorno", "Actuaciones en el entorno"],
  ["profesionales", "Actuaciones profesionales"],
  ["sesiones_pautadas", "Sesiones pautadas"],
  ["materiales_recursos", "Materiales y recursos"]
]);

const OMITTED_KEYS = new Set([
  "nombre",
  "apellidos",
  "nh",
  "nh_normalizado",
  "dni",
  "nie",
  "nuss",
  "telefono",
  "email",
  "direccion",
  "domicilio",
  "fecha_nacimiento",
  "centro",
  "centro_salud",
  "profesional_referencia",
  "profesional",
  "profesionales"
]);

function isExtractedField(value) {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "valor")
  );
}

function routeContainsIdentifier(route) {
  return String(route || "")
    .split(".")
    .some((segment) => OMITTED_KEYS.has(segment.toLowerCase()));
}

export function minimizeClinicalData(value) {
  if (isExtractedField(value)) return minimizeClinicalData(value.valor);
  if (Array.isArray(value)) {
    return value
      .map(minimizeClinicalData)
      .filter((item) => item !== null && item !== undefined && item !== "");
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !OMITTED_KEYS.has(key.toLowerCase()))
        .map(([key, child]) => [key, minimizeClinicalData(child)])
        .filter(([, child]) => child !== null && child !== undefined && child !== "")
    );
  }
  return value ?? null;
}

export function buildPiatRevisionContext({ clinicalRecord, documents = [], revisions = [] }) {
  return {
    fichaActual: minimizeClinicalData(clinicalRecord || {}),
    documentos: documents
      .map((documentData) => ({
        tipo: documentData.tipo || "otro",
        fechaDocumento: documentData.fechaDocumento || null,
        fechaAnalisis: documentData.fechaAnalisis || null
      }))
      .sort((first, second) => String(first.fechaDocumento || first.fechaAnalisis || "")
        .localeCompare(String(second.fechaDocumento || second.fechaAnalisis || ""))),
    evolucion: revisions
      .map((revision) => ({
        tipo: revision.tipoEvento || "actualizacion",
        fecha: revision.fecha || null,
        cambios: minimizeClinicalData(
          (revision.cambios || []).filter((change) => !routeContainsIdentifier(change?.ruta))
        )
      }))
      .sort((first, second) => String(first.fecha || "").localeCompare(String(second.fecha || "")))
  };
}

export function hasExpectedReportShape(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.titulo !== "string" ||
    !value.titulo.trim() ||
    !Array.isArray(value.secciones)
  ) return false;
  const expectedIds = PIAT_REVISION_SECTIONS.map(([id]) => id);
  return value.secciones.length === expectedIds.length && value.secciones.every(
    (section, index) =>
      section?.id === expectedIds[index] &&
      typeof section.titulo === "string" &&
      typeof section.contenido === "string"
  );
}
