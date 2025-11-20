import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch, { Headers, Request, Response } from 'node-fetch';
import createError from '../utils/createError.js';

// Migración a Gemini v1: se inyecta fetch global para compatibilidad con el SDK en Node.
if (!globalThis.fetch) {
  globalThis.fetch = fetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
}

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';
const ENV_MODEL = process.env.GEMINI_MODEL;
// CORRECCIÓN: Usar nombres correctos de modelos con prefijo "models/"
const SUPPORTED_MODELS = [
  'models/gemini-2.0-flash-exp',
  'models/gemini-1.5-flash',
  'models/gemini-1.5-pro'
];
const RETRYABLE_STATUS = new Set([400, 401, 404, 429, 500, 503]);
const MAX_ATTEMPTS_PER_MODEL = 3;
const BASE_DELAY_MS = 1000;

let missingApiKeyLogged = false;
let invalidApiKeyLogged = false;

const generationConfig = {
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 2048,
};

const SYSTEM_PROMPT =
  'Sos un analista ESG senior que redacta reportes en español neutral, con foco en claridad ejecutiva.';

// Inicializar el cliente de Gemini
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;

function hasCredentials() {
  return Boolean(GEMINI_KEY);
}

export async function generateExecutiveSummary(context) {
  if (!ensureCredentials()) {
    return buildFallbackSummary(context, 'No se configuró API Key de Gemini.');
  }

  const prompt = buildPrompt(context, 'Resumen Ejecutivo');

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('[Gemini] Error generando resumen ejecutivo:', error);
    return buildFallbackSummary(
      context,
      'No se pudo generar el resumen con Gemini, se usó el plan de contingencia.',
    );
  }
}

export async function generateRecommendations(context) {
  if (!ensureCredentials()) {
    return buildFallbackSummary(context, 'Configura la API Key para recomendaciones con IA.', {
      recommendations: true,
    });
  }

  const prompt = buildPrompt(context, 'Recomendaciones de mejora', true);

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('[Gemini] Error generando recomendaciones:', error);
    return buildFallbackSummary(
      context,
      'No se pudo generar recomendaciones con Gemini, se devolvieron sugerencias locales.',
      { recommendations: true },
    );
  }
}

function buildPrompt(context, section, includeAlerts = false) {
  const { company, period, metrics, kpis } = context;
  const lines = [
    `Actuá como consultor ESG senior. Debés crear la sección "${section}" para el reporte ESG.`,
    `Empresa: ${company.name}. Rubro: ${company.industry ?? 'N/D'}. Periodo: ${period}.`,
    '',
    'Datos ambientales:',
    JSON.stringify(metrics.environmental ?? {}, null, 2),
    '',
    'Datos sociales:',
    JSON.stringify(metrics.social ?? {}, null, 2),
    '',
    'Datos de gobernanza:',
    JSON.stringify(metrics.governance ?? {}, null, 2),
    '',
    'KPIs agregados:',
    JSON.stringify(kpis ?? {}, null, 2),
  ];
  if (includeAlerts) {
    lines.push('', 'Detectá anomalías y sugerí acciones priorizadas.');
  }
  lines.push('', 'Respondé en español con viñetas claras y concretas.');
  return lines.join('\n');
}

async function callGemini(prompt) {
  if (!genAI) {
    throw createError(500, 'Cliente de Gemini no inicializado');
  }

  const models = buildModelPriority();
  let lastError;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
      try {
        // Obtener el modelo con la configuración
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig,
          systemInstruction: SYSTEM_PROMPT
        });

        // Generar contenido
        const result = await model.generateContent(prompt);
        
        // Validar que hay respuesta
        if (!result || !result.response) {
          throw new Error('Respuesta vacía de Gemini');
        }

        // Extraer el texto
        const response = result.response;
        const text = response.text();

        if (!text || !text.trim()) {
          throw new Error('Respuesta vacía de Gemini');
        }

        console.log(`[Gemini] ✓ Respuesta exitosa con ${modelName}`);
        return text.trim();
        
      } catch (error) {
        lastError = error;
        const { status, message } = extractGeminiError(error);
        const attemptLabel = `${attempt}/${MAX_ATTEMPTS_PER_MODEL}`;
        
        console.error(
          `[Gemini] Intento ${attemptLabel} con el modelo ${modelName} falló (${status ?? 'sin código'}): ${message}`,
        );

        if (status === 401 && !invalidApiKeyLogged) {
          console.error(
            '[Gemini] API Key inválida o expirada. Se utilizará el resumen local hasta corregir la credencial.',
          );
          invalidApiKeyLogged = true;
        }

        const shouldRetry = RETRYABLE_STATUS.has(status) && attempt < MAX_ATTEMPTS_PER_MODEL;
        if (!shouldRetry) {
          break;
        }

        const delayMs = BASE_DELAY_MS * attempt;
        await delay(delayMs);
      }
    }
  }

  throw createError(502, lastError?.message ?? 'Error desconocido al llamar a Gemini');
}

