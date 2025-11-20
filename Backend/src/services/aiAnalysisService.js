import path from 'path';
import { Buffer } from 'node:buffer';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import xlsx from 'xlsx';
import { parse as parseCsv } from 'csv-parse/sync';
import { createWorker } from 'tesseract.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch, { Headers, Request, Response } from 'node-fetch';

import createError from '../utils/createError.js';
import {
  createAiInsightRecord,
  deleteAiInsight,
  listAiInsights,
} from '../repositories/aiInsightRepository.js';

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.txt',
  '.csv',
  '.tsv',
  '.xlsx',
  '.xls',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
]);

const MAX_TEXT_LENGTH = 15000;

const CATEGORY_KEYWORDS = {
  Ambiental: [
    'ambient',
    'energia',
    'emision',
    'emisiones',
    'co2',
    'carbono',
    'huella',
    'agua',
    'residuo',
    'residuos',
    'recicl',
    'biodiversidad',
    'clima',
  ],
  Social: [
    'emple',
    'empleados',
    'diversidad',
    'inclusion',
    'capacitación',
    'capacitacion',
    'seguridad',
    'salud',
    'comunidad',
    'voluntariado',
    'talento',
    'equidad',
  ],
  Gobernanza: [
    'compliance',
    'etica',
    'ética',
    'transparencia',
    'directorio',
    'gobierno',
    'riesgo',
    'anticorrupcion',
    'anticorrupción',
    'auditoria',
    'auditoría',
    'politica',
    'normativo',
  ],
};

const INDICATOR_CONFIG = {
  energiaKwh: { labels: ['energia', 'eléctrica', 'electrica', 'kwh'] },
  intensidadEnergetica: { labels: ['intensidad energética', 'intensidad energetica'] },
  porcentajeRenovable: { labels: ['renovable', 'energía renovable'] },
  emisionesCO2: { labels: ['emisiones co2', 'huella de carbono', 'co₂'] },
  emisionesAlcance1: { labels: ['alcance 1'] },
  emisionesAlcance2: { labels: ['alcance 2'] },
  emisionesAlcance3: { labels: ['alcance 3'] },
  aguaM3: { labels: ['consumo de agua', 'agua (m3)', 'agua m3'] },
  aguaRecicladaPorc: { labels: ['agua reciclada'] },
  aguaReutilizadaPorc: { labels: ['agua reutilizada'] },
  residuosPeligrososTon: { labels: ['residuos peligrosos'] },
  reciclajePorc: { labels: ['tasa de reciclaje', 'reciclaje %'] },
  residuosValorizadosPorc: { labels: ['residuos valorizados'] },
  incidentesAmbientales: { labels: ['incidentes ambientales'] },
  sancionesAmbientales: { labels: ['sanciones ambientales'] },
  auditoriasAmbientales: { labels: ['auditorías ambientales', 'auditorias ambientales'] },
  porcentajeMujeres: { labels: ['participación femenina', 'porcentaje mujeres'] },
  diversidadGeneroPorc: { labels: ['diversidad de género', 'diversidad genero'] },
  horasCapacitacion: { labels: ['horas de capacitación', 'horas capacitacion'] },
  horasVoluntariado: { labels: ['horas voluntariado'] },
  accidentesLaborales: { labels: ['accidentes laborales'] },
  tasaFrecuenciaAccidentes: { labels: ['tasa de frecuencia'] },
  tasaRotacion: { labels: ['tasa de rotación', 'rotación de personal'] },
  indiceSatisfaccion: { labels: ['índice de satisfacción', 'indice de satisfaccion'] },
  proveedoresLocalesPorc: { labels: ['proveedores locales'] },
  inversionComunidadUsd: { labels: ['inversión en comunidad', 'inversion en comunidad'] },
  programasBienestarActivos: { labels: ['programas de bienestar'] },
  satisfaccionClientesPorc: { labels: ['satisfacción de clientes', 'satisfaccion clientes'] },
  capacitacionDerechosHumanosPorc: { labels: ['capacitación en derechos humanos'] },
  cumplimientoNormativo: { labels: ['cumplimiento normativo'] },
  politicasAnticorrupcion: { labels: ['políticas anticorrupción', 'politicas anticorrupcion'] },
  auditadoPorTerceros: { labels: ['auditorías externas', 'auditorias externas'] },
  nivelTransparencia: { labels: ['nivel de transparencia'] },
  porcentajeDirectoresIndependientes: { labels: ['directores independientes'] },
  diversidadDirectorioPorc: { labels: ['diversidad del directorio'] },
  comiteSostenibilidad: { labels: ['comité de sostenibilidad', 'comite de sostenibilidad'] },
  evaluacionEticaAnual: { labels: ['evaluación ética anual', 'evaluacion etica anual'] },
  reunionesStakeholders: { labels: ['reuniones con stakeholders', 'reuniones stakeholders'] },
  canalDenunciasActivo: { labels: ['canal de denuncias'] },
  politicaRemuneracionEsg: { labels: ['remuneración ligada a esg', 'remuneracion ligada a esg'] },
  evaluacionRiesgosEsgTrimestral: { labels: ['evaluación de riesgos esg', 'evaluacion de riesgos esg'] },
  capacitacionGobiernoEsgPorc: { labels: ['capacitación esg en gobierno', 'capacitacion esg en gobierno'] },
  auditoriasCompliance: { labels: ['auditorías de compliance', 'auditorias de compliance'] },
  reporteSostenibilidadVerificado: { labels: ['reporte verificado', 'verificación externa'] },
};

