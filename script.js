import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  serverTimestamp,
  query,
  where,
  getDoc,
  getDocs,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  SCHEMA_VERSION,
  PATIENT_STATUS,
  ANALYSIS_STATUS,
  DOCUMENT_STATUS,
  CLINICAL_SECTION_ORDER,
  CLINICAL_FIELD_ORDER,
  normalizeText,
  normalizeMedicalRecordNumber,
  createPatientDocumentId,
  hasPdfSignature,
  humanizeKey,
  isMissingValue,
  valuesAreEqual,
  coerceEditedValue,
  formatTimestamp,
  getPatientStatus,
  getPatientName,
  getPatientNH,
  getPatientAge,
  getPatientClinicalRecord,
  sortByNewest,
  applyClinicalRecordEdits,
  applyClinicalComparison,
  buildClinicalComparison,
  orderedEntries
} from "./src/patient-model.js";
import { inspectPdfPrivacy } from "./src/privacy-scanner.js";

const firebaseConfig = {
  apiKey: "AIzaSyDieG_k97issVAituvN_AVWM3D8Hgq76aM",
  authDomain: "piat-assistant.firebaseapp.com",
  projectId: "piat-assistant",
  messagingSenderId: "584338030607",
  appId: "1:584338030607:web:5696ad7e815d65335b637a"
};

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

const SECTION_LABELS = {
  identificacion: "Identificación",
  diagnostico: "Diagnóstico",
  salud: "Salud",
  escolarizacion: "Escolarización",
  desarrollo_y_contexto: "Desarrollo y contexto",
  familia: "Familia",
  apoyo_profesional: "Apoyo profesional",
  evaluaciones: "Evaluaciones",
  objetivos: "Objetivos",
  informacion_adicional: "Información adicional"
};

const LONG_FIELDS = new Set([
  "informacion_medica",
  "antecedentes_personales",
  "antecedentes_familiares",
  "otros_datos_salud",
  "estado_fisico_general",
  "aspectos_emocionales_menor",
  "aspectos_emocionales_cuidadores",
  "entorno_familiar",
  "conducta",
  "sociabilidad",
  "preocupaciones_actuales",
  "prioridades",
  "interpretacion"
]);

const DOCUMENT_TYPE_LABELS = {
  piat_inicial: "PIAT inicial",
  piat_revision: "PIAT de revisión",
  evaluacion: "Evaluación o prueba",
  informe_clinico: "Informe clínico",
  informe_escolar: "Informe escolar",
  otro: "Otro documento"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginView = document.getElementById("loginView");
const appHeader = document.getElementById("appHeader");
const appMain = document.getElementById("appMain");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginStatus = document.getElementById("loginStatus");
const patientsView = document.getElementById("patientsView");
const patientDetailView = document.getElementById("patientDetailView");
const newPatientView = document.getElementById("newPatientView");
const reviewPatientView = document.getElementById("reviewPatientView");
const comparisonPatientView = document.getElementById("comparisonPatientView");
const reviewFields = document.getElementById("reviewFields");
const backToNewPatientButton = document.getElementById("backToNewPatientButton");
const saveReviewedPatientButton = document.getElementById("saveReviewedPatientButton");
const clinicalComparisonList = document.getElementById("clinicalComparisonList");
const backToExtractionReviewButton = document.getElementById("backToExtractionReviewButton");
const saveClinicalComparisonButton = document.getElementById("saveClinicalComparisonButton");
const newPatientButton = document.getElementById("newPatientButton");
const cancelPatientButton = document.getElementById("cancelPatientButton");
const analyzePatientButton = document.getElementById("analyzePatientButton");
const patientName = document.getElementById("patientName");
const patientNH = document.getElementById("patientNH");
const newPatientDocumentType = document.getElementById("newPatientDocumentType");
const patientDocuments = document.getElementById("patientDocuments");
const selectedDocuments = document.getElementById("selectedDocuments");
const patientsEmpty = document.getElementById("patientsEmpty");
const patientsList = document.getElementById("patientsList");
const backToPatientsButton = document.getElementById("backToPatientsButton");
const patientDetailTitle = document.getElementById("patientDetailTitle");
const patientDetailStatus = document.getElementById("patientDetailStatus");
const patientDetailContent = document.getElementById("patientDetailContent");
const patientDetailHeader = document.getElementById("patientDetailHeader");
const patientClinicalRecord = document.getElementById("patientClinicalRecord");
const patientAnalysisHistory = document.getElementById("patientAnalysisHistory");
const patientClinicalRecordHelp = document.getElementById("patientClinicalRecordHelp");
const editPatientRecordButton = document.getElementById("editPatientRecordButton");
const patientRecordEditActions = document.getElementById("patientRecordEditActions");
const cancelPatientRecordEditButton = document.getElementById("cancelPatientRecordEditButton");
const savePatientRecordButton = document.getElementById("savePatientRecordButton");
const showDocumentUploadButton = document.getElementById("showDocumentUploadButton");
const patientDocumentUploadForm = document.getElementById("patientDocumentUploadForm");
const patientDocumentType = document.getElementById("patientDocumentType");
const patientDocumentDate = document.getElementById("patientDocumentDate");
const existingPatientDocument = document.getElementById("existingPatientDocument");
const cancelDocumentUploadButton = document.getElementById("cancelDocumentUploadButton");
const uploadPatientDocumentButton = document.getElementById("uploadPatientDocumentButton");
const patientDocumentUploadStatus = document.getElementById("patientDocumentUploadStatus");
const patientDocumentsList = document.getElementById("patientDocumentsList");
const privacyReviewDialog = document.getElementById("privacyReviewDialog");
const privacyFileName = document.getElementById("privacyFileName");
const privacyConfirmationCheckbox = document.getElementById("privacyConfirmationCheckbox");
const cancelPrivacyReviewButton = document.getElementById("cancelPrivacyReviewButton");
const confirmPrivacyReviewButton = document.getElementById("confirmPrivacyReviewButton");
const privacyScanResult = document.getElementById("privacyScanResult");
const privacyScanStatus = document.getElementById("privacyScanStatus");
const privacyScanFindings = document.getElementById("privacyScanFindings");

let currentAnalysisSession = null;
let currentPatientId = null;
let currentPatientData = null;
let resolvePrivacyReview = null;
let currentPrivacyScan = null;

function isExtractedField(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, "valor")
  );
}

function getAtPath(target, path) {
  return path.reduce((current, segment) => current?.[segment], target);
}

function setAtPath(target, path, value) {
  const parent = getAtPath(target, path.slice(0, -1));
  if (parent !== null && parent !== undefined) parent[path.at(-1)] = value;
}

function setVisibleView(view) {
  patientsView.hidden = view !== patientsView;
  patientDetailView.hidden = view !== patientDetailView;
  newPatientView.hidden = view !== newPatientView;
  reviewPatientView.hidden = view !== reviewPatientView;
  comparisonPatientView.hidden = view !== comparisonPatientView;
}

async function showPatientsView() {
  setVisibleView(patientsView);
  await loadPatients();
}

function showNewPatientView() {
  setVisibleView(newPatientView);
}

function showReviewPatientView() {
  setVisibleView(reviewPatientView);
}

