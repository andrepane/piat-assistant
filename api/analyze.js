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

No inventes información.
Si un dato no aparece, devuelve null.
No deduzcas diagnósticos no escritos explícitamente.
Conserva la información clínica relevante.

Devuelve únicamente JSON válido con esta estructura:

{
  "identificacion": {
    "fecha_nacimiento": null,
    "sexo": null,
    "edad": null
  },

  "diagnostico": {
    "diagnostico_funcional_odat": null,
    "diagnostico_principal_cait": null,
    "otros_diagnosticos": []
  },

  "salud": {
    "informacion_medica": null,
    "antecedentes_personales": null,
    "antecedentes_familiares": null,
    "otros_datos_salud": null,
    "centro_salud": null,
    "seguimientos_especialistas": [],
    "medicacion": [],
    "alergias": []
  },

  "escolarizacion": {
    "centro": null,
    "curso": null,
    "modalidad": null,
    "apoyos": []
  },

  "desarrollo_y_contexto": {
    "estado_fisico_general": null,
    "aspectos_emocionales_menor": null,
    "aspectos_emocionales_cuidadores": null,
    "entorno_familiar": null,
    "conducta": null,
    "sociabilidad": null
  },

  "familia": {
    "preocupaciones_actuales": null,
    "prioridades": null
  },

  "apoyo_profesional": {
    "profesional_referencia": null,
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
                {
                  text: prompt
                },
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

    return res.status(200).json(
      JSON.parse(result)
    );

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Error interno al analizar el documento"
    });
  }
}
