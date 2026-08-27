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