function resetPatientForm() {
  patientName.value = "";
  patientNH.value = "";
  patientDocuments.value = "";
  newPatientDocumentType.value = "piat_inicial";
  selectedDocuments.innerHTML = "";
  reviewFields.innerHTML = "";
  currentAnalysisSession = null;
}

function renderPatientCard(documentSnapshot) {
  const patient = documentSnapshot.data();
  const card = document.createElement("article");
  card.className = "patient-card";
  card.dataset.patientId = documentSnapshot.id;

  const name = document.createElement("h3");
  name.textContent = getPatientName(patient);
  const details = document.createElement("div");
  details.className = "patient-card-details";
  const nh = document.createElement("p");
  nh.textContent = getPatientNH(patient) ? `NH: ${getPatientNH(patient)}` : "NH no indicado";
  const age = document.createElement("p");
  age.textContent = getPatientAge(patient) ? `Edad: ${getPatientAge(patient)}` : "Edad no indicada";
  const status = document.createElement("p");
  status.textContent = `Estado: ${humanizeKey(getPatientStatus(patient))}`;
  const updatedAt = document.createElement("p");
  updatedAt.textContent = `Actualizado: ${formatTimestamp(
    patient.ultimaActualizacion || patient.metadatos?.ultimaActualizacion
  )}`;
  const actions = document.createElement("div");
  actions.className = "patient-card-actions";
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.textContent = "Abrir ficha";
  openButton.setAttribute("aria-label", `Abrir ficha de ${getPatientName(patient)}`);
  openButton.addEventListener("click", () => openPatientDetail(documentSnapshot.id));

  details.append(nh, age, status, updatedAt);
  actions.appendChild(openButton);
  card.append(name, details, actions);
  return card;
}

async function loadPatients() {
  const user = auth.currentUser;
  patientsList.innerHTML = "";
  if (!user) {
    patientsEmpty.hidden = false;
    return;
  }

  try {
    const patientsQuery = query(
      collection(db, "patients"),
      where("userId", "==", user.uid)
    );
    const snapshot = await getDocs(patientsQuery);
    const patients = [...snapshot.docs].sort((a, b) => {
      const aDate = a.data().ultimaActualizacion?.toMillis?.() || 0;
      const bDate = b.data().ultimaActualizacion?.toMillis?.() || 0;
      return bDate - aDate;
    });

    patientsEmpty.hidden = patients.length > 0;
    patients.forEach((patientDocument) => {
      patientsList.appendChild(renderPatientCard(patientDocument));
    });
  } catch (error) {
    console.error("Error cargando pacientes:", error);
    patientsEmpty.hidden = false;
    patientsEmpty.querySelector("h3").textContent = "No se han podido cargar los pacientes";
    patientsEmpty.querySelector("p").textContent = "Comprueba la conexión e inténtalo de nuevo.";
  }
}

function formatDisplayValue(value) {
  if (isMissingValue(value)) return "No registrado";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) {
    return value.every((item) => item === null || typeof item !== "object")
      ? value.join(", ")
      : JSON.stringify(value);
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Tamaño no disponible";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createReadOnlyField(key, field) {
  const wrapper = document.createElement("div");
  wrapper.className = "clinical-field";
  const label = document.createElement("dt");
  label.textContent = humanizeKey(key);
  const value = document.createElement("dd");
  value.textContent = formatDisplayValue(field.valor);

  if (isMissingValue(field.valor)) value.classList.add("clinical-value-empty");

  const meta = document.createElement("small");
  meta.className = "clinical-field-meta";
  if (field.revisadoManualmente || field.procedenciaValor === "manual") {
    meta.textContent = "Valor corregido manualmente";
  } else if (field.confianzaExtraccion || field.confianza) {
    meta.textContent = `Extracción Gemini · confianza ${
      field.confianzaExtraccion || field.confianza
    }`;
  } else {
    meta.textContent = "Origen no registrado";
  }

  wrapper.append(label, value, meta);
  return wrapper;
}

function renderReadOnlyNode(container, key, value) {
  if (isExtractedField(value)) {
    container.appendChild(createReadOnlyField(key, value));
    return;
  }

  if (Array.isArray(value)) {
    const group = document.createElement("section");
    group.className = "clinical-group";
    const heading = document.createElement("h4");
    heading.textContent = humanizeKey(key);
    group.appendChild(heading);

    if (value.length === 0) {
      const empty = document.createElement("p");
      empty.className = "clinical-value-empty";
      empty.textContent = "Sin datos registrados";
      group.appendChild(empty);
    } else if (value.every((item) => item === null || typeof item !== "object")) {
      const list = document.createElement("ul");
      list.className = "clinical-list";
      value.forEach((item) => {
        const listItem = document.createElement("li");
        listItem.textContent = formatDisplayValue(item);
        list.appendChild(listItem);
      });
      group.appendChild(list);
    } else {
      value.forEach((item, index) => {
        renderReadOnlyNode(group, `Elemento ${index + 1}`, item);
      });
    }

    container.appendChild(group);
    return;
  }

  if (value && typeof value === "object") {
    const group = document.createElement("section");
    group.className = "clinical-group";
    const heading = document.createElement("h4");
    heading.textContent = humanizeKey(key);
    group.appendChild(heading);
    orderedEntries(value).forEach(([childKey, childValue]) => {
      renderReadOnlyNode(group, childKey, childValue);
    });
    container.appendChild(group);
    return;
  }

  container.appendChild(
    createReadOnlyField(key, {
      valor: value,
      confianza: null,
      procedenciaValor: null
    })
  );
}

function renderPatientClinicalRecord(patient) {
  patientClinicalRecord.innerHTML = "";
  const clinicalRecord = getPatientClinicalRecord(patient);

  if (!clinicalRecord || Object.keys(clinicalRecord).length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-detail-message";
    empty.textContent = "Este paciente todavía no tiene una ficha clínica consolidada.";
    patientClinicalRecord.appendChild(empty);
    return;
  }

  orderedEntries(clinicalRecord, CLINICAL_SECTION_ORDER).forEach(([sectionKey, sectionValue]) => {
    const section = document.createElement("section");
    section.className = "clinical-section";
    const heading = document.createElement("h4");
    heading.textContent = SECTION_LABELS[sectionKey] || humanizeKey(sectionKey);
    section.appendChild(heading);

    if (sectionValue && typeof sectionValue === "object" && !Array.isArray(sectionValue)) {
      orderedEntries(sectionValue, CLINICAL_FIELD_ORDER[sectionKey] || []).forEach(([key, value]) => {
        renderReadOnlyNode(section, key, value);
      });
    } else {
      renderReadOnlyNode(section, sectionKey, sectionValue);
    }
    patientClinicalRecord.appendChild(section);
  });
}

function createClinicalEditField(key, value, path, isExtracted = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "clinical-edit-field";
  const label = document.createElement("label");
  const inputValue = isExtracted ? value.valor : value;
  const input = document.createElement(
    LONG_FIELDS.has(String(key)) || String(inputValue ?? "").length > 100 ? "textarea" : "input"
  );
  const inputId = `clinical-edit-${path.join("-")}`;
  label.textContent = humanizeKey(key);
  label.htmlFor = inputId;
  input.id = inputId;
  input.value = isMissingValue(inputValue) ? "" : String(inputValue);
  input.dataset.editPath = JSON.stringify(path);
  if (input.tagName === "INPUT") input.type = "text";

  wrapper.append(label, input);
  if (isExtracted) {
    const meta = document.createElement("small");
    meta.textContent = value.evidencia
      ? `Evidencia original: “${value.evidencia}”`
      : "Sin evidencia original registrada";
    wrapper.appendChild(meta);
  }
  return wrapper;
}

