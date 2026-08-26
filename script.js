const patientsView = document.getElementById("patientsView");
const newPatientView = document.getElementById("newPatientView");

const newPatientButton = document.getElementById("newPatientButton");
const cancelPatientButton = document.getElementById("cancelPatientButton");
const analyzePatientButton = document.getElementById("analyzePatientButton");

const patientName = document.getElementById("patientName");
const patientNH = document.getElementById("patientNH");
const patientDocuments = document.getElementById("patientDocuments");
const selectedDocuments = document.getElementById("selectedDocuments");

function showPatientsView() {
  newPatientView.hidden = true;
  patientsView.hidden = false;
}

function showNewPatientView() {
  patientsView.hidden = true;
  newPatientView.hidden = false;
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

analyzePatientButton.addEventListener("click", () => {
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

  alert(
    `Preparado para analizar ${files.length} documento(s) de ${name}.`
  );
});

showPatientsView();
