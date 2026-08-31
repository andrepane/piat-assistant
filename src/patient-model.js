export const SCHEMA_VERSION = 2;

export const PATIENT_STATUS = Object.freeze({
  ACTIVE: "activo",
  DISCHARGED: "alta",
  ARCHIVED: "archivado"
});

export const ANALYSIS_STATUS = Object.freeze({
  REVIEWED: "revisado"
});

export const DOCUMENT_STATUS = Object.freeze({
  PROCESSING: "procesando",
  ANALYZED: "analizado",
  ERROR: "error",
  ARCHIVED: "archivado"
});

export const CLINICAL_SECTION_ORDER = Object.freeze([
  "identificacion",
  "diagnostico",
  "salud",
  "escolarizacion",
  "desarrollo_y_contexto",
  "familia",
  "apoyo_profesional",
  "evaluaciones",
  "objetivos",
  "informacion_adicional"
]);

export const CLINICAL_FIELD_ORDER = Object.freeze({
  identificacion: ["fecha_nacimiento", "sexo", "edad"],
  diagnostico: ["diagnostico_funcional_odat", "diagnostico_principal_cait", "otros_diagnosticos"],
  salud: [
    "informacion_medica",
    "antecedentes_personales",
    "antecedentes_familiares",
    "otros_datos_salud",
    "centro_salud",
    "seguimientos_especialistas",
    "medicacion",
    "alergias"
  ],
  escolarizacion: ["centro", "curso", "modalidad", "apoyos"],
  desarrollo_y_contexto: [
    "estado_fisico_general",
    "aspectos_emocionales_menor",
    "aspectos_emocionales_cuidadores",
    "entorno_familiar",
    "conducta",
    "sociabilidad"
  ],
  familia: ["preocupaciones_actuales", "prioridades"],
  apoyo_profesional: ["profesional_referencia", "profesionales", "intervenciones_externas"],
  objetivos: ["actuales", "conseguidos", "en_proceso"]
});

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeMedicalRecordNumber(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

export async function createPatientDocumentId(userId, normalizedNH) {
  const input = new TextEncoder().encode(`${userId}:${normalizedNH}`);
  const digest = await crypto.subtle.digest("SHA-256", input);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPdfSignature(bytes) {
  return bytes?.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d;
}

export function humanizeKey(key) {
  const label = String(key).replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isMissingValue(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

export function valuesAreEqual(a, b) {
  return stableSerialize(a) === stableSerialize(b);
}

function stableSerialize(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value?.toMillis === "function") return JSON.stringify(value.toMillis());
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function coerceEditedValue(rawValue, originalValue) {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) return null;
  if (typeof originalValue === "number" && !Number.isNaN(Number(trimmedValue))) {
    return Number(trimmedValue);
  }
  if (typeof originalValue === "boolean") {
    if (trimmedValue.toLowerCase() === "true") return true;
    if (trimmedValue.toLowerCase() === "false") return false;
  }

  return trimmedValue;
}

export function formatTimestamp(value) {
  if (!value) return "Sin fecha";

  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export function getPatientStatus(patient) {
  return patient.estadoClinico || patient.estado || PATIENT_STATUS.ACTIVE;
}

export function getPatientName(patient) {
  return patient.nombre || patient.identidad?.nombre || "Paciente sin nombre";
}

export function getPatientNH(patient) {
  return patient.nh || patient.identidad?.nh || null;
}

export function getPatientAge(patient) {
  return patient.ficha?.identificacion?.edad?.valor ?? null;
}

export function getPatientClinicalRecord(patient) {
  return patient.ficha || patient.fichaClinica || null;
}

export function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();

  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function sortByNewest(items, getTimestamp) {
  return [...items].sort(
    (first, second) =>
      timestampToMillis(getTimestamp(second)) - timestampToMillis(getTimestamp(first))
  );
}

export function linkDocumentsWithAnalyses(documents = [], analyses = []) {
  const analysesById = new Map(analyses.map((analysis) => [analysis.id, analysis]));
  const analysesByDocumentId = new Map(
    analyses
      .filter((analysis) => analysis.documentId)
      .map((analysis) => [analysis.documentId, analysis])
  );

  return documents.map((documentData) => ({
    ...documentData,
    analysis:
      analysesById.get(documentData.analysisId) ||
      analysesByDocumentId.get(documentData.id) ||
      null
  }));
}

export function orderedEntries(value, preferredKeys = []) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return Object.entries(value);
  const preferredPositions = new Map(preferredKeys.map((key, index) => [key, index]));

  return Object.entries(value).sort(([firstKey], [secondKey]) => {
    const firstPosition = preferredPositions.get(firstKey);
    const secondPosition = preferredPositions.get(secondKey);
    if (firstPosition !== undefined || secondPosition !== undefined) {
      return (firstPosition ?? Number.MAX_SAFE_INTEGER) -
        (secondPosition ?? Number.MAX_SAFE_INTEGER);
    }
    return firstKey.localeCompare(secondKey, "es");
  });
}

export function applyClinicalRecordEdits(originalRecord, edits) {
  const updatedRecord = structuredClone(originalRecord);
  const changes = [];

  edits.forEach(({ path, rawValue }) => {
    const originalValue = path.reduce((current, segment) => current?.[segment], originalRecord);
    const isExtractedField = Boolean(
      originalValue &&
      typeof originalValue === "object" &&
      !Array.isArray(originalValue) &&
      Object.prototype.hasOwnProperty.call(originalValue, "valor")
    );
    const valueBeforeEdit = isExtractedField ? originalValue.valor : originalValue;
    const updatedValue = coerceEditedValue(rawValue, valueBeforeEdit);
    if (valuesAreEqual(valueBeforeEdit, updatedValue)) return;

    changes.push({
      ruta: path.join("."),
      valorAnterior: valueBeforeEdit ?? null,
      valorNuevo: updatedValue
    });

    if (isExtractedField) {
      const updatedField = path.reduce((current, segment) => current?.[segment], updatedRecord);
      updatedField.valorAnterior = valueBeforeEdit ?? null;
      updatedField.valor = updatedValue;
      updatedField.procedenciaValor = "manual";
      updatedField.revisadoManualmente = true;
      return;
    }

    const parent = path
      .slice(0, -1)
      .reduce((current, segment) => current?.[segment], updatedRecord);
    if (parent !== null && parent !== undefined) parent[path.at(-1)] = updatedValue;
  });

  return { updatedRecord, changes };
}

function isExtractedClinicalField(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "valor")
  );
}

function hasMeaningfulClinicalValue(value) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function getClinicalValue(value) {
  return isExtractedClinicalField(value) ? value.valor : value;
}

export function buildClinicalComparison(currentRecord = {}, newRecord = {}) {
  const comparisons = [];

  function visit(currentValue, newValue, path) {
    if (isExtractedClinicalField(newValue)) {
      const currentClinicalValue = getClinicalValue(currentValue);
      if (
        hasMeaningfulClinicalValue(newValue.valor) &&
        !valuesAreEqual(currentClinicalValue, newValue.valor)
      ) {
        comparisons.push({
          path,
          currentValue: currentClinicalValue ?? null,
          newValue: newValue.valor,
          newNode: structuredClone(newValue)
        });
      }
      return;
    }

    if (Array.isArray(newValue) || typeof newValue !== "object" || newValue === null) {
      const currentClinicalValue = getClinicalValue(currentValue);
      if (
        hasMeaningfulClinicalValue(newValue) &&
        !valuesAreEqual(currentClinicalValue, newValue)
      ) {
        comparisons.push({
          path,
          currentValue: currentClinicalValue ?? null,
          newValue,
          newNode: structuredClone(newValue)
        });
      }
      return;
    }

    orderedEntries(newValue).forEach(([key, child]) => {
      visit(currentValue?.[key], child, [...path, key]);
    });
  }

  CLINICAL_SECTION_ORDER.forEach((section) => {
    if (Object.prototype.hasOwnProperty.call(newRecord, section)) {
      visit(currentRecord?.[section], newRecord[section], [section]);
    }
  });
  orderedEntries(newRecord)
    .filter(([section]) => !CLINICAL_SECTION_ORDER.includes(section))
    .forEach(([section, value]) => visit(currentRecord?.[section], value, [section]));

  return comparisons;
}

function setClinicalPath(target, path, value) {
  let current = target;
  path.slice(0, -1).forEach((segment) => {
    if (!current[segment] || typeof current[segment] !== "object") current[segment] = {};
    current = current[segment];
  });
  current[path.at(-1)] = value;
}

export function applyClinicalComparison(
  currentRecord,
  comparisons,
  selectedPaths,
  { analysisId, incorporatedAt }
) {
  const updatedRecord = structuredClone(currentRecord || {});
  const selected = new Set(selectedPaths);
  const changes = [];

  comparisons.forEach((comparison) => {
    const route = comparison.path.join(".");
    if (!selected.has(route)) return;
    const nextNode = structuredClone(comparison.newNode);
    if (isExtractedClinicalField(nextNode)) {
      nextNode.incorporadoEnFicha = true;
      nextNode.incorporadoDesdeAnalisisId = analysisId;
      nextNode.incorporadoAt = incorporatedAt;
    }
    setClinicalPath(updatedRecord, comparison.path, nextNode);
    changes.push({
      ruta: route,
      valorAnterior: comparison.currentValue,
      valorNuevo: comparison.newValue
    });
  });

  return { updatedRecord, changes };
}