function renderClinicalEditNode(container, key, value, path) {
  if (isExtractedField(value)) {
    container.appendChild(createClinicalEditField(key, value, path, true));
    return;
  }

  if (value && typeof value === "object") {
    const group = document.createElement("section");
    group.className = "clinical-group clinical-edit-group";
    const heading = document.createElement("h4");
    heading.textContent = humanizeKey(key);
    group.appendChild(heading);
    orderedEntries(value).forEach(([childKey, childValue]) => {
      renderClinicalEditNode(group, childKey, childValue, [...path, childKey]);
    });
    container.appendChild(group);
    return;
  }

  container.appendChild(createClinicalEditField(key, value, path));
}

function renderPatientClinicalRecordEditor(patient) {
  patientClinicalRecord.innerHTML = "";
  const clinicalRecord = getPatientClinicalRecord(patient);
  if (!clinicalRecord) return;

  orderedEntries(clinicalRecord, CLINICAL_SECTION_ORDER).forEach(([sectionKey, sectionValue]) => {
    const section = document.createElement("section");
    section.className = "clinical-section clinical-edit-section";
    const heading = document.createElement("h4");
    heading.textContent = SECTION_LABELS[sectionKey] || humanizeKey(sectionKey);
    section.appendChild(heading);

    if (sectionValue && typeof sectionValue === "object") {
      orderedEntries(sectionValue, CLINICAL_FIELD_ORDER[sectionKey] || []).forEach(([key, value]) => {
        renderClinicalEditNode(section, key, value, [sectionKey, key]);
      });
    } else {
      renderClinicalEditNode(section, sectionKey, sectionValue, [sectionKey]);
    }
    patientClinicalRecord.appendChild(section);
  });
}

function setPatientRecordEditing(editing) {
  const hasClinicalRecord = Boolean(getPatientClinicalRecord(currentPatientData || {}));
  editPatientRecordButton.disabled = !hasClinicalRecord;
  editPatientRecordButton.hidden = editing;
  patientRecordEditActions.hidden = !editing;
  patientClinicalRecordHelp.textContent = editing
    ? "Modifica solo lo necesario. Se guardará un registro de los campos cambiados."
    : "Consulta los datos consolidados del paciente.";

  if (!currentPatientData) return;
  if (editing) renderPatientClinicalRecordEditor(currentPatientData);
  else renderPatientClinicalRecord(currentPatientData);
}

function createProfileItem(labelText, valueText) {
  const item = document.createElement("div");
  const label = document.createElement("dt");
  const value = document.createElement("dd");
  label.textContent = labelText;
  value.textContent = valueText;
  item.append(label, value);
  return item;
}

function renderPatientDetailHeader(patient) {
  patientDetailHeader.innerHTML = "";
  patientDetailTitle.textContent = getPatientName(patient);

  const heading = document.createElement("div");
  heading.className = "patient-profile-title";
  const name = document.createElement("h3");
  name.textContent = getPatientName(patient);
  const status = document.createElement("span");
  status.className = "status-badge";
  status.textContent = humanizeKey(getPatientStatus(patient));
  heading.append(name, status);

  const details = document.createElement("dl");
  details.className = "patient-profile-details";
  details.append(
    createProfileItem("NH", getPatientNH(patient) || "No indicado"),
    createProfileItem("Edad", getPatientAge(patient) || "No indicada"),
    createProfileItem(
      "Última actualización",
      formatTimestamp(patient.ultimaActualizacion || patient.metadatos?.ultimaActualizacion)
    ),
    createProfileItem("Versión de ficha", String(patient.schemaVersion || 1))
  );

  patientDetailHeader.append(heading, details);
}

function resetDocumentUploadForm() {
  patientDocumentUploadForm.reset();
  patientDocumentUploadForm.hidden = true;
  showDocumentUploadButton.hidden = false;
  patientDocumentUploadStatus.textContent = "";
}

function formatDocumentDate(value) {
  if (!value) return "Sin fecha indicada";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : formatTimestamp(value);
}

function renderPatientDocuments(documentSnapshots) {
  patientDocumentsList.innerHTML = "";
  if (documentSnapshots.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-detail-message";
    empty.textContent = "Todavía no hay documentos analizados para este paciente.";
    patientDocumentsList.appendChild(empty);
    return;
  }

  const documents = sortByNewest(
    documentSnapshots.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
    (documentData) => documentData.fechaCreacion
  );

  documents.forEach((documentData) => {
    const card = document.createElement("article");
    card.className = "patient-document-card";
    const heading = document.createElement("div");
    heading.className = "analysis-history-heading";
    const title = document.createElement("h4");
    title.textContent = documentData.nombreOriginal || "Documento sin nombre";
    const status = document.createElement("span");
    status.className = "status-badge status-badge-secondary";
    status.textContent = humanizeKey(documentData.estado || "sin estado");
    heading.append(title, status);

    const details = document.createElement("dl");
    details.className = "analysis-history-details";
    details.append(
      createProfileItem(
        "Tipo",
        DOCUMENT_TYPE_LABELS[documentData.tipo] ||
          (documentData.tipo ? humanizeKey(documentData.tipo) : "No indicado")
      ),
      createProfileItem("Fecha del documento", formatDocumentDate(documentData.fechaDocumento)),
      createProfileItem("Tamaño", formatFileSize(documentData.tamano))
    );

    const note = document.createElement("p");
    note.className = "analysis-storage-notice";
    note.textContent = documentData.estado === DOCUMENT_STATUS.ERROR
      ? "El análisis no se completó."
      : "Se conserva la información extraída; el PDF original no está almacenado.";
    card.append(heading, details, note);
    patientDocumentsList.appendChild(card);
  });
}