const INDICATOR_LABELS = {
  energiaKwh: 'Consumo energético (kWh)',
  intensidadEnergetica: 'Intensidad energética',
  porcentajeRenovable: 'Participación renovable',
  emisionesCO2: 'Emisiones de CO₂e',
  emisionesAlcance1: 'Emisiones alcance 1',
  emisionesAlcance2: 'Emisiones alcance 2',
  emisionesAlcance3: 'Emisiones alcance 3',
  aguaM3: 'Consumo de agua (m³)',
  aguaRecicladaPorc: 'Agua reciclada %',
  aguaReutilizadaPorc: 'Agua reutilizada %',
  residuosPeligrososTon: 'Residuos peligrosos (t)',
  reciclajePorc: 'Tasa de reciclaje %',
  residuosValorizadosPorc: 'Residuos valorizados %',
  incidentesAmbientales: 'Incidentes ambientales',
  sancionesAmbientales: 'Sanciones ambientales',
  auditoriasAmbientales: 'Auditorías ambientales',
  porcentajeMujeres: 'Participación femenina %',
  diversidadGeneroPorc: 'Diversidad de género %',
  horasCapacitacion: 'Horas de capacitación',
  horasVoluntariado: 'Horas de voluntariado',
  accidentesLaborales: 'Accidentes laborales',
  tasaFrecuenciaAccidentes: 'Tasa de frecuencia de accidentes',
  tasaRotacion: 'Tasa de rotación %',
  indiceSatisfaccion: 'Índice de satisfacción %',
  proveedoresLocalesPorc: 'Proveedores locales %',
  inversionComunidadUsd: 'Inversión en comunidad (USD)',
  programasBienestarActivos: 'Programas de bienestar activos',
  satisfaccionClientesPorc: 'Satisfacción de clientes %',
  capacitacionDerechosHumanosPorc: 'Capacitación en DD.HH. %',
  cumplimientoNormativo: 'Cumplimiento normativo %',
  politicasAnticorrupcion: 'Políticas anticorrupción',
  auditadoPorTerceros: 'Auditorías externas',
  nivelTransparencia: 'Nivel de transparencia %',
  porcentajeDirectoresIndependientes: 'Directores independientes %',
  diversidadDirectorioPorc: 'Diversidad del directorio %',
  comiteSostenibilidad: 'Comité de sostenibilidad',
  evaluacionEticaAnual: 'Evaluación ética anual',
  reunionesStakeholders: 'Reuniones con stakeholders',
  canalDenunciasActivo: 'Canal de denuncias activo',
  politicaRemuneracionEsg: 'Remuneración ligada a ESG',
  evaluacionRiesgosEsgTrimestral: 'Evaluación trimestral de riesgos ESG',
  capacitacionGobiernoEsgPorc: 'Capacitación ESG en gobierno %',
  auditoriasCompliance: 'Auditorías de compliance',
  reporteSostenibilidadVerificado: 'Reporte verificado externamente',
};

