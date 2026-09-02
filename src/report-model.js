export const REPORT_TYPE = Object.freeze({
  PIAT_REVISION: "piat_revision"
});

export const REPORT_STATUS = Object.freeze({
  DRAFT: "borrador"
});

export const OBJECTIVE_REVIEW_STATUS = Object.freeze({
  ACHIEVED: "conseguido",
  IN_PROGRESS: "en_proceso",
  DISCARDED: "descartado"
});

export const CLINICAL_UPDATE_FIELDS = Object.freeze([
  ["comunicacion_lenguaje", "Comunicación y lenguaje"],
  ["atencion_aprendizaje", "Atención y aprendizaje"],
  ["conducta_interaccion", "Conducta e interacción"],
  ["autonomia", "Autonomía"],
  ["familia_entorno", "Familia y entorno"],
  ["salud_escolarizacion", "Cambios de salud o escolarización"]
]);

export function getReportResponseErrorMessage(status) {
  if (status === 504) {
    return "La generación ha tardado demasiado. Tus datos siguen preparados; vuelve a pulsar Generar borrador.";
  }
  if (status === 502 || status === 503) {
    return "Gemini está temporalmente saturado. Vuelve a intentarlo dentro de unos minutos.";
  }
  return "El servidor no ha podido generar el informe.";
}

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

function collectObjectiveTexts(value, result = []) {
  if (isExtractedField(value)) return collectObjectiveTexts(value.valor, result);
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjectiveTexts(item, result));
    return result;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectObjectiveTexts(item, result));
    return result;
  }
  const text = typeof value === "string" ? value.trim().replace(/^[-•]\s*/, "") : "";
  if (text && !result.includes(text)) result.push(text);
  return result;
}

export function getPreviousPiatObjectives(context) {
  const previousPiat = [...(context?.documentos || [])]
    .reverse()
    .find((documentData) =>
      ["piat_inicial", "piat_revision"].includes(documentData.tipo) &&
      documentData.informacionExtraida?.objetivos
    );
  const objectives = previousPiat?.informacionExtraida?.objetivos;
  const candidates = collectObjectiveTexts(objectives?.actuales);
  if (candidates.length > 0) return candidates;
  return collectObjectiveTexts(context?.fichaActual?.objetivos?.actuales);
}

export function buildProfessionalConfirmation({ objectiveReviews = [], clinicalUpdate = {} }) {
  const allowedStatuses = new Set(Object.values(OBJECTIVE_REVIEW_STATUS));
  const objectives = objectiveReviews.map(({ text, status }) => ({
    texto: String(text || "").trim(),
    clasificacion: String(status || "")
  }));
  if (objectives.some((item) => !item.texto || !allowedStatuses.has(item.clasificacion))) {
    throw new Error("Todos los objetivos anteriores deben estar clasificados.");
  }
  return {
    objetivosAnteriores: objectives,
    actualizacionClinica: Object.fromEntries(
      CLINICAL_UPDATE_FIELDS.map(([id]) => [id, String(clinicalUpdate[id] || "").trim()])
        .filter(([, value]) => value)
    ),
    confirmadoPorProfesional: true
  };
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

function documentSortDate(documentData) {
  return String(documentData.fechaAnalisis || documentData.fechaDocumento || "");
}

function latestReviewedAnalysesByDocument(analyses = []) {
  const result = new Map();
  analyses.forEach((analysis) => {
    if (!analysis?.documentId || !analysis.extraccionRevisada) return;
    const current = result.get(analysis.documentId);
    const analysisDate = String(analysis.fechaAnalisis || analysis.fechaAnalisisCliente || "");
    const currentDate = String(current?.fechaAnalisis || current?.fechaAnalisisCliente || "");
    if (!current || analysisDate >= currentDate) result.set(analysis.documentId, analysis);
  });
  return result;
}

export function buildPiatRevisionContext({
  clinicalRecord,
  documents = [],
  analyses = [],
  revisions = []
}) {
  const analysesByDocument = latestReviewedAnalysesByDocument(analyses);
  return {
    fichaActual: minimizeClinicalData(clinicalRecord || {}),
    documentos: documents
      .map((documentData) => ({
        tipo: documentData.tipo || "otro",
        fechaDocumento: documentData.fechaDocumento || null,
        fechaAnalisis: documentData.fechaAnalisis || null,
        informacionExtraida: minimizeClinicalData(
          analysesByDocument.get(documentData.id)?.extraccionRevisada || {}
        )
      }))
      .sort((first, second) => documentSortDate(first).localeCompare(documentSortDate(second))),
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
