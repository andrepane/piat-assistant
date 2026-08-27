export const SCHEMA_VERSION = 2;

export const PATIENT_STATUS = Object.freeze({
  ACTIVE: "activo",
  DISCHARGED: "alta",
  ARCHIVED: "archivado"
});

export const ANALYSIS_STATUS = Object.freeze({
  REVIEWED: "revisado"
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

export function humanizeKey(key) {
  const label = String(key).replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isMissingValue(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

export function valuesAreEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
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