function renderAnalysisHistory(analysisDocuments, revisionDocuments = []) {
  patientAnalysisHistory.innerHTML = "";

  if (analysisDocuments.length === 0 && revisionDocuments.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-detail-message";
    empty.textContent = "No hay análisis guardados para este paciente.";
    patientAnalysisHistory.appendChild(empty);
    return;
  }

  const analyses = sortByNewest(
    [
      ...analysisDocuments.map((analysisDocument) => ({
      id: analysisDocument.id,
      ...analysisDocument.data()
      })),
      ...revisionDocuments.map((revisionDocument) => ({
        id: revisionDocument.id,
        ...revisionDocument.data()
      }))
    ],
    (analysis) => analysis.fechaCreacion || analysis.fechaAnalisisCliente
  );

  analyses.forEach((analysis) => {
    const card = document.createElement("article");
    card.className = "analysis-history-card";
    const heading = document.createElement("div");
    heading.className = "analysis-history-heading";
    const title = document.createElement("h4");
    const isManualRevision = analysis.tipoEvento === "revision_manual";
    const isDocumentIncorporation = analysis.tipoEvento === "incorporacion_documento";
    const isRecordRevision = isManualRevision || isDocumentIncorporation;
    title.textContent = isManualRevision
      ? "Edición manual de la ficha"
      : isDocumentIncorporation
        ? "Datos incorporados desde un documento"
        : analysis.documentoFuente?.name || "Documento sin nombre";
    const status = document.createElement("span");
    status.className = "status-badge status-badge-secondary";
    status.textContent = humanizeKey(analysis.estado || "sin estado");
    heading.append(title, status);

    const details = document.createElement("dl");
    details.className = "analysis-history-details";
    details.append(
      createProfileItem(
        "Fecha",
        formatTimestamp(analysis.fechaCreacion || analysis.fechaAnalisisCliente)
      ),
      createProfileItem(
        isRecordRevision ? "Tipo" : "Tamaño",
        isManualRevision
          ? "Revisión humana"
          : isDocumentIncorporation
            ? "Actualización longitudinal"
            : formatFileSize(analysis.documentoFuente?.size)
      ),
      createProfileItem(
        "Campos modificados",
        String(analysis.revisionHumana?.modifiedFieldCount ?? analysis.camposModificados?.length ?? 0)
      )
    );

    const storageNotice = document.createElement("p");
    storageNotice.className = "analysis-storage-notice";
    storageNotice.textContent = isRecordRevision
      ? `Cambios: ${analysis.camposModificados?.map(humanizeKey).join(", ") || "sin detalle"}.`
      : analysis.documentId
        ? "Análisis vinculado al registro documental; el PDF original no se conserva."
        : "Análisis antiguo sin registro documental asociado.";
    card.append(heading, details, storageNotice);
    patientAnalysisHistory.appendChild(card);
  });
}

async function openPatientDetail(patientId) {
  const user = auth.currentUser;
  if (!user) return;

  currentPatientId = patientId;
  setVisibleView(patientDetailView);
  patientDetailTitle.textContent = "Ficha del paciente";
  patientDetailStatus.hidden = false;
  patientDetailStatus.textContent = "Cargando ficha...";
  patientDetailContent.hidden = true;

  try {
    const patientRef = doc(db, "patients", patientId);
    const [patientSnapshot, analysesSnapshot, documentsSnapshot, revisionsSnapshot] = await Promise.all([
      getDoc(patientRef),
      getDocs(collection(patientRef, "analyses")),
      getDocs(collection(patientRef, "documents")),
      getDocs(collection(patientRef, "revisions"))
    ]);

    if (currentPatientId !== patientId) return;
    if (!patientSnapshot.exists()) {
      throw new Error("El paciente ya no existe o no está disponible.");
    }

    const patient = patientSnapshot.data();
    if (patient.userId !== user.uid) {
      throw new Error("No tienes acceso a este paciente.");
    }

    currentPatientData = patient;
    renderPatientDetailHeader(patient);
    renderPatientClinicalRecord(patient);
    renderPatientDocuments(documentsSnapshot.docs);
    renderAnalysisHistory(analysesSnapshot.docs, revisionsSnapshot.docs);
    resetDocumentUploadForm();
    setPatientRecordEditing(false);
    patientDetailStatus.hidden = true;
    patientDetailContent.hidden = false;
  } catch (error) {
    console.error("Error cargando la ficha del paciente:", error);
    if (currentPatientId !== patientId) return;
    patientDetailStatus.hidden = false;
    patientDetailStatus.textContent = error.message || "No se ha podido cargar la ficha.";
    patientDetailContent.hidden = true;
  }
}

function createConfidenceMeta(field) {
  const meta = document.createElement("small");
  const label = document.createElement("strong");
  const evidence = document.createElement("span");
  const confidence = field.confianza || "desconocida";

  if (isMissingValue(field.valor)) label.textContent = "No encontrado";
  else if (confidence === "baja") label.textContent = "Dato dudoso";
  else if (confidence === "media") label.textContent = "Revisar dato";
  else label.textContent = "Dato encontrado";

  meta.appendChild(label);
  if (field.evidencia) {
    evidence.className = "evidence";
    evidence.textContent = `Evidencia: “${field.evidencia}”`;
    meta.appendChild(evidence);
  }
  return meta;
}

function createReviewInput(key, value, path, inputKind) {
  const useTextarea =
    LONG_FIELDS.has(String(key)) || (typeof value === "string" && value.length > 90);
  const input = document.createElement(useTextarea ? "textarea" : "input");
  if (input.tagName === "INPUT") input.type = "text";
  input.value = value ?? "";
  input.dataset.path = JSON.stringify(path);
  input.dataset.inputKind = inputKind;
  return input;
}

