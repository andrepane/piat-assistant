import { normalizeForPrivacyScan, scanTextForIdentifiers } from "./privacy-scanner.js";

const FFLATE_URL = "https://cdn.jsdelivr.net/npm/fflate@0.8.3/umd/index.js";
const MAX_EXTRACTED_TEXT_LENGTH = 250000;
const MAX_DOCX_XML_BYTES = 5 * 1024 * 1024;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeXmlEntities(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

export function extractTextFromWordXml(xml) {
  return decodeXmlEntities(
    String(xml)
      .replace(/<w:del\b[^>]*>[\s\S]*?<\/w:del\s*>/gi, "")
      .replace(/<w:moveFrom\b[^>]*>[\s\S]*?<\/w:moveFrom\s*>/gi, "")
      .replace(
        /<w:r\b[^>]*>(?=(?:(?!<\/w:r>)[\s\S])*?<w:vanish\b)(?:(?!<\/w:r>)[\s\S])*?<\/w:r\s*>/gi,
        ""
      )
      .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText\s*>/gi, "")
      .replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText\s*>/gi, "")
      .replace(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc\s*>/gi, (_cell, content) =>
        `${content.replace(/<\/w:p\s*>/gi, " ")}\t`
      )
      .replace(/<\/w:tr\s*>/gi, "\n")
      .replace(/<w:tab\b[^>]*\/?\s*>/gi, "\t")
      .replace(/<w:br\b[^>]*\/?\s*>/gi, "\n")
      .replace(/<\/w:p\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/ *\t */g, "\t")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function replacePattern(text, expression, replacement, type, replacements) {
  let count = 0;
  const updated = text.replace(expression, (...args) => {
    count += 1;
    return typeof replacement === "function" ? replacement(...args) : replacement;
  });
  if (count > 0) replacements.push({ type, count });
  return updated;
}

function flexibleIdentifierExpression(value) {
  const compact = String(value || "").replace(/[^a-z0-9]/gi, "");
  if (compact.length < 3) return null;
  return new RegExp(`\\b${[...compact].map(escapeRegExp).join("[\\s./-]*")}\\b`, "gi");
}

function getNameTokens(name) {
  const excluded = new Set(["de", "del", "la", "las", "los", "y"]);
  return [...new Set(
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !excluded.has(token.toLowerCase()))
  )];
}

export function anonymizeClinicalText(text, known = {}) {
  let anonymizedText = String(text || "");
  const replacements = [];

  if (String(known.name || "").trim().length >= 3) {
    anonymizedText = replacePattern(
      anonymizedText,
      new RegExp(escapeRegExp(String(known.name).trim()), "gi"),
      "[MENOR]",
      "known-name",
      replacements
    );
    getNameTokens(known.name).forEach((token) => {
      anonymizedText = replacePattern(
        anonymizedText,
        new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(token)}(?=$|[^\\p{L}\\p{N}])`, "giu"),
        (_match, prefix) => `${prefix}[MENOR]`,
        "known-name-token",
        replacements
      );
    });
  }
  const nhExpression = flexibleIdentifierExpression(known.nh);
  if (nhExpression) {
    anonymizedText = replacePattern(
      anonymizedText,
      nhExpression,
      "[NH]",
      "known-nh",
      replacements
    );
  }
  if (String(known.birthDate || "").trim().length >= 6) {
    anonymizedText = replacePattern(
      anonymizedText,
      new RegExp(escapeRegExp(String(known.birthDate).trim()), "gi"),
      "[FECHA_NACIMIENTO]",
      "known-birth-date",
      replacements
    );
  }

  const automaticPatterns = [
    [/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, "[CORREO]", "email"],
    [/\b(?:\d{8}[a-z]|[xyz]\d{7}[a-z])\b/gi, "[DOCUMENTO_IDENTIDAD]", "dni-nie"],
    [/(?:\+34[\s.-]*)?(?:[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3})\b/g, "[TELÉFONO]", "phone"],
    [
      /(^|\n)(\s*(?:nombre(?:\s+y\s+apellidos)?|apellidos|domicilio|direcci[oó]n|centro escolar|colegio|nombre (?:de la madre|del padre|del tutor)|profesional de referencia)\s*:\s*)[^\n]+/gi,
      (_match, lineStart, label) => `${lineStart}${label}[ELIMINADO]`,
      "sensitive-labelled-value"
    ]
  ];
  automaticPatterns.forEach(([expression, replacement, type]) => {
    anonymizedText = replacePattern(
      anonymizedText,
      expression,
      replacement,
      type,
      replacements
    );
  });

  return { text: anonymizedText, replacements };
}

export function validateAnonymizedText(text, known = {}) {
  const findings = scanTextForIdentifiers({ text, known }).filter((finding) => finding.blocking);
  const normalizedText = normalizeForPrivacyScan(text);
  getNameTokens(known.name).forEach((token) => {
    const normalizedToken = normalizeForPrivacyScan(token);
    const expression = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(normalizedToken)}(?:$|[^a-z0-9])`);
    if (expression.test(normalizedText)) {
      findings.push({
        type: "known-name-token",
        label: "Parte del nombre del paciente",
        value: token,
        blocking: true
      });
    }
  });
  return findings;
}

function loadFflate() {
  if (window.fflate) return Promise.resolve(window.fflate);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${FFLATE_URL}"]`);
    const script = existing || document.createElement("script");
    script.addEventListener("load", () => resolve(window.fflate), { once: true });
    script.addEventListener("error", () => reject(new Error("No se pudo cargar el lector DOCX")), {
      once: true
    });
    if (!existing) {
      script.src = FFLATE_URL;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });
}

export async function extractDocxTextLocally(file) {
  const { unzipSync, strFromU8 } = await loadFflate();
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter(entry) {
      const selected = /^word\/(?:document|header\d+|footer\d+)\.xml$/i.test(entry.name);
      if (selected && entry.originalSize > MAX_DOCX_XML_BYTES) {
        throw new Error("El contenido de texto del Word es demasiado grande");
      }
      return selected;
    }
  });
  if (!archive["word/document.xml"]) throw new Error("El archivo no contiene un documento Word válido");

  const paths = Object.keys(archive).sort((first, second) => {
    if (first === "word/document.xml") return -1;
    if (second === "word/document.xml") return 1;
    return first.localeCompare(second);
  });
  const totalXmlBytes = paths.reduce((total, path) => total + archive[path].byteLength, 0);
  if (totalXmlBytes > MAX_DOCX_XML_BYTES) {
    throw new Error("El contenido de texto del Word es demasiado grande");
  }
  const text = paths
    .map((path) => extractTextFromWordXml(strFromU8(archive[path])))
    .filter(Boolean)
    .join("\n\n");
  if (!text.trim()) throw new Error("No se ha encontrado texto visible en el documento Word");
  if (text.length > MAX_EXTRACTED_TEXT_LENGTH) {
    throw new Error("El texto del documento Word es demasiado largo");
  }
  return text;
}