const INDICATOR_PILLAR = {
  energiaKwh: 'environmental',
  intensidadEnergetica: 'environmental',
  porcentajeRenovable: 'environmental',
  emisionesCO2: 'environmental',
  emisionesAlcance1: 'environmental',
  emisionesAlcance2: 'environmental',
  emisionesAlcance3: 'environmental',
  aguaM3: 'environmental',
  aguaRecicladaPorc: 'environmental',
  aguaReutilizadaPorc: 'environmental',
  residuosPeligrososTon: 'environmental',
  reciclajePorc: 'environmental',
  residuosValorizadosPorc: 'environmental',
  incidentesAmbientales: 'environmental',
  sancionesAmbientales: 'environmental',
  auditoriasAmbientales: 'environmental',
  porcentajeMujeres: 'social',
  diversidadGeneroPorc: 'social',
  horasCapacitacion: 'social',
  horasVoluntariado: 'social',
  accidentesLaborales: 'social',
  tasaFrecuenciaAccidentes: 'social',
  tasaRotacion: 'social',
  indiceSatisfaccion: 'social',
  proveedoresLocalesPorc: 'social',
  inversionComunidadUsd: 'social',
  programasBienestarActivos: 'social',
  satisfaccionClientesPorc: 'social',
  capacitacionDerechosHumanosPorc: 'social',
  cumplimientoNormativo: 'governance',
  politicasAnticorrupcion: 'governance',
  auditadoPorTerceros: 'governance',
  nivelTransparencia: 'governance',
  porcentajeDirectoresIndependientes: 'governance',
  diversidadDirectorioPorc: 'governance',
  comiteSostenibilidad: 'governance',
  evaluacionEticaAnual: 'governance',
  reunionesStakeholders: 'governance',
  canalDenunciasActivo: 'governance',
  politicaRemuneracionEsg: 'governance',
  evaluacionRiesgosEsgTrimestral: 'governance',
  capacitacionGobiernoEsgPorc: 'governance',
  auditoriasCompliance: 'governance',
  reporteSostenibilidadVerificado: 'governance',
};

export async function parseEvidenceFile(file) {
  validateFile(file);
  return extractFileContent(file);
}

export async function analyzeContentBlock({ text, structuredData }) {
  const baseText = typeof text === 'string' ? text : '';
  return analyzeTextContent(baseText, structuredData);
}

export function normalizeIndicatorValue(value) {
  return normalizeNumericValue(value);
}

export function resolveIndicatorKeyFromLabel(label) {
  if (!label) {
    return null;
  }
  const normalized = String(label).toLowerCase();
  for (const [key, config] of Object.entries(INDICATOR_CONFIG)) {
    if (config.labels.some((candidate) => normalized.includes(candidate.toLowerCase()))) {
      return key;
    }
  }
  return null;
}

export function resolvePillarFromIndicator(indicator) {
  return INDICATOR_PILLAR[indicator] ?? null;
}

export function listSupportedIndicators() {
  return Object.keys(INDICATOR_CONFIG);
}

export function getIndicatorDictionary() {
  return { ...INDICATOR_LABELS };
}

export function validateEvidenceFile(file) {
  validateFile(file);
}

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = process.env.GEMINI_ANALYSIS_MODEL ?? 'models/gemini-1.5-flash';

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
}

let geminiClient = null;
let ocrWorkerPromise;