function renderReviewNode(container, key, value, path) {
  if (isExtractedField(value)) {
    const wrapper = document.createElement("div");
    wrapper.className = "review-field";
    if (value.confianza === "baja" && !isMissingValue(value.valor)) {
      wrapper.classList.add("low-confidence");
    }
    const label = document.createElement("label");
    label.textContent = humanizeKey(key);
    const input = createReviewInput(key, value.valor, path, "extracted-field");
    label.htmlFor = `review-${path.join("-")}`;
    input.id = label.htmlFor;
    wrapper.append(label, input, createConfidenceMeta(value));
    container.appendChild(wrapper);
    return;
  }

  if (Array.isArray(value)) {
    const group = document.createElement("section");
    group.className = "review-group";
    const heading = document.createElement("h4");
    heading.textContent = humanizeKey(key);
    group.appendChild(heading);
    if (value.length === 0) {
      const empty = document.createElement("p");
      empty.className = "review-empty";
      empty.textContent = "Sin datos extraídos";
      group.appendChild(empty);
    } else {
      value.forEach((item, index) => {
        renderReviewNode(group, `Elemento ${index + 1}`, item, [...path, index]);
      });
    }
    container.appendChild(group);
    return;
  }

  if (value && typeof value === "object") {
    const group = document.createElement("section");
    group.className = "review-group";
    const heading = document.createElement("h4");
    heading.textContent = humanizeKey(key);
    group.appendChild(heading);
    orderedEntries(value).forEach(([childKey, childValue]) => {
      renderReviewNode(group, childKey, childValue, [...path, childKey]);
    });
    container.appendChild(group);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "review-field";
  const label = document.createElement("label");
  label.textContent = humanizeKey(key);
  const input = createReviewInput(key, value, path, "plain-value");
  label.htmlFor = `review-${path.join("-")}`;
  input.id = label.htmlFor;
  wrapper.append(label, input);
  container.appendChild(wrapper);
}

function renderExtraction(extraction) {
  reviewFields.innerHTML = "";
  orderedEntries(extraction, CLINICAL_SECTION_ORDER).forEach(([sectionKey, sectionData]) => {
    const section = document.createElement("section");
    section.className = "review-section";
    const heading = document.createElement("h3");
    heading.textContent = SECTION_LABELS[sectionKey] || humanizeKey(sectionKey);
    section.appendChild(heading);

    if (sectionData && typeof sectionData === "object" && !Array.isArray(sectionData)) {
      orderedEntries(sectionData, CLINICAL_FIELD_ORDER[sectionKey] || []).forEach(([key, value]) => {
        renderReviewNode(section, key, value, [sectionKey, key]);
      });
    } else {
      renderReviewNode(section, sectionKey, sectionData, [sectionKey]);
    }
    reviewFields.appendChild(section);
  });
}

function applyHumanReview(originalExtraction, userId) {
  const reviewedExtraction = structuredClone(originalExtraction);
  const modifiedPaths = [];

  reviewFields.querySelectorAll("[data-path]").forEach((input) => {
    const path = JSON.parse(input.dataset.path);
    if (input.dataset.inputKind === "extracted-field") {
      const originalField = getAtPath(originalExtraction, path);
      const reviewedField = getAtPath(reviewedExtraction, path);
      const editedValue = coerceEditedValue(input.value, originalField.valor);
      const manuallyModified = !valuesAreEqual(originalField.valor, editedValue);

      reviewedField.valor = editedValue;
      reviewedField.valorExtraido = originalField.valor ?? null;
      reviewedField.confianzaExtraccion = originalField.confianza || null;
      reviewedField.procedenciaValor = isMissingValue(editedValue)
        ? "no_encontrado"
        : manuallyModified
          ? "manual"
          : "gemini";
      reviewedField.revisadoManualmente = manuallyModified;
      if (manuallyModified) modifiedPaths.push(path.join("."));
      return;
    }

    const originalValue = getAtPath(originalExtraction, path);
    const editedValue = coerceEditedValue(input.value, originalValue);
    setAtPath(reviewedExtraction, path, editedValue);
    if (!valuesAreEqual(originalValue, editedValue)) modifiedPaths.push(path.join("."));
  });

  return {
    reviewedExtraction,
    modifiedPaths,
    review: {
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
      modifiedFieldCount: modifiedPaths.length
    }
  };
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se ha podido leer el archivo"));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
}

async function isRealPdf(file) {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return hasPdfSignature(header);
}

async function hashFile(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function unwrapExtractedValue(value) {
  return isExtractedField(value) ? value.valor : value;
}

function getKnownPrivacyIdentifiers(patient = null) {
  const clinicalRecord = patient ? getPatientClinicalRecord(patient) : null;
  return {
    name: patient ? getPatientName(patient) : patientName.value.trim(),
    nh: patient ? getPatientNH(patient) : patientNH.value.trim(),
    birthDate: unwrapExtractedValue(clinicalRecord?.identificacion?.fecha_nacimiento) || ""
  };
}

function renderPrivacyScan(scan) {
  currentPrivacyScan = scan;
  privacyScanResult.className = `privacy-scan-result privacy-scan-${scan.status}`;
  privacyScanFindings.innerHTML = "";
  const blockingFindings = scan.findings.filter((finding) => finding.blocking);

  if (blockingFindings.length > 0) {
    privacyScanResult.classList.add("privacy-scan-blocked");
    privacyScanStatus.textContent =
      "Envío bloqueado: se han encontrado identificadores claros. Prepara otra copia anonimizada.";
  } else if (scan.status === "unreadable") {
    privacyScanStatus.textContent =
      "No se ha podido leer suficiente texto. Puede ser un PDF escaneado: revisa también sus imágenes.";
  } else if (scan.status === "error") {
    privacyScanStatus.textContent =
      "La inspección local no ha podido completarse. La revisión manual sigue siendo obligatoria.";
  } else if (scan.findings.length > 0) {
    privacyScanStatus.textContent =
      "No hay coincidencias claras, pero se han encontrado elementos que debes comprobar.";
  } else {
    privacyScanStatus.textContent =
      "La inspección local no ha encontrado identificadores evidentes. Esto no garantiza el anonimato.";
  }

  scan.findings.forEach((finding) => {
    const item = document.createElement("li");
    item.textContent = finding.blocking
      ? finding.label
      : `${finding.label}: comprueba que el contenido asociado esté anonimizado.`;
    privacyScanFindings.appendChild(item);
  });

  privacyConfirmationCheckbox.disabled = blockingFindings.length > 0;
  confirmPrivacyReviewButton.disabled = true;
}

function requestPrivacyConfirmation(file, knownIdentifiers) {
  if (resolvePrivacyReview) resolvePrivacyReview(null);
  privacyFileName.textContent = `Archivo que se enviará: ${file.name}`;
  privacyConfirmationCheckbox.checked = false;
  privacyConfirmationCheckbox.disabled = true;
  confirmPrivacyReviewButton.disabled = true;
  currentPrivacyScan = null;
  privacyScanResult.className = "privacy-scan-result privacy-scan-loading";
  privacyScanStatus.textContent = "Inspeccionando el texto del PDF localmente...";
  privacyScanFindings.innerHTML = "";
  privacyReviewDialog.showModal();

  const confirmation = new Promise((resolve) => {
    resolvePrivacyReview = resolve;
  });
  inspectPdfPrivacy(file, knownIdentifiers).then((scan) => {
    if (resolvePrivacyReview) renderPrivacyScan(scan);
  });
  return confirmation;
}

function closePrivacyReview(confirmation = null) {
  const resolve = resolvePrivacyReview;
  resolvePrivacyReview = null;
  privacyReviewDialog.close();
  if (resolve) resolve(confirmation);
}

privacyConfirmationCheckbox.addEventListener("change", () => {
  const blocked = currentPrivacyScan?.findings.some((finding) => finding.blocking);
  confirmPrivacyReviewButton.disabled = !privacyConfirmationCheckbox.checked || blocked;
});

cancelPrivacyReviewButton.addEventListener("click", () => closePrivacyReview());

confirmPrivacyReviewButton.addEventListener("click", () => {
  if (!privacyConfirmationCheckbox.checked) return;
  closePrivacyReview({
    confirmed: true,
    confirmedAt: new Date().toISOString(),
    checklistVersion: 1,
    localScan: {
      status: currentPrivacyScan?.status || "unknown",
      findingTypes: currentPrivacyScan?.findings.map((finding) => finding.type) || []
    }
  });
});

privacyReviewDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePrivacyReview();
});

async function analyzeDocumentFile(file, user, privacyReview) {
  if (!privacyReview?.confirmed) {
    throw new Error("Debes confirmar que el PDF está anonimizado antes de enviarlo.");
  }
  const [fileBase64, idToken, sha256] = await Promise.all([
    readFileAsBase64(file),
    user.getIdToken(),
    hashFile(file)
  ]);
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      fileBase64,
      mimeType: file.type,
      privacyConfirmed: true
    })
  });
  const responseText = await response.text();
  let extraction;
  try {
    extraction = JSON.parse(responseText);
  } catch {
    throw new Error("El servidor devolvió una respuesta no válida.");
  }
  if (!response.ok) {
    throw new Error(extraction.error || "No se ha podido analizar el documento.");
  }

  return {
    extraction,
    sourceDocument: {
      name: file.name,
      mimeType: file.type,
      size: file.size,
      lastModified: file.lastModified || null,
      sha256
    },
    analyzedAt: new Date().toISOString(),
    privacyReview
  };
}

