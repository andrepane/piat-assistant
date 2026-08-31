import { getPatientClinicalRecord, getPatientName, getPatientNH } from "./patient-model.js";

export const PIAT_WORD_TEMPLATE_URL = "./assets/piat-revision-template.docx";
const PIZZIP_URL = "https://cdn.jsdelivr.net/npm/pizzip@3.2.0/dist/pizzip.min.js";
const DOCXTEMPLATER_URL = "https://cdn.jsdelivr.net/npm/docxtemplater@3.66.7/build/docxtemplater.js";
const WORD_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const scriptPromises = new Map();

function unwrapExtractedValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "valor") ? value.valor : value;
}

function printableValue(value, fallback = "No consta") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function cleanReportContent(value) {
  return String(value || "")
    .replace(/(?:Nota:\s*)?Este documento es un borrador sujeto a revisión profesional\.?/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function loadBrowserScript(url, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (scriptPromises.has(url)) return scriptPromises.get(url);
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    const script = existing || document.createElement("script");
    script.addEventListener("load", () => window[globalName]
      ? resolve(window[globalName])
      : reject(new Error(`La librería ${globalName} no se ha cargado correctamente.`)), { once: true });
    script.addEventListener("error", () => reject(
      new Error("No se han podido cargar los recursos para crear el Word.")
    ), { once: true });
    if (!existing) {
      script.src = url;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });
  scriptPromises.set(url, promise);
  return promise;
}

export function buildPiatWordData({ patient = {}, sections = [], reportDate = new Date() }) {
  const identification = getPatientClinicalRecord(patient)?.identificacion || {};
  const result = {
    nombre: printableValue(getPatientName(patient)),
    nh: printableValue(getPatientNH(patient)),
    fecha_nacimiento: printableValue(unwrapExtractedValue(identification.fecha_nacimiento)),
    edad: printableValue(unwrapExtractedValue(identification.edad)),
    sexo: printableValue(unwrapExtractedValue(identification.sexo)),
    fecha_informe: new Intl.DateTimeFormat("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric"
    }).format(reportDate)
  };
  for (const section of sections) {
    if (section?.id) {
      result[section.id] = printableValue(
        cleanReportContent(section.contenido),
        "Pendiente de completar"
      );
    }
  }
  return result;
}

export function buildPiatWordFilename(patient = {}) {
  const safeName = getPatientName(patient).normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "paciente";
  return `piat-revision-${safeName}.docx`;
}

export async function createPiatWordBlob(data) {
  const [PizZip, Docxtemplater, response] = await Promise.all([
    loadBrowserScript(PIZZIP_URL, "PizZip"),
    loadBrowserScript(DOCXTEMPLATER_URL, "docxtemplater"),
    fetch(PIAT_WORD_TEMPLATE_URL, { cache: "no-store" })
  ]);
  if (!response.ok) throw new Error("No se ha podido cargar la plantilla del PIAT.");
  try {
    const template = new Docxtemplater(new PizZip(await response.arrayBuffer()), {
      paragraphLoop: true,
      linebreaks: true
    });
    template.render(data);
    return template.getZip().generate({
      type: "blob", mimeType: WORD_MIME_TYPE, compression: "DEFLATE"
    });
  } catch (error) {
    console.error("Error preparando el documento Word:", error);
    throw new Error("No se ha podido completar la plantilla Word.");
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
