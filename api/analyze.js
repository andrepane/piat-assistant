export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: "Falta el contenido a analizar"
      });
    }

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
                  text: `
Analiza el siguiente contenido clínico anonimizado.

No inventes información.
Si un dato no aparece, indícalo como null.

Devuelve únicamente JSON válido con esta estructura:

{
  "nombre": null,
  "fecha_nacimiento": null,
  "diagnostico": null,
  "antecedentes_personales": null,
  "antecedentes_familiares": null,
  "escolarizacion": null,
  "estado_fisico_general": null,
  "conducta": null,
  "sociabilidad": null,
  "preocupaciones_familia": null
}

DOCUMENTO:

${text}
                  `
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
      const error = await response.text();
      console.error(error);

      return res.status(500).json({
        error: "Gemini no ha podido procesar la solicitud"
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