async function findPossibleDuplicate(user, name, nh) {
  const patientsQuery = query(
    collection(db, "patients"),
    where("userId", "==", user.uid)
  );
  const snapshot = await getDocs(patientsQuery);
  const normalizedNH = normalizeMedicalRecordNumber(nh);
  const normalizedName = normalizeText(name);

  for (const patientDocument of snapshot.docs) {
    const patient = patientDocument.data();
    const existingNH = normalizeMedicalRecordNumber(patient.nhNormalizado || getPatientNH(patient));
    const existingName = normalizeText(patient.nombreNormalizado || getPatientName(patient));
    if (normalizedNH && existingNH === normalizedNH) {
      return { type: "nh", patientId: patientDocument.id, patient };
    }
    if (!normalizedNH && normalizedName && existingName === normalizedName) {
      return { type: "name", patientId: patientDocument.id, patient };
    }
  }
  return null;
}

loginButton.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  loginStatus.textContent = "";
  if (!email || !password) {
    loginStatus.textContent = "Introduce correo y contraseña.";
    return;
  }
  try {
    loginButton.disabled = true;
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);
    loginStatus.textContent = "No se ha podido iniciar sesión.";
  } finally {
    loginButton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginView.hidden = true;
    appHeader.hidden = false;
    appMain.hidden = false;
    await showPatientsView();
    return;
  }
  loginView.hidden = false;
  appHeader.hidden = true;
  appMain.hidden = true;
  currentPatientId = null;
  currentPatientData = null;
  setVisibleView(patientsView);
  resetPatientForm();
});

backToPatientsButton.addEventListener("click", async () => {
  currentPatientId = null;
  currentPatientData = null;
  resetDocumentUploadForm();
  await showPatientsView();
});

showDocumentUploadButton.addEventListener("click", () => {
  showDocumentUploadButton.hidden = true;
  patientDocumentUploadForm.hidden = false;
  patientDocumentUploadStatus.textContent = "";
});

cancelDocumentUploadButton.addEventListener("click", () => {
  resetDocumentUploadForm();
});

patientDocumentUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = auth.currentUser;
  const patientId = currentPatientId;
  const file = existingPatientDocument.files?.[0];
  if (!user || !patientId) return;
  if (!file) {
    patientDocumentUploadStatus.textContent = "Selecciona un archivo PDF.";
    return;
  }
  if (file.type !== "application/pdf") {
    patientDocumentUploadStatus.textContent = "Solo se admiten archivos PDF.";
    return;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    patientDocumentUploadStatus.textContent = "El PDF supera el límite de 8 MB.";
    return;
  }
  if (!(await isRealPdf(file))) {
    patientDocumentUploadStatus.textContent = "El archivo seleccionado no contiene un PDF válido.";
    return;
  }

  const privacyReview = await requestPrivacyConfirmation(
    file,
    getKnownPrivacyIdentifiers(currentPatientData)
  );
  if (!privacyReview) {
    patientDocumentUploadStatus.textContent = "Envío cancelado. El PDF no ha salido del dispositivo.";
    return;
  }

  try {
    uploadPatientDocumentButton.disabled = true;
    uploadPatientDocumentButton.textContent = "Analizando...";
    patientDocumentUploadStatus.textContent = "Analizando el PDF temporalmente...";
    currentAnalysisSession = {
      ...(await analyzeDocumentFile(file, user, privacyReview)),
      targetPatientId: patientId,
      documentType: patientDocumentType.value,
      documentDate: patientDocumentDate.value || null
    };
    existingPatientDocument.value = "";
    renderExtraction(currentAnalysisSession.extraction);
    saveReviewedPatientButton.textContent = "Guardar análisis";
    showReviewPatientView();
  } catch (error) {
    console.error("Error analizando el documento:", error);
    patientDocumentUploadStatus.textContent =
      error.message || "No se ha podido analizar el documento.";
  } finally {
    uploadPatientDocumentButton.disabled = false;
    uploadPatientDocumentButton.textContent = "Analizar documento";
  }
});

editPatientRecordButton.addEventListener("click", () => {
  if (!getPatientClinicalRecord(currentPatientData || {})) {
    alert("Este paciente todavía no tiene una ficha clínica que editar.");
    return;
  }
  setPatientRecordEditing(true);
});

cancelPatientRecordEditButton.addEventListener("click", () => {
  setPatientRecordEditing(false);
});

savePatientRecordButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  const patientId = currentPatientId;
  const originalRecord = getPatientClinicalRecord(currentPatientData || {});
  if (!user || !patientId || !originalRecord) return;

  const edits = [...patientClinicalRecord.querySelectorAll("[data-edit-path]")].map((input) => ({
    path: JSON.parse(input.dataset.editPath),
    rawValue: input.value
  }));
  const { updatedRecord, changes } = applyClinicalRecordEdits(originalRecord, edits);
  if (changes.length === 0) {
    alert("No has modificado ningún dato.");
    return;
  }

  try {
    savePatientRecordButton.disabled = true;
    savePatientRecordButton.textContent = "Guardando...";
    const patientRef = doc(db, "patients", patientId);
    const revisionRef = doc(collection(patientRef, "revisions"));
    const revisionData = {
      schemaVersion: SCHEMA_VERSION,
      userId: user.uid,
      patientId,
      tipoEvento: "revision_manual",
      estado: ANALYSIS_STATUS.REVIEWED,
      revisionHumana: {
        reviewedBy: user.uid,
        reviewedAt: new Date().toISOString(),
        modifiedFieldCount: changes.length
      },
      camposModificados: changes.map((change) => change.ruta),
      cambios: changes,
      fechaCreacion: serverTimestamp()
    };

    await runTransaction(db, async (transaction) => {
      const latestSnapshot = await transaction.get(patientRef);
      if (!latestSnapshot.exists() || latestSnapshot.data().userId !== user.uid) {
        const accessError = new Error("El paciente ya no está disponible.");
        accessError.code = "patient/not-available";
        throw accessError;
      }

      const latestRecord = getPatientClinicalRecord(latestSnapshot.data());
      if (!valuesAreEqual(latestRecord, originalRecord)) {
        const conflictError = new Error("La ficha ha cambiado desde que la abriste.");
        conflictError.code = "patient/edit-conflict";
        throw conflictError;
      }

      transaction.update(patientRef, {
        schemaVersion: SCHEMA_VERSION,
        ficha: updatedRecord,
        ultimaRevisionManualId: revisionRef.id,
        ultimaActualizacion: serverTimestamp()
      });
      transaction.set(revisionRef, revisionData);
    });

    alert(`Ficha actualizada. Se han registrado ${changes.length} campos modificados.`);
    await openPatientDetail(patientId);
  } catch (error) {
    console.error("Error guardando la edición de la ficha:", error);
    if (error.code === "patient/edit-conflict") {
      alert("La ficha cambió mientras la editabas. Se recargará para evitar sobrescribir datos.");
      await openPatientDetail(patientId);
      return;
    }
    alert(error.message || "No se han podido guardar los cambios.");
  } finally {
    savePatientRecordButton.disabled = false;
    savePatientRecordButton.textContent = "Guardar cambios";
  }
});

newPatientButton.addEventListener("click", () => {
  resetPatientForm();
  showNewPatientView();
});

cancelPatientButton.addEventListener("click", async () => {
  resetPatientForm();
  await showPatientsView();
});

