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

export const PIAT_REVISION_GENERATION_BATCHES = Object.freeze([
  Object.freeze([
    "informacion_diagnostica_y_medica",
    "antecedentes_personales",
    "antecedentes_familiares",
    "otros_datos_salud",
    "datos_escolarizacion"
  ]),
  Object.freeze([
    "aspectos_biopsicosociales",
    "red_apoyo_profesional",
    "exploracion_pruebas",
    "interpretacion_evolucion",
    "exploracion_cualitativa"
  ]),
  Object.freeze([
    "preocupaciones_familia",
    "objetivos_conseguidos",
    "objetivos_en_proceso",
    "objetivos_actuales"
  ]),
  Object.freeze([
    "familia",
    "entorno",
    "profesionales",
    "sesiones_pautadas",
    "materiales_recursos"
  ])
]);

export function getReportSectionsByIds(sectionIds) {
  if (!Array.isArray(sectionIds) || sectionIds.length === 0 || sectionIds.length > 5) return null;
  const requestedIds = new Set(sectionIds);
  if (requestedIds.size !== sectionIds.length) return null;
  const sections = PIAT_REVISION_SECTIONS.filter(([id]) => requestedIds.has(id));
  if (
    sections.length !== sectionIds.length ||
    sections.some(([id], index) => id !== sectionIds[index])
  ) return null;
  return sections;
}

const REPORT_SECTION_CONTEXT_KEYS = Object.freeze({
  informacion_diagnostica_y_medica: ["diagnostico", "salud"],
  antecedentes_personales: ["salud", "desarrollo_y_contexto", "informacion_adicional"],
  antecedentes_familiares: ["familia", "salud", "informacion_adicional"],
  otros_datos_salud: ["salud", "diagnostico", "apoyo_profesional"],
  datos_escolarizacion: ["escolarizacion", "apoyo_profesional"],
  aspectos_biopsicosociales: ["desarrollo_y_contexto", "familia", "escolarizacion"],
  red_apoyo_profesional: ["apoyo_profesional", "escolarizacion", "salud"],
  exploracion_pruebas: ["evaluaciones", "identificacion"],
  interpretacion_evolucion: ["evaluaciones", "desarrollo_y_contexto", "objetivos"],
  exploracion_cualitativa: ["desarrollo_y_contexto", "evaluaciones"],
  preocupaciones_familia: ["familia", "desarrollo_y_contexto"],
  objetivos_conseguidos: ["objetivos", "desarrollo_y_contexto", "evaluaciones"],
  objetivos_en_proceso: ["objetivos", "desarrollo_y_contexto", "evaluaciones"],
  objetivos_actuales: ["objetivos", "desarrollo_y_contexto", "evaluaciones", "familia"],
  familia: ["familia", "objetivos", "desarrollo_y_contexto"],
  entorno: ["escolarizacion", "objetivos", "desarrollo_y_contexto"],
  profesionales: ["apoyo_profesional", "objetivos", "salud", "escolarizacion"],
  sesiones_pautadas: ["apoyo_profesional", "informacion_adicional"],
  materiales_recursos: ["objetivos", "apoyo_profesional", "informacion_adicional"]
});

function pickContextKeys(value, allowedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => allowedKeys.has(key))
  );
}

function hasObjectContent(value) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

export function buildPiatRevisionBatchContext(context, sectionIds) {
  if (!getReportSectionsByIds(sectionIds)) return null;
  const allowedKeys = new Set(
    sectionIds.flatMap((sectionId) => REPORT_SECTION_CONTEXT_KEYS[sectionId] || [])
  );
  const documents = [];
  const seenDocuments = new Set();
  (context?.documentos || []).forEach((documentData) => {
    const informacionExtraida = pickContextKeys(documentData.informacionExtraida, allowedKeys);
    if (!hasObjectContent(informacionExtraida)) return;
    const compactDocument = {
      tipo: documentData.tipo || "otro",
      fechaDocumento: documentData.fechaDocumento || null,
      fechaAnalisis: documentData.fechaAnalisis || null,
      informacionExtraida
    };
    const fingerprint = JSON.stringify(compactDocument);
    if (seenDocuments.has(fingerprint)) return;
    seenDocuments.add(fingerprint);
    documents.push(compactDocument);
  });
  const evolucion = (context?.evolucion || []).map((revision) => ({
    tipo: revision.tipo,
    fecha: revision.fecha,
    cambios: (revision.cambios || []).filter((change) =>
      allowedKeys.has(String(change?.ruta || "").split(".")[0])
    )
  })).filter((revision) => revision.cambios.length > 0);
  return {
    fichaActual: pickContextKeys(context?.fichaActual, allowedKeys),
    documentos: documents,
    evolucion,
    confirmacionProfesional: context?.confirmacionProfesional || null
  };
}

export function getClinicalContextMetrics(context, sectionIds) {
  const compactContext = buildPiatRevisionBatchContext(context, sectionIds);
  if (!compactContext) return null;
  const fullCharacters = JSON.stringify(context || {}).length;
  const compactCharacters = JSON.stringify(compactContext).length;
  return {
    fullCharacters,
    compactCharacters,
    approximateTokens: Math.ceil(compactCharacters / 4),
    reductionPercent: fullCharacters > 0
      ? Math.max(0, Math.round((1 - compactCharacters / fullCharacters) * 100))
      : 0
  };
}

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

export function hasExpectedReportShape(value, sectionEntries = PIAT_REVISION_SECTIONS) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.titulo !== "string" ||
    !value.titulo.trim() ||
    !Array.isArray(value.secciones)
  ) return false;
  const expectedIds = sectionEntries.map(([id]) => id);
  return value.secciones.length === expectedIds.length && value.secciones.every(
    (section, index) =>
      section?.id === expectedIds[index] &&
      typeof section.titulo === "string" &&
      typeof section.contenido === "string"
  );
}