export async function analyzeEvidenceFiles({ files, companyId, period }) {
  if (!Array.isArray(files) || files.length === 0) {
    throw createError(400, 'Debes adjuntar al menos un archivo para analizar.');
  }

  const numericCompanyId = Number(companyId);
  if (!Number.isFinite(numericCompanyId)) {
    throw createError(400, 'companyId inválido.');
  }

  const results = [];

  for (const file of files) {
    try {
      validateFile(file);
      const extraction = await extractFileContent(file);
      if (!extraction?.text || !extraction.text.trim()) {
        throw new Error('No se pudo extraer texto legible del archivo.');
      }

      const analysis = await analyzeTextContent(extraction.text, extraction.structuredData);
      const stored = await createAiInsightRecord({
        companyId: numericCompanyId,
        period,
        category: analysis.category,
        summary: analysis.summary,
        indicators: analysis.indicators,
        fileName: file.originalname,
        fileType: extraction.type,
        mimeType: file.mimetype,
        rawText: truncateText(extraction.text),
      });

      console.info(
        `[AI] ${file.originalname} analizado como ${stored.category}. Indicadores detectados: ${Object.keys(
          analysis.indicators ?? {},
        ).length}.`,
      );

      results.push({
        fileName: file.originalname,
        status: 'processed',
        category: stored.category,
        summary: stored.summary,
        indicators: stored.indicators,
        insightId: stored.id,
        analyzedAt: stored.analyzedAt,
      });
    } catch (error) {
      console.error(`[AI] Error procesando ${file?.originalname ?? 'archivo'}`, error);
      results.push({
        fileName: file?.originalname ?? 'Archivo',
        status: 'failed',
        error: error.message ?? 'No se pudo analizar el archivo.',
      });
    }
  }

  return results;
}

export async function listInsightsForReport({ companyId, period }) {
  if (!companyId) {
    return [];
  }
  return listAiInsights({ companyId, period });
}

export async function removeInsight(id, companyId) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    throw createError(400, 'Identificador inválido.');
  }
  const removed = await deleteAiInsight(numericId, companyId ? Number(companyId) : undefined);
  if (!removed) {
    throw createError(404, 'Registro de IA no encontrado.');
  }
  return removed;
}

export function integrateInsightsIntoMetrics(metrics = {}, insights = []) {
  if (!Array.isArray(insights) || insights.length === 0) {
    return {
      metrics,
      summary: null,
    };
  }

  const cloned = {
    ...metrics,
    environmental: { ...(metrics?.environmental ?? {}) },
    social: { ...(metrics?.social ?? {}) },
    governance: { ...(metrics?.governance ?? {}) },
  };

  const aggregated = {
    environmental: {},
    social: {},
    governance: {},
  };

  insights.forEach((insight) => {
    const indicators = insight?.indicators ?? {};
    Object.entries(indicators).forEach(([key, value]) => {
      if (value == null || value === '') {
        return;
      }
      const pillar = INDICATOR_PILLAR[key];
      if (!pillar) {
        return;
      }
      if (!aggregated[pillar][key]) {
        aggregated[pillar][key] = [];
      }
      const numeric = normalizeNumericValue(value);
      if (numeric != null) {
        aggregated[pillar][key].push(numeric);
      }
    });
  });

  Object.entries(aggregated).forEach(([pillar, indicators]) => {
    Object.entries(indicators).forEach(([key, values]) => {
      if (!Array.isArray(values) || values.length === 0) {
        return;
      }
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      if (cloned[pillar][key] == null || cloned[pillar][key] === '') {
        cloned[pillar][key] = Number(average.toFixed(2));
      }
    });
  });

  const summary = buildInsightSummary(insights);

  return {
    metrics: cloned,
    summary,
  };
}

export function buildInsightSummary(insights = []) {
  if (!Array.isArray(insights) || insights.length === 0) {
    return null;
  }
  const grouped = insights.reduce((acc, insight) => {
    const category = insight?.category ?? 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    if (insight?.summary) {
      acc[category].push(insight.summary);
    }
    return acc;
  }, {});

  const parts = Object.entries(grouped).map(([category, summaries]) => {
    const text = summaries.join(' ');
    return `${category}: ${text}`;
  });

  return parts.join(' ');
}

async function analyzeTextContent(text, structuredData) {
  const truncated = truncateText(text);
  const structuredIndicators = extractIndicatorsFromStructuredData(structuredData);
  const textIndicators = extractIndicatorsFromText(truncated);
  const combinedIndicators = mergeIndicatorObjects(textIndicators, structuredIndicators);

  let category = classifyByKeywords(truncated);
  let summary = buildLocalSummary(category, combinedIndicators);

  const geminiResult = await runGeminiAnalysis(truncated);
  if (geminiResult) {
    category = geminiResult.category ?? category;
    if (geminiResult.summary) {
      summary = geminiResult.summary;
    }
    if (geminiResult.indicators) {
      Object.assign(combinedIndicators, mergeIndicatorObjects(combinedIndicators, geminiResult.indicators));
    }
  }

  if (!summary) {
    summary = 'Se identificó información relevante para los indicadores ESG seleccionados.';
  }

  return {
    category,
    summary,
    indicators: combinedIndicators,
  };
}

