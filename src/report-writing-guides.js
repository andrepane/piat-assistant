const guide = (buscar, redactar, evitar, modelo) => ({ buscar, redactar, evitar, modelo });

export const PIAT_REVISION_WRITING_GUIDES = Object.freeze({
  informacion_diagnostica_y_medica: guide(
    "Diagnósticos funcionales, diagnósticos principales y datos médicos expresamente registrados.",
    "Un párrafo breve y objetivo. Conserva literalmente etiquetas y códigos diagnósticos.",
    "Completar alergias, medicación, enfermedades o diagnósticos no documentados.",
    "Consta como diagnóstico funcional [ETIQUETA Y CÓDIGO]. Como diagnóstico principal del CAIT se registra [ETIQUETA Y CÓDIGO]. [INFORMACIÓN MÉDICA CONFIRMADA, SI EXISTE]."
  ),
  antecedentes_personales: guide(
    "Gestación, parto, edad gestacional, Apgar, datos neonatales, alimentación, ingresos, cirugías y antecedentes médicos.",
    "Ordena cronológicamente desde la gestación hasta los antecedentes posteriores relevantes.",
    "Resumir como embarazo o parto sin incidencias si no está confirmado.",
    "Embarazo [TIPO Y EVOLUCIÓN DOCUMENTADA]. Parto [A TÉRMINO/PRETÉRMINO] en la semana [EDAD GESTACIONAL], mediante [TIPO]. [DATOS NEONATALES Y ANTECEDENTES CONFIRMADOS]."
  ),
  antecedentes_familiares: guide(
    "Hermanos y antecedentes familiares neurológicos, psiquiátricos, del desarrollo, del lenguaje o de interés clínico.",
    "Un párrafo breve con relaciones familiares y antecedentes confirmados.",
    "Afirmar que no existen antecedentes cuando simplemente no se mencionan.",
    "[INFORMACIÓN CONFIRMADA SOBRE HERMANOS]. En relación con los antecedentes familiares, [ANTECEDENTES EXPRESAMENTE REGISTRADOS]."
  ),
  otros_datos_salud: guide(
    "Seguimientos sanitarios, especialistas, pruebas, intervenciones previstas, alergias y tratamiento actuales.",
    "Distingue seguimiento activo, resultados conocidos y actuaciones pendientes.",
    "Mantener como actual un seguimiento antiguo sin evidencia posterior.",
    "Actualmente se encuentra en seguimiento por [SERVICIO]. [RESULTADOS O ACTUACIONES PENDIENTES CONFIRMADAS]."
  ),
  datos_escolarizacion: guide(
    "Ciclo, curso, modalidad, adaptación, asistencia y apoyos educativos actuales.",
    "Describe la situación vigente sin incluir el nombre identificable del centro.",
    "Arrastrar el curso del PIAT anterior o inventar apoyos.",
    "Se encuentra escolarizado en [CICLO Y CURSO], en modalidad [MODALIDAD]. Dispone de [APOYOS CONFIRMADOS] y [INFORMACIÓN FUNCIONAL RELEVANTE]."
  ),
  aspectos_biopsicosociales: guide(
    "Estado físico, regulación emocional, conducta, atención, sociabilidad, cuidadores y circunstancias familiares actuales.",
    "Integra menor, funcionamiento conductual-social y contexto familiar en dos o tres párrafos.",
    "Generalizaciones positivas, factores socioeconómicos o estilos educativos no confirmados.",
    "Durante las sesiones se muestra [CONDUCTA], con [DISPOSICIÓN Y REGULACIÓN]. A nivel atencional y social, [FORTALEZAS Y NECESIDADES]. La familia [IMPLICACIÓN CONFIRMADA]."
  ),
  red_apoyo_profesional: guide(
    "Especialidades, frecuencia, apoyos educativos, servicios sanitarios y recursos externos actuales.",
    "Enumera apoyos vigentes y frecuencia cuando conste, sin nombres propios.",
    "Convertir pautas mensuales en semanales o mantener profesionales antiguos sin confirmación.",
    "Recibe atención en el CAIT mediante [PAUTA] de [ESPECIALIDADES]. En el ámbito educativo dispone de [APOYOS]. [OTROS RECURSOS VIGENTES]."
  ),
  exploracion_pruebas: guide(
    "Nombre, fecha, edad cronológica, baremo y resultados globales, por áreas y subáreas de cada evaluación.",
    "Presenta cada evaluación y sus resultados, conservando exactamente unidades y tipos de puntuación.",
    "Mezclar PD, PT, percentil, índice o edad equivalente; omitir áreas disponibles; interpretar progreso aquí.",
    "Se administra [PRUEBA] en [FECHA], con una edad cronológica de [EDAD]. Obtiene [RESULTADOS GLOBALES]. Por áreas, se registran [RESULTADOS ORDENADOS]."
  ),
  interpretacion_evolucion: guide(
    "Tiempo transcurrido, edad cronológica, puntuaciones comparables, edades equivalentes, percentiles y observaciones posteriores.",
    "Diferencia adquisición absoluta, evolución frente a la edad cronológica y perfil desigual por áreas.",
    "Afirmar evolución favorable solo porque sube la PD o edad equivalente; comparar métricas distintas; atribuir causalidad.",
    "Respecto a la valoración anterior, se observan adquisiciones en [ÁREAS]. Durante el periodo transcurrido, la edad equivalente [RELACIÓN CON EL TIEMPO], por lo que [SE MANTIENE/REDUCE/AUMENTA] el desfase. Persisten necesidades en [ÁREAS Y REPERCUSIÓN]."
  ),
  exploracion_cualitativa: guide(
    "Funcionamiento actual motor, cognitivo, comunicativo y adaptativo observado o informado después del PIAT anterior.",
    "Redacta un párrafo por área; en comunicación detalla comprensión, expresión, habla y funcionalidad cuando consten.",
    "Transformar puntuaciones estandarizadas directamente en conductas o repetir la tabla.",
    "DESARROLLO MOTOR: [FUNCIONAMIENTO]. DESARROLLO COGNITIVO: [ATENCIÓN, APRENDIZAJE Y APOYOS]. DESARROLLO COMUNICATIVO: [PERFIL COMPRENSIVO, EXPRESIVO Y FUNCIONAL]. DESARROLLO ADAPTATIVO: [AUTONOMÍA]."
  ),
  preocupaciones_familia: guide(
    "Preocupaciones y prioridades familiares actuales expresamente recogidas.",
    "Una formulación breve centrada en la preocupación y ayuda solicitada.",
    "Dar por vigentes preocupaciones antiguas sin actualización.",
    "La familia manifiesta preocupación por [ÁREA ACTUAL] y plantea como prioridad [NECESIDAD EXPRESADA]."
  ),
  objetivos_conseguidos: guide(
    "Objetivos literales anteriores y evidencia posterior explícita de consecución funcional.",
    "Incluye solo objetivos anteriores demostrados como logros concretos.",
    "Inferir logros desde puntuaciones, inventar objetivos previos o considerar conseguido un objetivo parcial.",
    "- [HABILIDAD FUNCIONAL CONSEGUIDA], evidenciada por [CONDUCTA POSTERIOR CONFIRMADA]."
  ),
  objetivos_en_proceso: guide(
    "Objetivos anteriores con avances parciales, necesidad persistente o evidencia insuficiente de consecución.",
    "Conserva la intención previa y actualiza el nivel funcional sin duplicar categorías.",
    "Crear necesidades nuevas aquí o repetir objetivos conseguidos.",
    "- Continuar favoreciendo [HABILIDAD], ya que se observan [AVANCES] pero persisten dificultades en [SITUACIÓN]."
  ),
  objetivos_actuales: guide(
    "Necesidades actuales, objetivos en proceso y dificultades nuevas justificadas por datos recientes.",
    "Objetivos en infinitivo, concretos, funcionales, no redundantes y vinculados a una necesidad descrita.",
    "Listas genéricas, objetivos sin evidencia o duplicar objetivos en proceso.",
    "- Mejorar [HABILIDAD ESPECÍFICA] en [CONTEXTO FUNCIONAL O NIVEL DE COMPLEJIDAD]."
  ),
  familia: guide(
    "Necesidades familiares actuales y objetivos que requieren generalización en casa.",
    "Actuaciones concretas de orientación y generalización vinculadas al caso.",
    "Pautas genéricas sin relación con las necesidades descritas.",
    "- Proporcionar a la familia estrategias para favorecer [HABILIDAD] durante [RUTINA O CONTEXTO]."
  ),
  entorno: guide(
    "Necesidades escolares o comunitarias y aprendizajes que requieren coordinación.",
    "Actuaciones concretas entre CAIT, familia y entorno preservando la confidencialidad.",
    "Añadir adaptaciones o apoyos no justificados.",
    "- Coordinar con el entorno educativo estrategias para favorecer [HABILIDAD O PARTICIPACIÓN] en [SITUACIÓN]."
  ),
  profesionales: guide(
    "Profesionales y servicios vigentes, objetivos compartidos y necesidades de coordinación.",
    "Describe la coordinación necesaria sin nombres identificables.",
    "Enumerar profesionales antiguos como si siguieran activos.",
    "Se mantendrá coordinación entre [SERVICIOS] para compartir la evolución de [ÁREAS] y aplicar estrategias coherentes."
  ),
  sesiones_pautadas: guide(
    "Pauta vigente de UMAT o sesiones para menor, familia y entorno.",
    "Reproduce literalmente cantidades y unidad; si no están confirmadas, indica falta de información.",
    "Calcular, redondear, transformar UMAT mensuales en sesiones semanales o copiar la pauta histórica.",
    "Niño/a: [CANTIDAD Y UNIDAD]. Familia: [CANTIDAD Y UNIDAD]. Entorno: [CANTIDAD Y UNIDAD]. Total: [CANTIDAD Y UNIDAD]."
  ),
  materiales_recursos: guide(
    "Programas, escalas y materiales registrados como vigentes o previstos.",
    "Lista breve de recursos relevantes para los objetivos actuales.",
    "Añadir materiales habituales que no estén presentes en el contexto.",
    "- [MATERIAL, PROGRAMA O RECURSO CONFIRMADO]."
  )
});

