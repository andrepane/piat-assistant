import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  hasExpectedReportShape,
  PIAT_REVISION_SECTIONS,
  REPORT_TYPE
} from "../src/report-model.js";
import { buildPiatRevisionReportPrompt } from "../src/report-writing-guides.js";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "piat-assistant";
const MAX_CONTEXT_LENGTH = 500000;
const GEMINI_REPORT_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
const GEMINI_MAX_ATTEMPTS = 3;
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

async function authenticateRequest(req) {
  const match = (req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
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

export function isSupportedReportRequest(type, context) {
  if (type !== REPORT_TYPE.PIAT_REVISION || !context || typeof context !== "object") return false;
  const serialized = JSON.stringify(context);
  return serialized.length > 2 && serialized.length <= MAX_CONTEXT_LENGTH;
}

export function isRetryableGeminiStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function getGeminiReportError(status) {
  if (status === 429) {
    return {
      status: 429,
      code: "GEMINI_RATE_LIMIT",
      error: "Gemini ha alcanzado temporalmente su límite de uso. Espera un minuto y vuelve a intentarlo."
    };
  }
  if (status === 503 || status === 500 || status === 502 || status === 504) {
    return {
      status: 503,
      code: "GEMINI_TEMPORARILY_UNAVAILABLE",
      error: "Gemini está temporalmente saturado. Vuelve a intentarlo dentro de unos minutos."
    };
  }
  if (status === 401 || status === 403) {
    return {
      status: 500,
      code: "GEMINI_CONFIGURATION_ERROR",
      error: "Gemini ha rechazado la configuración del servicio. Revisa la API key en Vercel."
    };
  }
  return {
    status: 502,
    code: "GEMINI_REQUEST_FAILED",
    error: "Gemini ha rechazado la generación del informe. Inténtalo de nuevo."
  };
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestGeminiReport(body) {
  let response;
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
    response = await fetch(GEMINI_REPORT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body
    });
    if (response.ok || !isRetryableGeminiStatus(response.status) || attempt === GEMINI_MAX_ATTEMPTS) {
      return response;
    }
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const backoff = Number.isFinite(retryAfterSeconds)
      ? Math.min(retryAfterSeconds * 1000, 5000)
      : 750 * (2 ** (attempt - 1));
    console.warn(`Gemini report attempt ${attempt} failed with ${response.status}; retrying.`);
    await wait(backoff);
  }
  return response;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  try {
    if (!(await authenticateRequest(req))) {
      return res.status(401).json({ error: "Sesión no válida o caducada" });
    }
    const { type, context } = req.body || {};
    if (!isSupportedReportRequest(type, context)) {
      return res.status(400).json({ error: "Los datos del informe no son válidos" });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "El servicio de generación no está configurado" });
    }

    const sectionSchema = PIAT_REVISION_SECTIONS.map(([id, titulo]) => ({
      id,
      titulo,
      contenido: ""
    }));
    const prompt = buildPiatRevisionReportPrompt(PIAT_REVISION_SECTIONS, sectionSchema);

    const response = await requestGeminiReport(JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { text: `CONTEXTO CLÍNICO ANONIMIZADO:\n${JSON.stringify(context)}` }
      ] }],
      generationConfig: { responseMimeType: "application/json" }
    }));
    if (!response.ok) {
      const upstreamError = await response.text();
      const reportError = getGeminiReportError(response.status);
      console.error(`Gemini report error (${response.status}):`, upstreamError);
      return res.status(reportError.status).json({
        error: reportError.error,
        code: reportError.code,
        retryable: isRetryableGeminiStatus(response.status)
      });
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ error: "Gemini no devolvió contenido" });
    let report;
    try {
      report = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "Gemini devolvió un informe no válido" });
    }
    if (!hasExpectedReportShape(report)) {
      return res.status(502).json({ error: "Gemini devolvió una estructura de informe inesperada" });
    }
    return res.status(200).json(report);
  } catch (error) {
    console.error("Report generation failed:", error);
    return res.status(500).json({ error: "Error interno al generar el informe" });
  }
}
