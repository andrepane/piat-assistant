const PDFJS_VERSION = "5.5.207";
const PDFJS_MODULE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export function normalizeForPrivacyScan(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function addFinding(findings, finding) {
  if (!findings.some((current) => current.type === finding.type && current.value === finding.value)) {
    findings.push(finding);
  }
}

function findKnownValue(text, value, label, type) {
  const normalizedValue = normalizeForPrivacyScan(value);
  if (normalizedValue.length < 2 || !text.includes(normalizedValue)) return null;
  return { type, label, value: String(value), blocking: true };
}

function findKnownNh(text, value) {
  const compact = normalizeForPrivacyScan(value).replace(/[^a-z0-9]/g, "");
  if (compact.length < 3) return null;
  const flexibleValue = [...compact].join("[\\s./-]*");
  const expression = new RegExp(`(?:^|[^a-z0-9])${flexibleValue}(?:$|[^a-z0-9])`, "i");
  return expression.test(text)
    ? { type: "known-nh", label: "NH del paciente", value: String(value), blocking: true }
    : null;
}

export function scanTextForIdentifiers({ text, fileName = "", known = {} }) {
  const normalizedText = normalizeForPrivacyScan(`${fileName}\n${text}`);
  const findings = [];

  const knownValues = [
    [known.name, "Nombre del paciente", "known-name"],
    [known.birthDate, "Fecha de nacimiento", "known-birth-date"]
  ];
  knownValues.forEach(([value, label, type]) => {
    const finding = findKnownValue(normalizedText, value, label, type);
    if (finding) addFinding(findings, finding);
  });
  const nhFinding = findKnownNh(normalizedText, known.nh);
  if (nhFinding) addFinding(findings, nhFinding);

  const patternChecks = [
    {
      type: "email",
      label: "Posible correo electrónico",
      expression: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi
    },
    {
      type: "dni-nie",
      label: "Posible DNI o NIE",
      expression: /\b(?:\d{8}[a-z]|[xyz]\d{7}[a-z])\b/gi
    },
    {
      type: "phone",
      label: "Posible teléfono",
      expression: /(?:\+34[\s.-]*)?(?:[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3})\b/g
    }
  ];
  patternChecks.forEach(({ type, label, expression }) => {
    for (const match of normalizedText.matchAll(expression)) {
      addFinding(findings, { type, label, value: match[0], blocking: true });
    }
  });

  const labels = [
    ["nombre:", "Aparece un campo de nombre"],
    ["apellidos:", "Aparece un campo de apellidos"],
    ["domicilio:", "Aparece un campo de domicilio"],
    ["direccion:", "Aparece un campo de dirección"],
    ["centro escolar:", "Aparece un centro escolar"],
    ["colegio:", "Aparece un colegio"]
  ];
  labels.forEach(([needle, label]) => {
    if (normalizedText.includes(needle)) {
      addFinding(findings, { type: `label-${needle}`, label, value: needle, blocking: false });
    }
  });

  return findings;
}

export async function extractPdfTextLocally(file) {
  const pdfjs = await import(PDFJS_MODULE_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str || "").join(" "));
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return pages.join("\n");
}

export async function inspectPdfPrivacy(file, known = {}) {
  try {
    const text = await extractPdfTextLocally(file);
    const textLength = normalizeForPrivacyScan(text).length;
    return {
      status: textLength < 30 ? "unreadable" : "inspected",
      textLength,
      findings: scanTextForIdentifiers({ text, fileName: file.name, known })
    };
  } catch (error) {
    console.warn("No se pudo inspeccionar el PDF localmente:", error.message);
    return { status: "error", textLength: 0, findings: [] };
  }
}
