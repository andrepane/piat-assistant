const piatType = document.getElementById("piatType");
const patientName = document.getElementById("patientName");
const birthDate = document.getElementById("birthDate");
const previousPiat = document.getElementById("previousPiat");
const currentAssessment = document.getElementById("currentAssessment");
const continueButton = document.getElementById("continueButton");
const status = document.getElementById("status");

function updatePreviousPiatVisibility() {
  const previousPiatGroup = previousPiat.closest(".form-group");

  if (piatType.value === "revision") {
    previousPiatGroup.style.display = "block";
  } else {
    previousPiatGroup.style.display = "none";
    previousPiat.value = "";
  }
}

piatType.addEventListener("change", updatePreviousPiatVisibility);

updatePreviousPiatVisibility();

continueButton.addEventListener("click", () => {
  const type = piatType.value;
  const name = patientName.value.trim();
  const birth = birthDate.value;
  const previousFile = previousPiat.files[0];
  const assessmentFile = currentAssessment.files[0];

  if (!type) {
    status.textContent = "Selecciona el tipo de PIAT.";
    return;
  }

  if (!name) {
    status.textContent = "Introduce el nombre del paciente.";
    return;
  }

  if (!birth) {
    status.textContent = "Introduce la fecha de nacimiento.";
    return;
  }

  if (!assessmentFile) {
    status.textContent = "Adjunta la evaluación o los resultados actuales.";
    return;
  }

  if (type === "revision" && !previousFile) {
    status.textContent = "Para un PIAT de revisión, adjunta el PIAT anterior.";
    return;
  }

  status.textContent = "Datos básicos correctos. Preparado para el siguiente paso.";
});
