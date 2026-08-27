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
  getDocs,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  SCHEMA_VERSION,
  PATIENT_STATUS,
  ANALYSIS_STATUS,
  normalizeText,
  normalizeMedicalRecordNumber,
  createPatientDocumentId,
  humanizeKey,
  isMissingValue,
  valuesAreEqual,
  coerceEditedValue,
  formatTimestamp,
  getPatientStatus,
  getPatientName,
  getPatientNH,
  getPatientAge
} from "./src/patient-model.js";

const firebaseConfig = {
  apiKey: "AIzaSyDieG_k97issVAituvN_AVWM3D8Hgq76aM",
  authDomain: "piat-assistant.firebaseapp.com",
  projectId: "piat-assistant",
  storageBucket: "piat-assistant.firebasestorage.app",
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
const newPatientView = document.getElementById("newPatientView");
const reviewPatientView = document.getElementById("reviewPatientView");
const reviewFields = document.getElementById("reviewFields");
const backToNewPatientButton = document.getElementById("backToNewPatientButton");
const saveReviewedPatientButton = document.getElementById("saveReviewedPatientButton");
const newPatientButton = document.getElementById("newPatientButton");
const cancelPatientButton = document.getElementById("cancelPatientButton");
const analyzePatientButton = document.getElementById("analyzePatientButton");
const patientName = document.getElementById("patientName");
const patientNH = document.getElementById("patientNH");
const patientDocuments = document.getElementById("patientDocuments");
const selectedDocuments = document.getElementById("selectedDocuments");
const patientsEmpty = document.getElementById("patientsEmpty");
const patientsList = document.getElementById("patientsList");

let currentAnalysisSession = null;

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
  newPatientView.hidden = view !== newPatientView;
  reviewPatientView.hidden = view !== reviewPatientView;
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

  details.append(nh, age, status, updatedAt);
  card.append(name, details);
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
    Object.entries(value).forEach(([childKey, childValue]) => {
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
  Object.entries(extraction).forEach(([sectionKey, sectionData]) => {
    const section = document.createElement("section");
    section.className = "review-section";
    const heading = document.createElement("h3");
    heading.textContent = SECTION_LABELS[sectionKey] || humanizeKey(sectionKey);
    section.appendChild(heading);

    if (sectionData && typeof sectionData === "object" && !Array.isArray(sectionData)) {
      Object.entries(sectionData).forEach(([key, value]) => {
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
  setVisibleView(patientsView);
  resetPatientForm();
});

newPatientButton.addEventListener("click", () => {
  resetPatientForm();
  showNewPatientView();
});

cancelPatientButton.addEventListener("click", async () => {
  resetPatientForm();
  await showPatientsView();
});

backToNewPatientButton.addEventListener("click", () => {
  currentAnalysisSession = null;
  reviewFields.innerHTML = "";
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

  try {
    analyzePatientButton.disabled = true;
    analyzePatientButton.textContent = "Analizando...";
    const [fileBase64, idToken] = await Promise.all([
      readFileAsBase64(file),
      user.getIdToken()
    ]);
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ fileBase64, mimeType: file.type })
    });
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error("El servidor devolvió una respuesta no válida.");
    }
    if (!response.ok) throw new Error(result.error || "No se ha podido analizar el documento.");

    currentAnalysisSession = {
      extraction: result,
      sourceDocument: {
        name: file.name,
        mimeType: file.type,
        size: file.size,
        lastModified: file.lastModified || null
      },
      analyzedAt: new Date().toISOString()
    };
    renderExtraction(result);
    showReviewPatientView();
  } catch (error) {
    console.error(error);
    alert(error.message || "Ha ocurrido un error durante el análisis.");
  } finally {
    analyzePatientButton.disabled = false;
    analyzePatientButton.textContent = "Analizar documentación";
  }
});

saveReviewedPatientButton.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Debes iniciar sesión.");
  if (!currentAnalysisSession?.extraction) {
    alert("No hay datos analizados para guardar.");
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
      estado: ANALYSIS_STATUS.REVIEWED,
      documentoFuente: currentAnalysisSession.sourceDocument,
      fechaAnalisisCliente: currentAnalysisSession.analyzedAt,
      extraccionOriginal: currentAnalysisSession.extraction,
      extraccionRevisada: reviewedExtraction,
      revisionHumana: review,
      camposModificados: modifiedPaths,
      fechaCreacion: serverTimestamp()
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
    });

    alert("Paciente guardado correctamente.");
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