export function buildPiatRevisionWritingGuide(sectionEntries) {
  return sectionEntries.map(([id, title]) => {
    const item = PIAT_REVISION_WRITING_GUIDES[id];
    if (!item) throw new Error(`Falta la guía de redacción para ${id}`);
    return [
      `APARTADO: ${title} (${id})`,
      `BUSCAR: ${item.buscar}`,
      `REDACTAR: ${item.redactar}`,
      `EVITAR: ${item.evitar}`,
      `MODELO DE ESTILO (datos ficticios entre corchetes): ${item.modelo}`
    ].join("\n");
  }).join("\n\n");
}

export function buildPiatRevisionReportPrompt(sectionEntries, sectionSchema) {
  return `Redacta un PIAT de revisión profesional a partir del contexto clínico anonimizado.

REGLAS COMUNES OBLIGATORIAS:
- Usa exclusivamente hechos presentes en el contexto clínico.
- Distingue la situación del PIAT anterior de la documentación posterior.
- No conviertas la ausencia de un dato en una negación clínica.
- Solo clasifica un objetivo como conseguido si era anterior y existe evidencia posterior explícita.
- La clasificación incluida en confirmacionProfesional.objetivosAnteriores es vinculante: no reclasifiques objetivos, no incluyas los descartados y no inventes otros objetivos anteriores.
- Usa confirmacionProfesional.actualizacionClinica como fuente prioritaria del funcionamiento actual. No deduzcas conductas observadas a partir de objetivos ni puntuaciones estandarizadas.
- Imita la organización y el registro de los modelos, pero nunca copies sus hechos clínicos.
- No menciones el contexto, las fuentes, Gemini ni el proceso de generación.
- Si falta información, escribe exactamente: "Sin información suficiente para redactar esta sección."
- No incluyas nombres, NH, fechas de nacimiento exactas, centros ni profesionales identificables.
- Devuelve únicamente JSON válido con esta estructura y orden:
${JSON.stringify({ titulo: "Plan de Intervención de Atención Temprana de Revisión", secciones: sectionSchema })}

GUÍAS ESPECÍFICAS Y MODELOS ANONIMIZADOS POR APARTADO:
${buildPiatRevisionWritingGuide(sectionEntries)}`;
}
