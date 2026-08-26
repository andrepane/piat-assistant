export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb"
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    const { fileBase64, mimeType } = req.body;

    if (!fileBase64 || !mimeType) {
      return res.status(400).json({
        error: "Falta el archivo o el tipo MIME"
      });
    }

    const prompt = `
Analiza este documento clínico anonimizado.

REGLAS OBLIGATORIAS:
- No inventes información.
- No completes datos por contexto si no están escritos de forma explícita.
- Si un dato no aparece claramente, devuelve valor null.
- No conviertas localidades, centros de salud u otros datos en centros escolares salvo que el documento lo indique explícitamente.
- No deduzcas diagnósticos no escritos.
- No interpretes un dato ambiguo como seguro.
- Cuando exista ambigüedad, marca confianza "baja".
- Para cada campo, incluye una evidencia textual breve tomada del documento.
- La evidencia debe ser una cita o fragmento muy corto, no una paráfrasis extensa.
- Devuelve únicamente JSON válido.

Usa esta estructura:

{
  "identificacion": {
    "fecha_nacimiento": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "sexo": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "edad": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    }
  },

  "diagnostico": {
    "diagnostico_funcional_odat": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "diagnostico_principal_cait": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "otros_diagnosticos": []
  },

  "salud": {
    "informacion_medica": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "antecedentes_personales": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "antecedentes_familiares": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "otros_datos_salud": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "centro_salud": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "seguimientos_especialistas": [],
    "medicacion": [],
    "alergias": []
  },

  "escolarizacion": {
    "centro": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "curso": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "modalidad": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "apoyos": []
  },

  "desarrollo_y_contexto": {
    "estado_fisico_general": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "aspectos_emocionales_menor": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "aspectos_emocionales_cuidadores": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "entorno_familiar": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "conducta": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "sociabilidad": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    }
  },

  "familia": {
    "preocupaciones_actuales": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "prioridades": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    }
  },

  "apoyo_profesional": {
    "profesional_referencia": {
      "valor": null,
      "confianza": "alta|media|baja",
      "evidencia": null
    },
    "profesionales": [],
    "intervenciones_externas": []
  },

  "evaluaciones": [],

  "objetivos": {
    "actuales": [],
    "conseguidos": [],
    "en_proceso": []
  },

  "informacion_adicional": []
}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: fileBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Gemini error:", errorText);

      return res.status(500).json({
        error: "Gemini no ha podido procesar el documento"
      });
    }

    const data = await response.json();

    const result =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!result) {
      return res.status(500).json({
        error: "Gemini no devolvió contenido"
      });
    }

    return res.status(200).json(JSON.parse(result));

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Error interno al analizar el documento"
    });
  }
}