backToNewPatientButton.addEventListener("click", async () => {
  const targetPatientId = currentAnalysisSession?.targetPatientId;
  currentAnalysisSession = null;
  reviewFields.innerHTML = "";
  if (targetPatientId) {
    await openPatientDetail(targetPatientId);
    return;
  }
  showNewPatientView();
});

patientDocuments.addEventListener("change", () => {
  const files = Array.from(patientDocuments.files);
  selectedDocuments.innerHTML = "";
  if (files.length === 0) return;
  const summary = document.createElement("p");
  summary.textContent = `Documento seleccionado: ${files[0].name}`;
  selectedDocuments.appendChild(summary);
});

analyzePatientButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  const name = patientName.value.trim();
  const files = Array.from(patientDocuments.files);
  if (!user) return alert("Debes iniciar sesión.");
  if (!name) return alert("Introduce el nombre del paciente.");
  if (files.length !== 1) return alert("Selecciona un documento PDF.");

  const file = files[0];
  if (file.type !== "application/pdf") {
    alert("En esta fase solo se pueden analizar documentos PDF.");
    return;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    alert("El PDF supera el límite de 8 MB.");
    return;
  }
  if (!(await isRealPdf(file))) {
    alert("El archivo seleccionado no contiene un PDF válido.");
    return;
  }

  const privacyReview = await requestPrivacyConfirmation(file, getKnownPrivacyIdentifiers());
  if (!privacyReview) return;

  try {
    analyzePatientButton.disabled = true;
    analyzePatientButton.textContent = "Analizando...";
    currentAnalysisSession = await analyzeDocumentFile(file, user, privacyReview);
    patientDocuments.value = "";
    selectedDocuments.innerHTML = "";
    renderExtraction(currentAnalysisSession.extraction);
    saveReviewedPatientButton.textContent = "Guardar paciente";
    showReviewPatientView();
  } catch (error) {
    console.error(error);
    alert(error.message || "Ha ocurrido un error durante el análisis.");
  } finally {
    analyzePatientButton.disabled = false;
    analyzePatientButton.textContent = "Analizar documentación";
  }
});

function formatComparisonValue(value) {
  if (value === null || value === undefined || value === "") return "No registrado";
  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((item) => typeof item === "object" ? JSON.stringify(item) : item).join(" · ")
      : "No registrado";
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderClinicalComparison(comparisons) {
  clinicalComparisonList.innerHTML = "";
  if (comparisons.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-detail-message";
    empty.textContent =
      "El documento no aporta cambios útiles frente a la ficha actual. Se guardará en el historial.";
    clinicalComparisonList.appendChild(empty);
    saveClinicalComparisonButton.textContent = "Guardar solo análisis";
    return;
  }

  saveClinicalComparisonButton.textContent = "Guardar selección";
  comparisons.forEach((comparison) => {
    const route = comparison.path.join(".");
    const card = document.createElement("article");
    card.className = "comparison-card";

    const heading = document.createElement("div");
    heading.className = "comparison-heading";
    const title = document.createElement("h3");
    title.textContent = humanizeKey(comparison.path.at(-1));
    const section = document.createElement("span");
    section.textContent = SECTION_LABELS[comparison.path[0]] || humanizeKey(comparison.path[0]);
    heading.append(title, section);

    const values = document.createElement("div");
    values.className = "comparison-values";
    const current = document.createElement("div");
    current.innerHTML = "<strong>Ficha actual</strong>";
    const currentText = document.createElement("p");
    currentText.textContent = formatComparisonValue(comparison.currentValue);
    current.appendChild(currentText);
    const proposed = document.createElement("div");
    proposed.innerHTML = "<strong>Documento nuevo</strong>";
    const proposedText = document.createElement("p");
    proposedText.textContent = formatComparisonValue(comparison.newValue);
    proposed.appendChild(proposedText);
    values.append(current, proposed);

    const choice = document.createElement("label");
    choice.className = "comparison-choice";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.comparisonPath = route;
    const choiceText = document.createElement("span");
    choiceText.textContent = "Incorporar el dato nuevo a la ficha";
    choice.append(checkbox, choiceText);
    card.append(heading, values, choice);
    clinicalComparisonList.appendChild(card);
  });
}

function showClinicalComparison(user) {
  const humanReviewResult = applyHumanReview(currentAnalysisSession.extraction, user.uid);
  const baseRecord = structuredClone(getPatientClinicalRecord(currentPatientData) || {});
  const comparisons = buildClinicalComparison(baseRecord, humanReviewResult.reviewedExtraction);
  currentAnalysisSession.comparison = { humanReviewResult, baseRecord, comparisons };
  renderClinicalComparison(comparisons);
  setVisibleView(comparisonPatientView);
}

backToExtractionReviewButton.addEventListener("click", () => {
  if (currentAnalysisSession) delete currentAnalysisSession.comparison;
  setVisibleView(reviewPatientView);
});

async function saveDocumentAnalysisForExistingPatient(user, selectedPaths) {
  const session = currentAnalysisSession;
  const patientId = session.targetPatientId;
  const patientRef = doc(db, "patients", patientId);
  const documentRef = doc(patientRef, "documents", session.sourceDocument.sha256);
  const analysisRef = doc(collection(patientRef, "analyses"));
  const revisionRef = doc(collection(patientRef, "revisions"));
  const { humanReviewResult, baseRecord, comparisons } = session.comparison;
  const { reviewedExtraction, modifiedPaths, review } = humanReviewResult;
  const incorporatedAt = new Date().toISOString();
  const { updatedRecord, changes } = applyClinicalComparison(
    baseRecord,
    comparisons,
    selectedPaths,
    { analysisId: analysisRef.id, incorporatedAt }
  );
  const documentData = {
    schemaVersion: SCHEMA_VERSION,
    userId: user.uid,
    patientId,
    analysisId: analysisRef.id,
    tipo: session.documentType,
    nombreOriginal: session.sourceDocument.name,
    mimeType: session.sourceDocument.mimeType,
    tamano: session.sourceDocument.size,
    sha256: session.sourceDocument.sha256,
    archivoConservado: false,
    fechaDocumento: session.documentDate,
    estado: DOCUMENT_STATUS.ANALYZED,
    fechaCreacion: serverTimestamp(),
    ultimaActualizacion: serverTimestamp()
  };
  const analysisData = {
    schemaVersion: SCHEMA_VERSION,
    userId: user.uid,
    patientId,
    documentId: documentRef.id,
    estado: ANALYSIS_STATUS.REVIEWED,
    documentoFuente: session.sourceDocument,
    fechaAnalisisCliente: session.analyzedAt,
    extraccionOriginal: session.extraction,
    extraccionRevisada: reviewedExtraction,
    revisionHumana: review,
    revisionPrivacidad: session.privacyReview,
    camposModificados: modifiedPaths,
    comparacionFicha: {
      camposPropuestos: comparisons.map((comparison) => comparison.path.join(".")),
      camposIncorporados: changes.map((change) => change.ruta)
    },
    fechaCreacion: serverTimestamp()
  };
  const revisionData = {
    schemaVersion: SCHEMA_VERSION,
    userId: user.uid,
    patientId,
    analysisId: analysisRef.id,
    tipoEvento: "incorporacion_documento",
    estado: ANALYSIS_STATUS.REVIEWED,
    camposModificados: changes.map((change) => change.ruta),
    cambios: changes,
    fechaCreacion: serverTimestamp()
  };

  await runTransaction(db, async (transaction) => {
    const patientSnapshot = await transaction.get(patientRef);
    const existingDocument = await transaction.get(documentRef);
    if (!patientSnapshot.exists() || patientSnapshot.data().userId !== user.uid) {
      const unavailableError = new Error("El paciente ya no está disponible.");
      unavailableError.code = "patient/not-available";
      throw unavailableError;
    }
    if (existingDocument.exists()) {
      const duplicateError = new Error("Este mismo PDF ya fue analizado para el paciente.");
      duplicateError.code = "document/already-exists";
      throw duplicateError;
    }
    if (!valuesAreEqual(getPatientClinicalRecord(patientSnapshot.data()) || {}, baseRecord)) {
      const conflictError = new Error("La ficha cambió mientras comparabas los datos.");
      conflictError.code = "patient/comparison-conflict";
      throw conflictError;
    }

    transaction.set(documentRef, documentData);
    transaction.set(analysisRef, analysisData);
    if (changes.length > 0) transaction.set(revisionRef, revisionData);
    const patientUpdate = {
      ultimoAnalisisId: analysisRef.id,
      ultimaActualizacion: serverTimestamp()
    };
    if (changes.length > 0) {
      patientUpdate.ficha = updatedRecord;
      patientUpdate.ultimaIncorporacionId = revisionRef.id;
    }
    transaction.update(patientRef, patientUpdate);
  });

  currentAnalysisSession = null;
  reviewFields.innerHTML = "";
  alert(
    changes.length > 0
      ? `Análisis guardado y ${changes.length} cambios incorporados a la ficha.`
      : "Análisis guardado sin modificar la ficha. El PDF original no se ha conservado."
  );
  await openPatientDetail(patientId);
}

saveClinicalComparisonButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user || !currentAnalysisSession?.comparison) return;
  const selectedPaths = [...clinicalComparisonList.querySelectorAll("[data-comparison-path]:checked")]
    .map((input) => input.dataset.comparisonPath);

  try {
    saveClinicalComparisonButton.disabled = true;
    saveClinicalComparisonButton.textContent = "Guardando...";
    await saveDocumentAnalysisForExistingPatient(user, selectedPaths);
  } catch (error) {
    console.error("Error guardando la comparación clínica:", error);
    if (error.code === "patient/comparison-conflict") {
      alert("La ficha cambió mientras la comparabas. Se recargará sin sobrescribirla.");
      await openPatientDetail(currentAnalysisSession.targetPatientId);
      return;
    }
    alert(error.message || "No se ha podido guardar la comparación.");
  } finally {
    saveClinicalComparisonButton.disabled = false;
    saveClinicalComparisonButton.textContent = "Guardar selección";
  }
});

saveReviewedPatientButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Debes iniciar sesión.");
  if (!currentAnalysisSession?.extraction) {
    alert("No hay datos analizados para guardar.");
    return;
  }

  if (currentAnalysisSession.targetPatientId) {
    showClinicalComparison(user);
    return;
  }

  const name = patientName.value.trim();
  const nh = patientNH.value.trim();
  try {
    saveReviewedPatientButton.disabled = true;
    saveReviewedPatientButton.textContent = "Comprobando...";
    const duplicate = await findPossibleDuplicate(user, name, nh);
    if (duplicate?.type === "nh") {
      alert(
        `Ya existe un paciente con ese NH: ${getPatientName(duplicate.patient)}. ` +
        "No se ha creado ningún duplicado."
      );
      return;
    }
    if (
      duplicate?.type === "name" &&
      !window.confirm(
        "Ya existe un paciente con el mismo nombre y sin NH. " +
        "¿Quieres crear otro paciente de todas formas?"
      )
    ) return;

    saveReviewedPatientButton.textContent = "Guardando...";
    const { reviewedExtraction, modifiedPaths, review } = applyHumanReview(
      currentAnalysisSession.extraction,
      user.uid
    );
    const normalizedNH = nh ? normalizeMedicalRecordNumber(nh) : null;
    const patientRef = normalizedNH
      ? doc(db, "patients", await createPatientDocumentId(user.uid, normalizedNH))
      : doc(collection(db, "patients"));
    const analysisRef = doc(collection(patientRef, "analyses"));
    const documentRef = doc(
      patientRef,
      "documents",
      currentAnalysisSession.sourceDocument.sha256
    );
    const patientData = {
      schemaVersion: SCHEMA_VERSION,
      userId: user.uid,
      nombre: name,
      nombreNormalizado: normalizeText(name),
      nh: nh || null,
      nhNormalizado: normalizedNH,
      estadoClinico: PATIENT_STATUS.ACTIVE,
      ficha: reviewedExtraction,
      ultimoAnalisisId: analysisRef.id,
      fechaCreacion: serverTimestamp(),
      ultimaActualizacion: serverTimestamp()
    };
    const analysisData = {
      schemaVersion: SCHEMA_VERSION,
      userId: user.uid,
      patientId: patientRef.id,
      documentId: documentRef.id,
      estado: ANALYSIS_STATUS.REVIEWED,
      documentoFuente: currentAnalysisSession.sourceDocument,
      fechaAnalisisCliente: currentAnalysisSession.analyzedAt,
      extraccionOriginal: currentAnalysisSession.extraction,
      extraccionRevisada: reviewedExtraction,
      revisionHumana: review,
      revisionPrivacidad: currentAnalysisSession.privacyReview,
      camposModificados: modifiedPaths,
      fechaCreacion: serverTimestamp()
    };
    const documentData = {
      schemaVersion: SCHEMA_VERSION,
      userId: user.uid,
      patientId: patientRef.id,
      analysisId: analysisRef.id,
      tipo: newPatientDocumentType.value,
      nombreOriginal: currentAnalysisSession.sourceDocument.name,
      mimeType: currentAnalysisSession.sourceDocument.mimeType,
      tamano: currentAnalysisSession.sourceDocument.size,
      sha256: currentAnalysisSession.sourceDocument.sha256,
      archivoConservado: false,
      fechaDocumento: null,
      estado: DOCUMENT_STATUS.ANALYZED,
      fechaCreacion: serverTimestamp(),
      ultimaActualizacion: serverTimestamp()
    };

    await runTransaction(db, async (transaction) => {
      if (normalizedNH) {
        const existingPatient = await transaction.get(patientRef);
        if (existingPatient.exists()) {
          const duplicateError = new Error("Ya existe un paciente con ese NH.");
          duplicateError.code = "patient/already-exists";
          throw duplicateError;
        }
      }

      transaction.set(patientRef, patientData);
      transaction.set(analysisRef, analysisData);
      transaction.set(documentRef, documentData);
    });

    alert("Paciente y análisis guardados. El PDF original no se ha conservado.");
    resetPatientForm();
    await showPatientsView();
  } catch (error) {
    console.error(error);
    alert(
      error.code === "patient/already-exists"
        ? "Ya existe un paciente con ese NH. No se ha creado ningún duplicado."
        : "No se ha podido guardar el paciente."
    );
  } finally {
    saveReviewedPatientButton.disabled = false;
    saveReviewedPatientButton.textContent = "Guardar paciente";
  }
});
