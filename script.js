import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDieG_k97issVAituvN_AVWM3D8Hgq76aM",
  authDomain: "piat-assistant.firebaseapp.com",
  projectId: "piat-assistant",
  storageBucket: "piat-assistant.firebasestorage.app",
  messagingSenderId: "584338030607",
  appId: "1:584338030607:web:5696ad7e815d65335b637a"
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

loginButton.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  loginStatus.textContent = "";

  if (!email || !password) {
    loginStatus.textContent = "Introduce correo y contraseña.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);
    loginStatus.textContent = "No se ha podido iniciar sesión.";
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginView.hidden = true;
    appHeader.hidden = false;
    appMain.hidden = false;
  } else {
    loginView.hidden = false;
    appHeader.hidden = true;
    appMain.hidden = true;
  }
});

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

function showPatientsView() {
  patientsView.hidden = false;
  newPatientView.hidden = true;
  reviewPatientView.hidden = true;
}

function showNewPatientView() {
  patientsView.hidden = true;
  newPatientView.hidden = false;
  reviewPatientView.hidden = true;
}

function showReviewPatientView() {
  patientsView.hidden = true;
  newPatientView.hidden = true;
  reviewPatientView.hidden = false;
}

function resetPatientForm() {
  patientName.value = "";
  patientNH.value = "";
  patientDocuments.value = "";
  selectedDocuments.innerHTML = "";
}

newPatientButton.addEventListener("click", () => {
  resetPatientForm();
  showNewPatientView();
});

cancelPatientButton.addEventListener("click", () => {
  resetPatientForm();
  showPatientsView();
});

patientDocuments.addEventListener("change", () => {
  const files = Array.from(patientDocuments.files);

  selectedDocuments.innerHTML = "";

  if (files.length === 0) {
    return;
  }

  const title = document.createElement("p");
  title.textContent = `${files.length} documento(s) seleccionado(s):`;
  selectedDocuments.appendChild(title);

  const list = document.createElement("ul");

  files.forEach((file) => {
    const item = document.createElement("li");
    item.textContent = file.name;
    list.appendChild(item);
  });

  selectedDocuments.appendChild(list);
});

analyzePatientButton.addEventListener("click", async () => {
  const name = patientName.value.trim();
  const files = Array.from(patientDocuments.files);

  if (!name) {
    alert("Introduce el nombre del paciente.");
    return;
  }

  if (files.length === 0) {
    alert("Sube al menos un documento del paciente.");
    return;
  }

  const file = files[0];

  try {
    analyzePatientButton.disabled = true;
    analyzePatientButton.textContent = "Analizando...";

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];

        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fileBase64: base64,
            mimeType: file.type
          })
        });

        const result = await response.json();

        if (!response.ok) {
          console.error(result);
          alert(result.error || "No se ha podido analizar el documento.");
          return;
        }

        window.currentPatientExtraction = result;

        reviewFields.innerHTML = "";

        const sections = [
          ["Identificación", result.identificacion],
          ["Diagnóstico", result.diagnostico],
          ["Salud", result.salud],
          ["Escolarización", result.escolarizacion],
          ["Desarrollo y contexto", result.desarrollo_y_contexto],
          ["Familia", result.familia],
          ["Apoyo profesional", result.apoyo_profesional]
        ];

        sections.forEach(([title, data]) => {
          if (!data) return;

          const section = document.createElement("section");
          section.className = "review-section";

          const heading = document.createElement("h3");
          heading.textContent = title;
          section.appendChild(heading);

          Object.entries(data).forEach(([key, field]) => {
            if (
              field &&
              typeof field === "object" &&
              !Array.isArray(field) &&
              "valor" in field
            ) {
              const wrapper = document.createElement("div");
              wrapper.className = "review-field";

              const label = document.createElement("label");
              label.textContent = key.replaceAll("_", " ");

              const input = document.createElement("textarea");
              input.value = field.valor ?? "";
              input.dataset.section = title;
              input.dataset.key = key;

              const meta = document.createElement("small");

              const confianza = field.confianza || "desconocida";

              meta.textContent =
                `Confianza: ${confianza}` +
                (field.evidencia
                  ? ` · Evidencia: "${field.evidencia}"`
                  : "");

              if (confianza === "baja") {
                wrapper.classList.add("low-confidence");
              }

              wrapper.appendChild(label);
              wrapper.appendChild(input);
              wrapper.appendChild(meta);

              section.appendChild(wrapper);
            }
          });

          reviewFields.appendChild(section);
        });

        showReviewPatientView();

      } catch (error) {
        console.error(error);
        alert("Ha ocurrido un error durante el análisis.");
      } finally {
        analyzePatientButton.disabled = false;
        analyzePatientButton.textContent = "Analizar documentación";
      }
    };

    reader.readAsDataURL(file);

  } catch (error) {
    console.error(error);
    analyzePatientButton.disabled = false;
    analyzePatientButton.textContent = "Analizar documentación";
    alert("No se ha podido leer el archivo.");
  }
});

showPatientsView();