function validateFile(file) {
  if (!file) {
    throw createError(400, 'Archivo inválido.');
  }
  const extension = path.extname(file.originalname ?? '').toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw createError(415, `Tipo de archivo no soportado (${extension || 'desconocido'}).`);
  }
  if (file.size && file.size > 35 * 1024 * 1024) {
    throw createError(413, 'El archivo supera el tamaño máximo permitido (35 MB).');
  }
}

async function extractFileContent(file) {
  const extension = path.extname(file.originalname ?? '').toLowerCase();
  const buffer = ensureBuffer(file.buffer);

  if (extension === '.pdf') {
    return {
      type: 'pdf',
      text: await extractTextFromPdf(buffer),
    };
  }
  if (extension === '.docx') {
    return {
      type: 'docx',
      text: await extractTextFromDocx(buffer),
    };
  }
  if (extension === '.txt' || extension === '.json') {
    return {
      type: extension === '.json' ? 'json' : 'texto',
      text: buffer.toString('utf8'),
    };
  }
  if (extension === '.csv' || extension === '.tsv') {
    const { text, structuredData } = extractFromCsv(buffer, extension === '.tsv');
    return {
      type: 'csv',
      text,
      structuredData,
    };
  }
  if (extension === '.xlsx' || extension === '.xls') {
    const { text, structuredData } = extractFromWorkbook(buffer);
    return {
      type: 'excel',
      text,
      structuredData,
    };
  }
  if (extension === '.png' || extension === '.jpg' || extension === '.jpeg') {
    return {
      type: 'imagen',
      text: await extractFromImage(buffer),
    };
  }

  return {
    type: 'desconocido',
    text: buffer.toString('utf8'),
  };
}

async function extractTextFromPdf(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text ?? '';
  } catch (error) {
    console.error('[AI] Error al leer PDF', error);
    throw new Error('No se pudo leer el PDF proporcionado.');
  }
}

async function extractTextFromDocx(buffer) {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    return value ?? '';
  } catch (error) {
    console.error('[AI] Error al leer DOCX', error);
    throw new Error('No se pudo leer el archivo Word proporcionado.');
  }
}

function extractFromCsv(buffer, isTsv = false) {
  try {
    const content = buffer.toString('utf8');
    const structuredData = parseCsv(content, {
      columns: true,
      skip_empty_lines: true,
      delimiter: isTsv ? '\t' : ',',
    });
    const text = structuredData.map((row) => JSON.stringify(row)).join('\n');
    return { text, structuredData };
  } catch (error) {
    console.error('[AI] Error al leer CSV/TSV', error);
    throw new Error('No se pudo analizar el archivo tabular proporcionado.');
  }
}

function extractFromWorkbook(buffer) {
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const structuredData = [];
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
      rows.forEach((row) => {
        structuredData.push({ __sheet: sheetName, ...row });
      });
    });
    const text = structuredData.map((row) => JSON.stringify(row)).join('\n');
    return { text, structuredData };
  } catch (error) {
    console.error('[AI] Error al leer Excel', error);
    throw new Error('No se pudo analizar el archivo Excel proporcionado.');
  }
}

async function extractFromImage(buffer) {
  try {
    const worker = await getOcrWorker();
    const { data } = await worker.recognize(buffer);
    return data?.text ?? '';
  } catch (error) {
    console.error('[AI] Error realizando OCR', error);
    return '';
  }
}

async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const worker = await createWorker();
      await worker.load();
      try {
        await worker.loadLanguage('spa+eng');
        await worker.initialize('spa+eng');
      } catch (error) {
        console.warn('[AI] No se pudo cargar el paquete spa+eng para OCR, se utilizará inglés.', error);
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
      }
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

function classifyByKeywords(text) {
  if (!text) {
    return 'Ambiental';
  }
  const lower = text.toLowerCase();
  let bestCategory = 'Ambiental';
  let bestScore = 0;

  Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
    let score = 0;
    keywords.forEach((keyword) => {
      const regex = new RegExp(escapeRegExp(keyword), 'g');
      const matches = lower.match(regex);
      if (matches) {
        score += matches.length;
      }
    });
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  });

  return bestCategory;
}

