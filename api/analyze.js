import { createRemoteJWKSet, jwtVerify } from "jose";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_DOCUMENT_TEXT_LENGTH = 250000;
const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "piat-assistant";
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "12mb"
    }
  }
};

async function authenticateRequest(req) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID
    });

    return payload.sub ? payload : null;
  } catch (error) {
    console.warn("Firebase token verification failed:", error.message);
    return null;
  }
}

function isValidBase64(value) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function hasPdfSignature(base64Value) {
  return Buffer.from(base64Value, "base64").subarray(0, 5).toString("ascii") === "%PDF-";
}

function hasExpectedExtractionShape(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.identificacion &&
    value.diagnostico &&
    value.salud
  );
}

export function hasPrivacyConfirmation(value) {
  return value === true;
}

export function getAnalysisInputKind({ fileBase64, documentText } = {}) {
  const hasPdf = typeof fileBase64 === "string" && fileBase64.length > 0;
  const hasAnonymizedText = typeof documentText === "string" && documentText.trim().length > 0;
  if (hasPdf === hasAnonymizedText) return null;
  return hasPdf ? "pdf" : "anonymized_text";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    const authenticatedUser = await authenticateRequest(req);

    if (!authenticatedUser) {
      return res.status(401).json({
        error: "Sesión no válida o caducada"
      });
    }

    const { fileBase64, documentText, mimeType, privacyConfirmed } = req.body || {};

    if (!hasPrivacyConfirmation(privacyConfirmed)) {
      return res.status(400).json({
        error: "Debes confirmar que el documento está anonimizado"
      });
    }

    const inputKind = getAnalysisInputKind({ fileBase64, documentText });
    const hasPdf = inputKind === "pdf";
    const hasAnonymizedText = inputKind === "anonymized_text";

    if (!inputKind || !mimeType) {
      return res.status(400).json({
        error: "Debes enviar un PDF o texto anonimizado, pero no ambos"
      });
    }

    if (hasAnonymizedText && mimeType !== DOCX_MIME_TYPE) {
      return res.status(415).json({
        error: "Tipo de documento no admitido"
      });
    }

    if (hasAnonymizedText && documentText.length > MAX_DOCUMENT_TEXT_LENGTH) {
      return res.status(413).json({
        error: "El texto anonimizado es demasiado largo"
      });
    }

    if (hasPdf) {
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return res.status(415).json({ error: "Tipo de documento no admitido" });
      }
      if (!isValidBase64(fileBase64)) {
        return res.status(400).json({ error: "El contenido del archivo no es válido" });
      }
      if (!hasPdfSignature(fileBase64)) {
        return res.status(400).json({ error: "El archivo no contiene un PDF válido" });
      }
      if (Buffer.byteLength(fileBase64, "base64") > MAX_FILE_SIZE_BYTES) {
        return res.status(413).json({ error: "El documento supera el límite de 8 MB" });
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured");
      return res.status(500).json({
        error: "El servicio de análisis no está configurado"
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
          contents: [{
            parts: hasAnonymizedText
              ? [
                  { text: prompt },
                  { text: `TEXTO ANONIMIZADO DEL DOCUMENTO:\n\n${documentText.trim()}` }
                ]
              : [
                  { text: prompt },
                  { inlineData: { mimeType, data: fileBase64 } }
                ]
          }],
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

    let parsedResult;

    try {
      parsedResult = JSON.parse(result);
    } catch (error) {
      console.error("Gemini returned invalid JSON:", error.message);
      return res.status(502).json({
        error: "Gemini devolvió una respuesta no válida"
      });
    }

    if (!hasExpectedExtractionShape(parsedResult)) {
      console.error("Gemini returned an unexpected extraction shape");
      return res.status(502).json({
        error: "Gemini devolvió una estructura inesperada"
      });
    }

    return res.status(200).json(parsedResult);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Error interno al analizar el documento"
    });
  }
}
