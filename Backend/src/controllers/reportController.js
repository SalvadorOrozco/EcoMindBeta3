import axios from 'axios';
import { getCompanyById } from '../repositories/companyRepository.js';
import {
  getHistoricalSummary,
  getMetricsByPeriod,
  getMetricsForCompany,
} from '../repositories/metricRepository.js';
import { buildPlantReport } from '../services/plantReportService.js';
import { buildPlantReportPdf, buildReportPdf } from '../services/pdfService.js';
import { generateExecutiveSummary, generateRecommendations } from '../services/aiService.js';
import { calculateKpis } from '../utils/kpi.js';
import createError from '../utils/createError.js';
import { resolveCompanyIdFromRequest } from '../utils/companyAccess.js';
import { withControllerErrorHandling } from '../utils/controllerErrorHandler.js';
import { integrateInsightsIntoMetrics, listInsightsForReport } from '../services/aiAnalysisService.js';
import {
  ensureCarbonSnapshot,
  listCarbonFootprintHistory,
} from '../services/carbonService.js';

async function generateReportHandler(req, res) {
  const { empresaId, periodo, alcance = 'empresa', plantaId } = req.body;

  if (!empresaId) {
    throw createError(400, 'empresaId es obligatorio');
  }

  const scope = typeof alcance === 'string' ? alcance.toLowerCase() : 'empresa';

  if (scope === 'empresa' && !periodo) {
    throw createError(400, 'El periodo es obligatorio para los reportes de empresa');
  }

  if (scope === 'planta' && !plantaId) {
    throw createError(400, 'plantaId es obligatorio para los reportes por planta');
  }

  const companyId = resolveCompanyIdFromRequest(req, empresaId);

  const company = await getCompanyById(companyId);
  if (!company) {
    throw createError(404, 'Empresa no encontrada');
  }

  if (scope === 'planta') {
    const plantId = Number(plantaId);
    if (!Number.isSafeInteger(plantId) || plantId <= 0) {
      throw createError(400, 'plantaId inválido');
    }

    const plantReport = await buildPlantReport(companyId, plantId);
    if (!plantReport) {
      throw createError(404, 'Planta no encontrada');
    }

    const logo = await resolveLogoBuffer(req.body, company);
    const pdfStream = await buildPlantReportPdf({
      company,
      report: plantReport,
      period: periodo ?? 'N/D',
      logo,
      generatedAt: new Date(),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Reporte-ESG-${company.name}-Planta-${plantReport.plant.name ?? plantId}.pdf`,
    );
    pdfStream.pipe(res);
    return;
  }

  const baseMetrics = await getMetricsByPeriod(companyId, periodo);
  const aiInsights = await listInsightsForReport({ companyId, period: periodo });
  const { metrics, summary: aiSummary } = integrateInsightsIntoMetrics(baseMetrics, aiInsights);

  const history = await buildHistory(companyId, periodo, metrics);
  const kpis = calculateKpis(history);

  const context = { company, period: periodo, metrics, kpis };
  const [executiveSummary, recommendations] = await Promise.all([
    generateExecutiveSummary(context),
    generateRecommendations(context),
  ]);

  const countryCode = req.body?.countryCode ?? req.body?.pais ?? null;
  const [historySeries, logo, carbonSnapshot, carbonHistory] = await Promise.all([
    getHistoricalSummary(companyId),
    resolveLogoBuffer(req.body, company),
    ensureCarbonSnapshot({ companyId, period: periodo, countryCode }),
    listCarbonFootprintHistory({ companyId, limit: 16 }),
  ]);

  const pdfStream = await buildReportPdf({
    company,
    period: periodo,
    metrics,
    kpis,
    executiveSummary,
    recommendations,
    historySeries,
    logo,
    generatedAt: new Date(),
    comparisonMetrics: history.previous ?? {},
    narrative: {
      ...req.body?.narrativa,
      evidencias: req.body?.narrativa?.evidencias ?? aiSummary ?? undefined,
    },
    annexes: Array.isArray(req.body?.anexos) ? req.body.anexos : undefined,
    aiInsights,
    carbon: carbonSnapshot,
    carbonHistory,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Reporte-ESG-${company.name}.pdf`);
  pdfStream.pipe(res);
}

async function buildHistory(companyId, period, currentMetrics) {
  const previousPeriod = await inferPreviousPeriod(companyId, period);
  if (!previousPeriod) {
    return { current: currentMetrics, previous: {} };
  }
  const previousMetrics = await getMetricsByPeriod(companyId, previousPeriod);
  return { current: currentMetrics, previous: previousMetrics };
}

async function inferPreviousPeriod(companyId, period) {
  const [environmental, social, governance] = await Promise.all([
    getMetricsForCompany('environmental', companyId),
    getMetricsForCompany('social', companyId),
    getMetricsForCompany('governance', companyId),
  ]);
  const periods = new Set();
  [environmental, social, governance].forEach((collection) => {
    collection.forEach((metric) => periods.add(metric.period));
  });
  const sorted = Array.from(periods)
    .filter((value) => value !== period)
    .sort()
    .reverse();
  return sorted[0];
}

async function resolveLogoBuffer(body, company) {
  const dataUri = body?.logoDataUrl ?? body?.logo;
  if (dataUri && typeof dataUri === 'string' && dataUri.startsWith('data:image')) {
    const base64 = dataUri.split(',')[1];
    if (base64) {
      return Buffer.from(base64, 'base64');
    }
  }
  const logoUrl = body?.logoUrl ?? company.logoUrl;
  if (!logoUrl) {
    return null;
  }
  try {
    const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    return null;
  }
}

export const generateReport = withControllerErrorHandling(
  generateReportHandler,
  'reportController.generateReport',
);