function extractIndicatorsFromText(text) {
  if (!text) {
    return {};
  }
  const lower = text.toLowerCase();
  const indicators = {};

  Object.entries(INDICATOR_CONFIG).forEach(([key, config]) => {
    for (const label of config.labels) {
      const index = lower.indexOf(label.toLowerCase());
      if (index === -1) {
        continue;
      }
      const snippet = lower.slice(index, index + 120);
      const match = snippet.match(/(-?[0-9]+[\.,]?[0-9]*)/);
      if (match) {
        const value = normalizeNumericValue(match[0]);
        if (value != null) {
          indicators[key] = value;
          break;
        }
      }
    }
  });

  return indicators;
}

function extractIndicatorsFromStructuredData(structuredData) {
  if (!Array.isArray(structuredData) || structuredData.length === 0) {
    return {};
  }
  const indicators = {};

  structuredData.forEach((row) => {
    Object.entries(row).forEach(([column, value]) => {
      if (value == null || value === '') {
        return;
      }
      const normalizedColumn = String(column).toLowerCase();
      Object.entries(INDICATOR_CONFIG).forEach(([key, config]) => {
        if (config.labels.some((label) => normalizedColumn.includes(label.toLowerCase()))) {
          const numeric = normalizeNumericValue(value);
          if (numeric != null) {
            indicators[key] = numeric;
          }
        }
      });
    });
  });

  return indicators;
}

function mergeIndicatorObjects(base = {}, extra = {}) {
  const merged = { ...base };
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value == null || value === '') {
      return;
    }
    const numeric = normalizeNumericValue(value);
    merged[key] = numeric != null ? numeric : value;
  });
  return merged;
}

function buildLocalSummary(category, indicators) {
  const entries = Object.entries(indicators ?? {})
    .filter(([, value]) => value != null)
    .slice(0, 3)
    .map(([key, value]) => {
      const label = INDICATOR_LABELS[key] ?? key;
      return `${label}: ${formatIndicatorValue(value)}`;
    });

  if (entries.length === 0) {
    return `Se detectó información ${category.toLowerCase()} relevante para el reporte.`;
  }

  return `Se detectó información ${category.toLowerCase()} con métricas destacadas ${entries.join(', ')}.`;
}

async function runGeminiAnalysis(text) {
  if (!text || !GEMINI_KEY) {
    return null;
  }

  try {
    if (!geminiClient) {
      geminiClient = new GoogleGenerativeAI(GEMINI_KEY);
    }
    const model = geminiClient.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = `Actúa como analista ESG senior. Clasifica el siguiente contenido en las categorías Ambiental, Social o Gobernanza. Devuelve la respuesta en JSON con las claves "category", "summary" e "indicators" (objeto con métricas extraídas numéricas si existen). Texto a analizar:\n"""${text}\n"""`;
    const result = await model.generateContent(prompt);
    const rawText = result?.response?.text?.();
    if (!rawText) {
      return null;
    }
    const parsed = safeParseJson(rawText);
    if (!parsed) {
      return null;
    }
    const normalizedIndicators = mergeIndicatorObjects({}, parsed.indicators ?? {});
    return {
      category: parsed.category ?? parsed.categoria ?? parsed.Categoria,
      summary: parsed.summary ?? parsed.resumen,
      indicators: normalizedIndicators,
    };
  } catch (error) {
    console.warn('[AI] Gemini no disponible, se utilizará análisis heurístico.', error);
    return null;
  }
}

function normalizeNumericValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const sanitized = value.replace(/%/g, '').replace(/,/g, '.');
  const parsed = Number.parseFloat(sanitized);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function formatIndicatorValue(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return String(value);
}

function safeParseJson(text) {
  try {
    const trimmed = text.trim();
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
      return null;
    }
    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
  } catch (error) {
    return null;
  }
}

function truncateText(text) {
  if (!text) {
    return '';
  }
  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_TEXT_LENGTH)}...`;
}

function ensureBuffer(input) {
  if (!input) {
    return Buffer.alloc(0);
  }
  return Buffer.isBuffer(input) ? input : Buffer.from(input);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

