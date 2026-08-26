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
  const nh = patientNH.value.trim();
  const files = Array.from(patientDocuments.files);

  if (!name) {
    alert("Introduce el nombre del paciente.");
    return;
  }

  if (files.length === 0) {
    alert("Sube al menos un documento del paciente.");
    return;
  }

  const user = auth.currentUser;

  if (!user) {
    alert("Debes iniciar sesión.");
    return;
  }

  try {
    analyzePatientButton.disabled = true;
    analyzePatientButton.textContent = "Guardando...";

    const patientData = {
      userId: user.uid,
      nombre: name,
      nh: nh || null,
      documentos: files.map((file) => ({
        nombre: file.name,
        tipo: file.type || null,
        tamano: file.size
      })),
      estado: "pendiente_analisis",
      fechaCreacion: serverTimestamp(),
      ultimaActualizacion: serverTimestamp()
    };

    const docRef = await addDoc(
      collection(db, "patients"),
      patientData
    );

    alert(`Paciente creado correctamente. ID: ${docRef.id}`);

    resetPatientForm();
    showPatientsView();

  } catch (error) {
    console.error(error);
    alert("No se ha podido crear el paciente.");
  } finally {
    analyzePatientButton.disabled = false;
    analyzePatientButton.textContent = "Analizar documentación";
  }
});

showPatientsView();