function buildModelPriority() {
  // Normalizar el modelo del env agregando prefijo si no lo tiene
  let normalizedEnvModel = ENV_MODEL;
  if (ENV_MODEL && !ENV_MODEL.startsWith('models/')) {
    normalizedEnvModel = `models/${ENV_MODEL}`;
  }

  if (normalizedEnvModel && SUPPORTED_MODELS.includes(normalizedEnvModel)) {
    return [normalizedEnvModel, ...SUPPORTED_MODELS.filter((model) => model !== normalizedEnvModel)];
  }
  
  if (ENV_MODEL && !SUPPORTED_MODELS.includes(normalizedEnvModel)) {
    console.warn(
      `[Gemini] Modelo ${ENV_MODEL} no reconocido. Se usarán modelos soportados: ${SUPPORTED_MODELS.join(', ')}`,
    );
  }
  
  return [...SUPPORTED_MODELS];
}

function ensureCredentials() {
  if (hasCredentials()) {
    return true;
  }

  if (!missingApiKeyLogged) {
    console.error(
      '[Gemini] Falta configurar GEMINI_API_KEY. Se usará buildFallbackSummary hasta que se proporcione una clave válida.',
    );
    missingApiKeyLogged = true;
  }
  return false;
}

function extractGeminiError(error) {
  const status =
    error?.status ??
    error?.response?.status ??
    error?.cause?.status ??
    error?.error?.status ??
    error?.statusCode ??
    null;
  const message =
    error?.message ??
    error?.response?.statusText ??
    error?.cause?.statusText ??
    error?.error?.message ??
    error?.response?.data?.error?.message ??
    'Falla desconocida';
  return { status, message };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildFallbackSummary(context, reason, options = {}) {
  const { company, period, metrics, kpis } = context;
  const environmental = metrics.environmental ?? {};
  const social = metrics.social ?? {};
  const governance = metrics.governance ?? {};

  const highlights = [];
  if (environmental.emisionesCO2 != null) {
    highlights.push(`Emisiones totales: ${environmental.emisionesCO2} t CO₂e.`);
  }
  if (environmental.porcentajeRenovable != null) {
    highlights.push(`Energía renovable: ${environmental.porcentajeRenovable}% del mix.`);
  }
  if (social.porcentajeMujeres != null) {
    highlights.push(`Mujeres en liderazgo: ${social.porcentajeMujeres}%.`);
  }
  if (governance.cumplimientoNormativo != null) {
    highlights.push(`Cumplimiento normativo: ${governance.cumplimientoNormativo}%.`);
  }
  if (social.inversionComunidadUsd != null) {
    highlights.push(`Inversión social: USD ${social.inversionComunidadUsd}.`);
  }

  const recommendations = [];
  if (options.recommendations) {
    if (
      environmental.porcentajeRenovable != null &&
      environmental.porcentajeRenovable < 50
    ) {
      recommendations.push(
        'Incrementar contratos de energía renovable hasta alcanzar al menos 50% del consumo.',
      );
    }
    if (environmental.emisionesCO2 != null && environmental.emisionesCO2 > 0) {
      recommendations.push(
        'Diseñar hoja de ruta de descarbonización con metas interanuales y compensaciones verificadas.',
      );
    }
    if (social.tasaRotacion != null && social.tasaRotacion > 15) {
      recommendations.push(
        'Implementar planes de retención de talento y bienestar integral para reducir la rotación.',
      );
    }
    if (governance.reporteSostenibilidadVerificado === false) {
      recommendations.push(
        'Gestionar verificación externa del informe ESG para fortalecer la transparencia.',
      );
    }
    if (!recommendations.length) {
      recommendations.push(
        'Mantener el plan ESG actual y revisar hitos trimestrales con el comité de sostenibilidad.',
      );
    }
  }

  const lines = [
    `Resumen generado localmente para ${company.name} (${period}).`,
    `Motivo: ${reason}`,
    highlights.length ? 'Indicadores clave:' : null,
    ...highlights.map((item) => `• ${item}`),
  ];

  if (kpis?.compositeScore != null) {
    lines.push(`Índice ESG consolidado: ${kpis.compositeScore}.`);
  }
  if (options.recommendations) {
    lines.push('Recomendaciones inmediatas:');
    recommendations.forEach((item) => lines.push(`• ${item}`));
  }

  lines.push('Fuente: análisis local EcoMind (modo sin conexión).');
  return lines.filter(Boolean).join('\n');
}