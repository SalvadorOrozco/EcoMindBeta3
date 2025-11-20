import { Buffer } from 'node:buffer';
import { PassThrough } from 'stream';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';

const DEFAULT_PALETTE = {
  primary: '#0B815A',
  secondary: '#1E3A8A',
  accent: '#118AB2',
  neutral: '#1F2933',
  background: '#F5F7FA',
  lightBorder: '#D9E2EC',
  softBackground: '#FFFFFF',
};

const FONT_STACK = "'Open Sans', 'Roboto', 'Lato', Arial, sans-serif";

const ENVIRONMENTAL_INDICATORS = [
  { key: 'energiaKwh', label: 'Consumo energético', unit: 'kWh', format: 'number' },
  { key: 'intensidadEnergetica', label: 'Intensidad energética', unit: 'kWh/unidad', format: 'number' },
  { key: 'porcentajeRenovable', label: 'Energía renovable', unit: '%', format: 'percentage' },
  { key: 'emisionesCO2', label: 'Emisiones totales CO₂e', unit: 't', format: 'number' },
  { key: 'emisionesAlcance1', label: 'Emisiones alcance 1', unit: 't', format: 'number' },
  { key: 'emisionesAlcance2', label: 'Emisiones alcance 2', unit: 't', format: 'number' },
  { key: 'emisionesAlcance3', label: 'Emisiones alcance 3', unit: 't', format: 'number' },
  { key: 'aguaM3', label: 'Consumo de agua', unit: 'm³', format: 'number' },
  { key: 'aguaRecicladaPorc', label: 'Agua reciclada', unit: '%', format: 'percentage' },
  { key: 'aguaReutilizadaPorc', label: 'Agua reutilizada', unit: '%', format: 'percentage' },
  { key: 'residuosPeligrososTon', label: 'Residuos peligrosos', unit: 't', format: 'number' },
  { key: 'reciclajePorc', label: 'Tasa de reciclaje', unit: '%', format: 'percentage' },
  { key: 'residuosValorizadosPorc', label: 'Residuos valorizados', unit: '%', format: 'percentage' },
  { key: 'incidentesAmbientales', label: 'Incidentes ambientales', format: 'number' },
  { key: 'sancionesAmbientales', label: 'Sanciones ambientales', format: 'number' },
  { key: 'auditoriasAmbientales', label: 'Auditorías ambientales', format: 'number' },
  { key: 'permisosAmbientalesAlDia', label: 'Permisos ambientales al día', format: 'boolean' },
  { key: 'proyectosBiodiversidad', label: 'Proyectos de biodiversidad', format: 'text' },
  { key: 'planMitigacionAmbiental', label: 'Plan de mitigación ambiental', format: 'text' },
];

const SOCIAL_INDICATORS = [
  { key: 'porcentajeMujeres', label: 'Participación femenina', unit: '%', format: 'percentage' },
  { key: 'diversidadGeneroPorc', label: 'Diversidad de género', unit: '%', format: 'percentage' },
  { key: 'horasCapacitacion', label: 'Horas de capacitación', format: 'number' },
  { key: 'horasVoluntariado', label: 'Horas de voluntariado', format: 'number' },
  { key: 'accidentesLaborales', label: 'Accidentes laborales', format: 'number' },
  { key: 'tasaFrecuenciaAccidentes', label: 'Frecuencia de accidentes', format: 'number' },
  { key: 'tasaRotacion', label: 'Tasa de rotación', unit: '%', format: 'percentage' },
  { key: 'indiceSatisfaccion', label: 'Índice de satisfacción', unit: '%', format: 'percentage' },
  { key: 'proveedoresLocalesPorc', label: 'Proveedores locales', unit: '%', format: 'percentage' },
  { key: 'capacitacionDerechosHumanosPorc', label: 'Capacitación en DD.HH.', unit: '%', format: 'percentage' },
  { key: 'politicaDerechosHumanos', label: 'Política de derechos humanos', format: 'boolean' },
  { key: 'inversionComunidadUsd', label: 'Inversión en comunidad', unit: 'USD', format: 'currency', currency: 'USD' },
  { key: 'programasBienestarActivos', label: 'Programas de bienestar', format: 'number' },
  { key: 'satisfaccionClientesPorc', label: 'Satisfacción de clientes', unit: '%', format: 'percentage' },
  { key: 'participacionComunidad', label: 'Participación comunitaria', format: 'text' },
  { key: 'evaluacionesProveedoresSosteniblesPorc', label: 'Evaluaciones a proveedores sostenibles', unit: '%', format: 'percentage' },
];

const GOVERNANCE_INDICATORS = [
  { key: 'cumplimientoNormativo', label: 'Cumplimiento normativo', unit: '%', format: 'percentage' },
  { key: 'politicasAnticorrupcion', label: 'Políticas anticorrupción', format: 'boolean' },
  { key: 'auditadoPorTerceros', label: 'Auditorías externas', format: 'boolean' },
  { key: 'nivelTransparencia', label: 'Nivel de transparencia', unit: '%', format: 'percentage' },
  { key: 'porcentajeDirectoresIndependientes', label: 'Directores independientes', unit: '%', format: 'percentage' },
  { key: 'diversidadDirectorioPorc', label: 'Diversidad del directorio', unit: '%', format: 'percentage' },
  { key: 'comiteSostenibilidad', label: 'Comité de sostenibilidad', format: 'boolean' },
  { key: 'evaluacionEticaAnual', label: 'Evaluación ética anual', format: 'boolean' },
  { key: 'reunionesStakeholders', label: 'Reuniones con stakeholders', format: 'number' },
  { key: 'canalDenunciasActivo', label: 'Canal de denuncias activo', format: 'boolean' },
  { key: 'politicaRemuneracionEsg', label: 'Remuneración ligada a ESG', format: 'boolean' },
  { key: 'evaluacionRiesgosEsgTrimestral', label: 'Evaluación de riesgos ESG trimestral', format: 'boolean' },
  { key: 'capacitacionGobiernoEsgPorc', label: 'Capacitación ESG en gobierno', unit: '%', format: 'percentage' },
  { key: 'auditoriasCompliance', label: 'Auditorías de compliance', format: 'number' },
  { key: 'reporteSostenibilidadVerificado', label: 'Verificación externa del reporte', format: 'boolean' },
  { key: 'relacionStakeholdersClave', label: 'Relación con stakeholders clave', format: 'text' },
];

const ENVIRONMENTAL_CHART_KEYS = ['energiaKwh', 'emisionesCO2', 'aguaM3', 'residuosPeligrososTon'];
const SOCIAL_CHART_KEYS = ['porcentajeMujeres', 'horasCapacitacion', 'accidentesLaborales', 'satisfaccionClientesPorc'];
const GOVERNANCE_CHART_KEYS = ['cumplimientoNormativo', 'reunionesStakeholders', 'auditoriasCompliance'];

const ALL_INDICATOR_DEFINITIONS = [
  ...ENVIRONMENTAL_INDICATORS,
  ...SOCIAL_INDICATORS,
  ...GOVERNANCE_INDICATORS,
];

export async function buildReportPdf({
  company = {},
  period,
  metrics = {},
  kpis = {},
  executiveSummary,
  recommendations,
  historySeries = [],
  logo,
  generatedAt = new Date(),
  reportType = 'Reporte ESG',
  comparisonMetrics = {},
  narrative = {},
  annexes = [],
  palette = DEFAULT_PALETTE,
  aiInsights = [],
  carbon = null,
  carbonHistory = [],
}) {
  return generatePdfStream({
    company,
    period,
    metrics,
    kpis,
    executiveSummary,
    recommendations,
    historySeries,
    logo,
    generatedAt,
    reportType,
    comparisonMetrics,
    narrative,
    annexes,
    palette,
    aiInsights,
    carbon,
    carbonHistory,
  });
}

export async function buildPlantReportPdf({
  company = {},
  report = {},
  period,
  logo,
  generatedAt = new Date(),
  palette = DEFAULT_PALETTE,
}) {
  const summary = report?.summary ?? {};
  const plant = report?.plant ?? {};
  const indicators = Array.isArray(report?.indicators) ? report.indicators : [];

  const groupedCustomIndicators = indicators.reduce((acc, indicator) => {
    const category = indicator?.category?.toLowerCase() ?? 'otros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({
      name: indicator?.name ?? 'Indicador',
      value: indicator?.value,
      unit: indicator?.unit ?? null,
      period: indicator?.period ?? null,
      description: indicator?.description ?? null,
    });
    return acc;
  }, {});

  const overviewParts = [
    `Reporte ESG para la planta ${plant?.name ?? 'N/D'} perteneciente a ${company?.name ?? 'N/D'}.`,
  ];
  if (summary?.esgScore != null) {
    overviewParts.push(`Índice ESG promedio del periodo: ${Number(summary.esgScore).toFixed(2)} puntos.`);
  }
  if (summary?.overall?.count != null) {
    overviewParts.push(`Indicadores registrados: ${summary.overall.count}.`);
  }

  return generatePdfStream({
    company: { ...company, plant },
    period,
    metrics: {},
    kpis: { compositeScore: summary?.esgScore ?? null },
    executiveSummary: overviewParts.join(' '),
    recommendations:
      report?.recommendations ??
      'Reforzar el monitoreo mensual de los indicadores críticos y profundizar la gestión operativa en los pilares con menor desempeño.',
    historySeries: report?.history ?? [],
    logo,
    generatedAt,
    reportType: 'Reporte ESG por Planta',
    comparisonMetrics: {},
    narrative: {
      alcance:
        `El reporte considera datos de la planta ${plant?.name ?? 'N/D'} y consolida el desempeño operativo del periodo ${period ?? 'N/D'}.`,
      ...report?.narrative,
    },
    annexes: Array.isArray(report?.annexes) ? report.annexes : [],
    palette,
    customIndicators: groupedCustomIndicators,
  });
}

async function generatePdfStream({
  company,
  period,
  metrics,
  kpis,
  executiveSummary,
  recommendations,
  historySeries,
  logo,
  generatedAt,
  reportType,
  comparisonMetrics,
  narrative,
  annexes,
  palette,
  customIndicators = {},
  aiInsights = [],
  carbon = null,
  carbonHistory = [],
}) {
  const html = buildHtmlReport({
    company,
    period,
    metrics,
    kpis,
    executiveSummary,
    recommendations,
    historySeries,
    logo,
    generatedAt,
    reportType,
    comparisonMetrics,
    narrative,
    annexes,
    palette,
    customIndicators,
    aiInsights,
    carbon,
    carbonHistory,
  });

  const headerTemplate = buildHeaderTemplate({ company, reportType, generatedAt, palette });
  const footerTemplate = buildFooterTemplate({ company, reportType, palette });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=medium'],
  });

  let page;
  try {
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'] });
    await page.emulateMediaType('print');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '25mm', bottom: '25mm', left: '25mm', right: '25mm' },
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      preferCSSPageSize: true,
    });

    const finalBuffer = await applyMetadata(pdfBuffer, {
      title: `${reportType} ${period ? `- ${period}` : ''}`.trim(),
      author: company?.name ?? 'EcoMind',
      subject: 'Reporte ESG 2024',
    });

    const stream = new PassThrough();
    stream.end(finalBuffer);
    return stream;
  } finally {
    if (page) {
      await page.close();
    }
    await browser.close();
  }
}

async function applyMetadata(buffer, { title, author, subject }) {
  const pdfDoc = await PDFDocument.load(buffer);
  const now = new Date();
  pdfDoc.setTitle(title);
  pdfDoc.setAuthor(author);
  pdfDoc.setCreator('EcoMind ESG Automation');
  pdfDoc.setProducer('EcoMind ESG Automation');
  pdfDoc.setSubject(subject);
  pdfDoc.setCreationDate(now);
  pdfDoc.setModificationDate(now);
  return pdfDoc.save();
}

function buildHeaderTemplate({ company, reportType, generatedAt, palette }) {
  const companyName = sanitizeText(company?.name ?? '');
  const plantName = sanitizeText(company?.plant?.name ?? '');
  const reportLabel = sanitizeText(reportType);
  const date = formatDate(generatedAt);

  return `
    <style>
      .header-container {
        font-family: ${FONT_STACK};
        font-size: 9px;
        color: ${palette.neutral};
        width: 100%;
        padding: 8px 25mm 0 25mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .header-container .title {
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .header-container .meta {
        display: flex;
        gap: 12px;
      }
    </style>
    <div class="header-container">
      <div class="title">${reportLabel}</div>
      <div class="meta">
        ${companyName ? `<span>${companyName}${plantName ? ` · ${plantName}` : ''}</span>` : ''}
        <span>${date}</span>
      </div>
    </div>
  `;
}

function buildFooterTemplate({ company, reportType, palette }) {
  const reportLabel = sanitizeText(reportType);
  const companyName = sanitizeText(company?.name ?? '');

  return `
    <style>
      .footer-container {
        font-family: ${FONT_STACK};
        font-size: 9px;
        color: ${palette.neutral};
        width: 100%;
        padding: 0 25mm 10px 25mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid ${palette.lightBorder};
      }
      .footer-container .left {
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
    </style>
    <div class="footer-container">
      <div class="left">${companyName ? `${companyName} · ` : ''}${reportLabel}</div>
      <div class="right">Página <span class="pageNumber"></span> / <span class="totalPages"></span></div>
    </div>
  `;
}

function buildHtmlReport({
  company,
  period,
  metrics,
  kpis,
  executiveSummary,
  recommendations,
  historySeries,
  logo,
  generatedAt,
  reportType,
  comparisonMetrics,
  narrative,
  annexes,
  palette,
  customIndicators,
  aiInsights,
  carbon,
  carbonHistory,
}) {
  const companyName = sanitizeText(company?.name ?? '');
  const plantName = sanitizeText(company?.plant?.name ?? '');
  const reportPeriod = sanitizeText(period ?? 'Periodo no especificado');
  const reportDate = formatDate(generatedAt);
  const executiveText = sanitizeMultilineText(
    executiveSummary ?? 'Sin resumen ejecutivo disponible. Se recomienda validar las fuentes de datos para completar el análisis.',
  );
  const recommendationsContent = buildRecommendationsContent(
    recommendations ?? 'Se recomienda profundizar el monitoreo de indicadores y reforzar los planes de acción ESG prioritarios.',
  );
  const scopeText = narrative?.alcance ? sanitizeMultilineText(narrative.alcance) : defaultScopeText(companyName, reportPeriod);
  const companyDetails = buildCompanyDetails(company, narrative);
  const annexesContent = buildAnnexesContent(annexes);
  const customIndicatorContent = buildCustomIndicatorsSection(customIndicators);
  const evidenceSection = buildEvidenceSection(aiInsights);

  const envSection = buildIndicatorSection({
    id: 'indicadores-ambientales',
    title: 'Indicadores Ambientales',
    description:
      narrative?.ambiental ??
      'Evaluación del desempeño ambiental conforme a GRI 302, GRI 303 y SASB sectorial: energía, emisiones, agua y gestión de residuos.',
    indicators: metrics?.environmental ?? {},
    comparison: comparisonMetrics?.environmental ?? {},
    definitions: ENVIRONMENTAL_INDICATORS,
    chartKeys: ENVIRONMENTAL_CHART_KEYS,
    historySeries,
    palette,
  });

  const socialSection = buildIndicatorSection({
    id: 'indicadores-sociales',
    title: 'Indicadores Sociales',
    description:
      narrative?.social ??
      'Indicadores de capital humano alineados con GRI 401-404 y las métricas de talento y bienestar de SASB.',
    indicators: metrics?.social ?? {},
    comparison: comparisonMetrics?.social ?? {},
    definitions: SOCIAL_INDICATORS,
    chartKeys: SOCIAL_CHART_KEYS,
    historySeries,
    palette,
  });

  const governanceSection = buildIndicatorSection({
    id: 'indicadores-gobernanza',
    title: 'Indicadores de Gobernanza',
    description:
      narrative?.gobernanza ??
      'Revisión de gobierno corporativo, ética y compliance en línea con GRI 205, GRI 307 e ISO 26000.',
    indicators: metrics?.governance ?? {},
    comparison: comparisonMetrics?.governance ?? {},
    definitions: GOVERNANCE_INDICATORS,
    chartKeys: GOVERNANCE_CHART_KEYS,
    historySeries,
    palette,
  });

  const carbonSection = buildCarbonSection({ carbon, carbonHistory, palette });

  const kpiSection = buildKpiSection(kpis, historySeries, palette);

  const logoSrc = buildLogoDataUrl(logo);

  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${reportType} - ${companyName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap');
          @page {
            size: A4;
            margin: 25mm;
          }
          @page:first {
            margin-top: 25mm;
          }
          :root {
            --color-primary: ${palette.primary};
            --color-secondary: ${palette.secondary};
            --color-accent: ${palette.accent};
            --color-neutral: ${palette.neutral};
            --color-bg: ${palette.background};
            --color-light-border: ${palette.lightBorder};
            --color-card: ${palette.softBackground};
          }
          * {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            font-family: ${FONT_STACK};
            color: var(--color-neutral);
            font-size: 11pt;
            background: var(--color-bg);
          }
          body {
            line-height: 1.5;
          }
          main {
            background: var(--color-bg);
          }
          section {
            page-break-inside: avoid;
          }
          .page {
            background: var(--color-card);
            padding: 32px 0;
            margin-bottom: 24px;
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
          }
          .cover {
            padding: 72px 72px 96px 72px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
          }
          .cover .branding {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .cover .branding .identity {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .cover .branding .identity span {
            font-size: 12pt;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--color-secondary);
          }
          .cover .branding .identity strong {
            font-size: 24pt;
            color: var(--color-primary);
          }
          .cover .logo {
            width: 120px;
            height: 120px;
            object-fit: contain;
          }
          .cover .report-info {
            margin-top: 48px;
            padding: 32px;
            border-radius: 16px;
            background: linear-gradient(135deg, rgba(11, 129, 90, 0.12), rgba(17, 138, 178, 0.08));
          }
          .cover .report-info h1 {
            margin: 0;
            font-size: 32pt;
            color: var(--color-neutral);
            line-height: 1.1;
          }
          .cover .report-info .meta {
            margin-top: 16px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 12pt;
          }
          .cover .report-info .references {
            margin-top: 24px;
            font-size: 11pt;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }
          .cover .footer-note {
            margin-top: 64px;
            font-size: 10pt;
            color: #52606d;
          }
          .toc {
            padding: 48px 72px;
            page-break-after: always;
          }
          .toc h2 {
            margin: 0 0 24px 0;
            font-size: 18pt;
            color: var(--color-secondary);
          }
          .toc ol {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .toc li {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid var(--color-light-border);
            padding: 12px 0;
            font-size: 12pt;
          }
          .toc li span:last-child {
            color: var(--color-secondary);
          }
          .content {
            padding: 48px 72px;
          }
          .carbon-section {
            margin-top: 32px;
            padding: 28px 32px;
            border-radius: 20px;
            background: linear-gradient(135deg, rgba(11, 129, 90, 0.08), rgba(17, 138, 178, 0.06));
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
          }
          .carbon-section h3 {
            margin-top: 24px;
            margin-bottom: 12px;
            font-size: 14pt;
            color: var(--color-secondary);
          }
          .carbon-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 18px;
            margin: 20px 0 28px;
          }
          .carbon-summary__card {
            background: rgba(255, 255, 255, 0.82);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            border: 1px solid rgba(15, 23, 42, 0.05);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
          }
          .carbon-summary__label {
            font-size: 10pt;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #1f2937;
          }
          .carbon-summary__value {
            font-size: 22pt;
            font-weight: 700;
            color: var(--color-primary);
          }
          .carbon-summary__meta {
            font-size: 10pt;
            color: #334155;
          }
          .carbon-layout {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 24px;
            margin-bottom: 24px;
          }
          .carbon-breakdown table,
          .carbon-history table,
          .carbon-scenarios table {
            width: 100%;
            border-collapse: collapse;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.07);
          }
          .carbon-breakdown th,
          .carbon-history th,
          .carbon-scenarios th {
            background: rgba(11, 129, 90, 0.12);
            color: #0f172a;
            padding: 12px 16px;
            text-align: left;
            font-size: 10pt;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .carbon-breakdown td,
          .carbon-history td,
          .carbon-scenarios td {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(15, 23, 42, 0.06);
            font-size: 10.5pt;
          }
          .carbon-breakdown tr:last-child td,
          .carbon-history tr:last-child td,
          .carbon-scenarios tr:last-child td {
            border-bottom: none;
          }
          .carbon-scenarios {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .carbon-scenarios table td strong {
            color: var(--color-secondary);
          }
          .carbon-scenario__description {
            margin-top: 6px;
            font-size: 9.5pt;
            color: #475569;
          }
          .carbon-history {
            margin-top: 24px;
          }
          .carbon-placeholder {
            padding: 16px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.7);
            border: 1px dashed rgba(15, 23, 42, 0.15);
            color: #475569;
            font-size: 10.5pt;
          }
          @media (max-width: 900px) {
            .carbon-layout {
              grid-template-columns: 1fr;
            }
          }
          .section-header {
            border-left: 6px solid var(--color-primary);
            padding-left: 16px;
            margin-bottom: 16px;
          }
          .section-header h2 {
            margin: 0;
            font-size: 16pt;
            color: var(--color-neutral);
          }
          .section-header p {
            margin: 8px 0 0 0;
            color: #52606d;
            font-size: 11pt;
          }
          .text-block {
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid var(--color-light-border);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
          }
          .text-block p {
            margin: 0 0 12px 0;
          }
          .text-block p:last-child {
            margin-bottom: 0;
          }
          .company-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
          }
          .company-grid .item {
            padding: 16px;
            border-radius: 10px;
            border: 1px solid var(--color-light-border);
            background: var(--color-card);
          }
          .company-grid .label {
            display: block;
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--color-secondary);
            margin-bottom: 6px;
          }
          .company-grid .value {
            font-size: 12pt;
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 24px;
          }
          thead {
            background: rgba(17, 138, 178, 0.12);
          }
          th, td {
            text-align: left;
            padding: 10px 12px;
            border-bottom: 1px solid var(--color-light-border);
            font-size: 10pt;
          }
          th {
            font-weight: 600;
            color: var(--color-secondary);
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }
          tbody tr:nth-child(even) {
            background: rgba(11, 129, 90, 0.04);
          }
          tbody tr:last-child td {
            border-bottom: none;
          }
          .empty-row {
            font-style: italic;
            color: #829ab1;
          }
          .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }
          .chart-card {
            border: 1px solid var(--color-light-border);
            border-radius: 12px;
            padding: 16px;
            background: var(--color-card);
          }
          .chart-card h4 {
            margin: 0 0 12px 0;
            font-size: 12pt;
            color: var(--color-secondary);
          }
          .chart-bar {
            display: grid;
            grid-template-columns: 80px 1fr 60px;
            gap: 8px;
            align-items: center;
            margin-bottom: 8px;
          }
          .chart-bar .label {
            font-size: 10pt;
            color: #52606d;
          }
          .chart-bar .track {
            height: 10px;
            border-radius: 6px;
            background: rgba(17, 138, 178, 0.15);
            overflow: hidden;
          }
          .chart-bar .fill {
            height: 100%;
            border-radius: 6px;
            background: linear-gradient(90deg, ${palette.primary}, ${palette.accent});
          }
          .chart-bar .value {
            font-size: 10pt;
            text-align: right;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }
          .kpi-card {
            border: 1px solid var(--color-light-border);
            border-radius: 12px;
            padding: 20px;
            background: linear-gradient(145deg, rgba(11, 129, 90, 0.12), rgba(17, 138, 178, 0.12));
          }
          .kpi-card h4 {
            margin: 0 0 8px 0;
            font-size: 12pt;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--color-secondary);
          }
          .kpi-card .value {
            font-size: 20pt;
            font-weight: 700;
          }
          .kpi-card .detail {
            margin-top: 6px;
            font-size: 10pt;
            color: #52606d;
          }
          .recommendations {
            display: grid;
            gap: 16px;
            margin-top: 16px;
          }
          .recommendations .item {
            border-left: 4px solid var(--color-primary);
            padding: 12px 16px;
            background: rgba(11, 129, 90, 0.08);
          }
          .evidence-grid {
            display: grid;
            gap: 16px;
          }
          .evidence-card {
            border: 1px solid var(--color-light-border);
            border-radius: 12px;
            padding: 18px 20px;
            background: var(--color-card);
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .evidence-card header {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            justify-content: space-between;
          }
          .evidence-card header h4 {
            margin: 0;
            font-size: 12pt;
            color: var(--color-neutral);
          }
          .badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 999px;
            font-size: 9pt;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            background: rgba(17, 138, 178, 0.15);
            color: var(--color-secondary);
          }
          .badge-ambiental {
            background: rgba(11, 129, 90, 0.18);
            color: var(--color-primary);
          }
          .badge-social {
            background: rgba(30, 58, 138, 0.16);
            color: var(--color-secondary);
          }
          .badge-gobernanza {
            background: rgba(79, 70, 229, 0.16);
            color: #4338ca;
          }
          .evidence-card time {
            font-size: 9pt;
            color: #61748f;
          }
          .evidence-card p {
            margin: 0;
          }
          .evidence-indicators {
            margin: 0;
            padding-left: 18px;
            color: #52606d;
            font-size: 10pt;
          }
          .evidence-indicators li {
            margin-bottom: 4px;
          }
          .evidence-indicators li:last-child {
            margin-bottom: 0;
          }
          .annexes {
            margin-top: 24px;
          }
          .annexes ul {
            margin: 12px 0 0 20px;
            padding: 0;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 48px;
            gap: 32px;
          }
          .signatures .signature-block {
            flex: 1;
            border-top: 1px solid var(--color-light-border);
            padding-top: 16px;
            font-size: 10pt;
            text-align: center;
          }
          .custom-indicators {
            margin-top: 24px;
          }
          .custom-indicators h3 {
            margin-bottom: 12px;
            color: var(--color-secondary);
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .placeholder {
            font-style: italic;
            color: #829ab1;
          }
        </style>
      </head>
      <body>
        <main>
          <section class="page cover">
            <div class="branding">
              <div class="identity">
                <span>${reportType}</span>
                <strong>${companyName || 'Reporte Corporativo'}</strong>
              </div>
              ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="Logo ${companyName}" />` : ''}
            </div>
            <div class="report-info">
              <h1>${companyName || 'Reporte ESG'}${plantName ? `<br /><span style="font-size:18pt;color:${palette.secondary}">Planta ${plantName}</span>` : ''}</h1>
              <div class="meta">
                <span><strong>Periodo:</strong> ${reportPeriod}</span>
                <span><strong>Fecha de emisión:</strong> ${reportDate}</span>
              </div>
              <div class="references">Marco de referencia: GRI · SASB · ISO 26000</div>
            </div>
            <div class="footer-note">Documento generado automáticamente por la plataforma EcoMind. Todos los indicadores son editables y trazables a la fuente de datos corporativa.</div>
          </section>

          <section class="page toc">
            <h2>Índice</h2>
            <ol>
              <li><span>Resumen Ejecutivo</span><span>03</span></li>
              <li><span>Alcance del Reporte</span><span>04</span></li>
              <li><span>Datos de la Empresa</span><span>05</span></li>
              <li><span>Indicadores Ambientales</span><span>06</span></li>
              <li><span>Indicadores Sociales</span><span>07</span></li>
              <li><span>Indicadores de Gobernanza</span><span>08</span></li>
              <li><span>KPIs y Tendencias</span><span>09</span></li>
              <li><span>Evidencias Cargadas</span><span>10</span></li>
              <li><span>Conclusiones y Recomendaciones</span><span>11</span></li>
              <li><span>Anexos y Firmas</span><span>12</span></li>
            </ol>
          </section>

          <section class="page content" id="resumen-ejecutivo">
            <div class="section-header">
              <h2>Resumen Ejecutivo</h2>
              <p>Principales hallazgos del periodo analizado, incluyendo desempeño ESG integral y focos estratégicos prioritarios.</p>
            </div>
            <div class="text-block">
              ${executiveText}
            </div>

            <div class="section-header" id="alcance">
              <h2>Alcance del Reporte</h2>
              <p>Detalle de fronteras organizacionales, normativas aplicadas y cobertura temporal del análisis.</p>
            </div>
            <div class="text-block">
              ${scopeText}
            </div>

            <div class="section-header" id="datos-empresa">
              <h2>Datos de la Empresa</h2>
              <p>Información institucional para contextualizar los indicadores ESG reportados.</p>
            </div>
            <div class="company-grid">
              ${companyDetails}
            </div>
          </section>

          <section class="page content">
            ${envSection}
            ${socialSection}
            ${governanceSection}
            ${carbonSection}
          </section>

          <section class="page content" id="kpis-tendencias">
            <div class="section-header">
              <h2>KPIs y Tendencias</h2>
              <p>Indicadores clave de rendimiento consolidando los tres pilares ESG con análisis de evolución temporal.</p>
            </div>
            ${kpiSection}
          </section>

          <section class="page content" id="evidencias">
            <div class="section-header">
              <h2>Evidencias cargadas</h2>
              <p>Resultados del análisis automático de la documentación soporte y fuentes externas procesadas por IA.</p>
            </div>
            ${evidenceSection}
          </section>

          <section class="page content" id="conclusiones">
            <div class="section-header">
              <h2>Conclusiones y Recomendaciones ESG</h2>
              <p>Síntesis ejecutiva para la toma de decisiones y recomendaciones priorizadas basadas en la evidencia.</p>
            </div>
            <div class="text-block">
              <div class="recommendations">
                ${recommendationsContent}
              </div>
            </div>
          </section>

          <section class="page content" id="anexos">
            <div class="section-header">
              <h2>Anexos y Firmas</h2>
              <p>Anexos documentales, evidencia complementaria y responsables de la validación del reporte.</p>
            </div>
            <div class="annexes">
              ${annexesContent}
            </div>
            ${customIndicatorContent}
            <div class="signatures">
              <div class="signature-block">______________________________<br />Dirección de Sostenibilidad</div>
              <div class="signature-block">______________________________<br />Gerencia General</div>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

function buildCompanyDetails(company, narrative) {
  const details = [];
  const info = {
    'Nombre legal': company?.name,
    RUC: company?.ruc ?? company?.taxId,
    Rubro: narrative?.rubro ?? company?.industry,
    Ubicación: narrative?.ubicacion ?? company?.location,
    Tamaño: narrative?.tamano ?? company?.size,
    'Número de empleados': company?.employees,
    Contacto: narrative?.contacto ?? company?.contact,
    Planta: company?.plant?.name,
  };

  Object.entries(info).forEach(([label, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    details.push(`
      <div class="item">
        <span class="label">${sanitizeText(label)}</span>
        <span class="value">${sanitizeText(String(value))}</span>
      </div>
    `);
  });

  if (!details.length) {
    return '<p class="placeholder">No se registran datos generales de la empresa para este periodo.</p>';
  }

  return details.join('');
}

function buildIndicatorSection({ id, title, description, indicators, comparison, definitions, chartKeys, historySeries, palette }) {
  const rows = buildIndicatorRows({ indicators, comparison, definitions });
  const charts = buildCharts({ chartKeys, historySeries, definitions, palette });

  return `
    <section id="${id}">
      <div class="section-header">
        <h2>${sanitizeText(title)}</h2>
        <p>${sanitizeText(description)}</p>
      </div>
      ${rows}
      ${charts}
    </section>
  `;
}

function buildIndicatorRows({ indicators, comparison, definitions }) {
  const bodyRows = definitions
    .map((definition) => {
      const currentValue = indicators?.[definition.key];
      const previousValue = comparison?.[definition.key];
      if (currentValue == null && previousValue == null) {
        return null;
      }
      const formattedCurrent = formatValue(currentValue, definition);
      const formattedPrevious = formatValue(previousValue, definition);
      const variation = computeVariation(currentValue, previousValue, definition);
      return `
        <tr>
          <td>${sanitizeText(definition.label)}</td>
          <td>${definition.unit ? sanitizeText(definition.unit) : ''}</td>
          <td>${formattedCurrent}</td>
          <td>${formattedPrevious}</td>
          <td>${variation}</td>
        </tr>
      `;
    })
    .filter(Boolean);

  if (!bodyRows.length) {
    return '<p class="placeholder">No se registran indicadores para este periodo.</p>';
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Indicador</th>
          <th>Unidad</th>
          <th>Periodo actual</th>
          <th>Periodo anterior</th>
          <th>Variación</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows.join('')}
      </tbody>
    </table>
  `;
}

function buildCharts({ chartKeys, historySeries, definitions, palette }) {
  const cards = chartKeys
    .map((key) => {
      const definition = definitions.find((item) => item.key === key);
      if (!definition) {
        return null;
      }
      const series = Array.isArray(historySeries)
        ? historySeries
            .map((item) => ({ period: item.period, value: item[key] }))
            .filter((item) => item.value != null)
        : [];
      if (!series.length) {
        return null;
      }
      const maxValue = Math.max(...series.map((item) => Math.abs(Number(item.value))));
      const safeMax = maxValue <= 0 ? 1 : maxValue;
      const rows = series
        .map((item) => {
          const width = Math.max((Math.abs(Number(item.value)) / safeMax) * 100, 6);
          return `
            <div class="chart-bar">
              <span class="label">${sanitizeText(item.period ?? '')}</span>
              <div class="track"><div class="fill" style="width:${width}%;background:linear-gradient(90deg, ${palette.primary}, ${palette.accent});"></div></div>
              <span class="value">${formatValue(item.value, definition)}</span>
            </div>
          `;
        })
        .join('');
      return `
        <div class="chart-card">
          <h4>${sanitizeText(definition.label)}</h4>
          ${rows}
        </div>
      `;
    })
    .filter(Boolean);

  if (!cards.length) {
    return '';
  }

  return `<div class="chart-grid">${cards.join('')}</div>`;
}

function buildKpiSection(kpis, historySeries, palette) {
  const cards = [];
  if (kpis?.compositeScore != null) {
    cards.push(`
      <div class="kpi-card">
        <h4>Índice ESG consolidado</h4>
        <div class="value">${Number(kpis.compositeScore).toFixed(2)}</div>
        <div class="detail">Promedio ponderado de los indicadores ambientales (40%), sociales (30%) y de gobernanza (30%).</div>
      </div>
    `);
  }

  ['environmental', 'social', 'governance'].forEach((pillar) => {
    const trendKey = `${pillar}Trend`;
    if (kpis?.[trendKey]) {
      cards.push(`
        <div class="kpi-card">
          <h4>${pillarTitle(pillar)}</h4>
          <div class="value">${sanitizeText(kpis[trendKey])}</div>
          <div class="detail">Comparativo con el periodo anterior considerando los indicadores clave del pilar.</div>
        </div>
      `);
    }
  });

  const trendCharts = buildTrendCharts(historySeries, palette);

  if (!cards.length && !trendCharts) {
    return '<p class="placeholder">No se registran KPIs calculados para este periodo.</p>';
  }

  return `
    <div class="kpi-grid">${cards.join('')}</div>
    ${trendCharts ?? ''}
  `;
}

function buildTrendCharts(historySeries, palette) {
  if (!Array.isArray(historySeries) || !historySeries.length) {
    return '';
  }
  const cards = ['energiaKwh', 'emisionesCO2', 'inversionComunidadUsd', 'cumplimientoNormativo']
    .map((key) => {
      const labelMap = {
        energiaKwh: 'Consumo energético',
        emisionesCO2: 'Emisiones CO₂e',
        inversionComunidadUsd: 'Inversión comunitaria',
        cumplimientoNormativo: 'Cumplimiento normativo',
      };
      const definition = { label: labelMap[key], key, format: key === 'cumplimientoNormativo' ? 'percentage' : key === 'inversionComunidadUsd' ? 'currency' : 'number', currency: 'USD' };
      const series = historySeries
        .map((item) => ({ period: item.period, value: item[key] }))
        .filter((entry) => entry.value != null);
      if (!series.length) {
        return null;
      }
      const maxValue = Math.max(...series.map((entry) => Math.abs(Number(entry.value))));
      const safeMax = maxValue <= 0 ? 1 : maxValue;
      const rows = series
        .map((entry) => {
          const width = Math.max((Math.abs(Number(entry.value)) / safeMax) * 100, 6);
          return `
            <div class="chart-bar">
              <span class="label">${sanitizeText(entry.period ?? '')}</span>
              <div class="track"><div class="fill" style="width:${width}%;background:linear-gradient(90deg, ${palette.secondary}, ${palette.primary});"></div></div>
              <span class="value">${formatValue(entry.value, definition)}</span>
            </div>
          `;
        })
        .join('');
      return `
        <div class="chart-card">
          <h4>${sanitizeText(definition.label)}</h4>
          ${rows}
        </div>
      `;
    })
    .filter(Boolean);

  if (!cards.length) {
    return '';
  }

  return `<div class="chart-grid">${cards.join('')}</div>`;
}

function buildCarbonSection({ carbon, carbonHistory, palette }) {
  if (!carbon) {
    return '';
  }

  const descriptor = carbon?.factors
    ? `Factores ${sanitizeText(carbon.factors.countryName ?? 'Global')} (${sanitizeText(String(carbon.factors.year ?? ''))})`
    : 'Factores de emisión globales por defecto.';

  const summary = buildCarbonSummaryCards(carbon);
  const breakdown = buildCarbonBreakdownTable(carbon?.breakdown ?? []);
  const scenarios = buildCarbonScenarioContent(carbon?.scenarios ?? []);
  const history = buildCarbonHistoryTable(carbonHistory ?? []);

  return `
    <div class="carbon-section" id="huella-carbono">
      <div class="section-header">
        <h2>Huella de Carbono (GHG Protocol)</h2>
        <p>${descriptor}</p>
      </div>
      ${summary}
      <div class="carbon-layout">
        <div class="carbon-breakdown">
          <h3>Desglose por categoría</h3>
          ${breakdown}
        </div>
        <div class="carbon-scenarios">
          <h3>Escenarios de reducción</h3>
          ${scenarios}
        </div>
      </div>
      <div class="carbon-history">
        <h3>Tendencia de emisiones</h3>
        ${history}
      </div>
    </div>
  `;
}

function buildCarbonSummaryCards(carbon) {
  const cards = [
    {
      label: 'Alcance 1',
      value: carbon.scope1,
      meta: 'Combustión estacionaria, flota y fugas',
    },
    {
      label: 'Alcance 2',
      value: carbon.scope2,
      meta: 'Electricidad adquirida',
    },
    {
      label: 'Alcance 3',
      value: carbon.scope3,
      meta: 'Logística, residuos y cadena de valor',
    },
    {
      label: 'Total corporativo',
      value: carbon.total,
      meta: 'tCO₂e consolidadas',
    },
  ];

  const content = cards
    .map(
      (card) => `
        <div class="carbon-summary__card">
          <span class="carbon-summary__label">${sanitizeText(card.label)}</span>
          <span class="carbon-summary__value">${formatTonnes(card.value)}</span>
          <span class="carbon-summary__meta">${sanitizeText(card.meta)}</span>
        </div>
      `,
    )
    .join('');

  return `<div class="carbon-summary">${content}</div>`;
}

function buildCarbonBreakdownTable(items) {
  if (!items.length) {
    return '<div class="carbon-placeholder">Sin cálculos disponibles para el periodo.</div>';
  }

  const rows = items
    .map((item) => `
      <tr>
        <td>${sanitizeText(carbonScopeLabel(item.scope))}</td>
        <td>${sanitizeText(formatCarbonCategory(item.category))}</td>
        <td>${item.activity != null ? `${formatNumberValue(item.activity, 3)} ${sanitizeText(item.unit ?? '')}` : '—'}</td>
        <td>${item.factor != null ? `${formatNumberValue(item.factor, 4)} tCO₂e / ${sanitizeText(item.unit ?? '-')}` : '—'}</td>
        <td>${formatTonnes(item.result)}</td>
        <td>${item.notes ? sanitizeText(item.notes) : ''}</td>
      </tr>
    `)
    .join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Alcance</th>
          <th>Categoría</th>
          <th>Actividad</th>
          <th>Factor</th>
          <th>Emisiones</th>
          <th>Notas</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildCarbonScenarioContent(scenarios) {
  if (!scenarios.length) {
    return '<div class="carbon-placeholder">No se registran escenarios configurados.</div>';
  }
  const rows = scenarios
    .map((scenario) => `
      <tr>
        <td>
          <strong>${sanitizeText(scenario.name)}</strong>
          ${scenario.description ? `<div class="carbon-scenario__description">${sanitizeText(scenario.description)}</div>` : ''}
        </td>
        <td>${sanitizeText(carbonScopeLabel(scenario.scope))}</td>
        <td>${formatNumberValue(scenario.reductionPercent, 1)} % (${formatTonnes(scenario.reduction)})</td>
        <td>${formatTonnes(scenario.projected)}</td>
      </tr>
    `)
    .join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Escenario</th>
          <th>Ámbito</th>
          <th>Reducción estimada</th>
          <th>Emisiones proyectadas</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildCarbonHistoryTable(history) {
  if (!history.length) {
    return '<div class="carbon-placeholder">Aún no hay historial para este cálculo.</div>';
  }
  const rows = history
    .map((entry) => `
      <tr>
        <td>${sanitizeText(entry.period ?? '')}</td>
        <td>${formatTonnes(entry.scope1)}</td>
        <td>${formatTonnes(entry.scope2)}</td>
        <td>${formatTonnes(entry.scope3)}</td>
        <td>${formatTonnes(entry.total)}</td>
        <td>${
          entry.change != null
            ? `${formatTonnes(entry.change)}${entry.changePercent != null ? ` (${formatNumberValue(entry.changePercent, 1)} %)` : ''}`
            : '—'
        }</td>
      </tr>
    `)
    .join('');

  return `
    <table>
      <thead>
        <tr>
          <th>Periodo</th>
          <th>Alcance 1</th>
          <th>Alcance 2</th>
          <th>Alcance 3</th>
          <th>Total</th>
          <th>Variación</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function carbonScopeLabel(scope) {
  switch ((scope ?? '').toLowerCase()) {
    case 'scope1':
      return 'Alcance 1';
    case 'scope2':
      return 'Alcance 2';
    case 'scope3':
      return 'Alcance 3';
    case 'all':
      return 'Corporativo';
    default:
      return sanitizeText(scope ?? 'N/D');
  }
}

function formatCarbonCategory(category) {
  if (!category) {
    return 'Categoría';
  }
  return category
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function formatTonnes(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return '—';
  }
  return `${formatNumberValue(value, 2)} tCO₂e`;
}

function formatNumberValue(value, decimals = 2) {
  if (value == null || Number.isNaN(Number(value))) {
    return '0.00';
  }
  return Number(value).toLocaleString('es-UY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function buildAnnexesContent(annexes) {
  if (!Array.isArray(annexes) || !annexes.length) {
    return '<p class="placeholder">No se adjuntaron anexos para este reporte.</p>';
  }
  const items = annexes
    .map((annex) => {
      if (typeof annex === 'string') {
        return `<li>${sanitizeText(annex)}</li>`;
      }
      if (annex && typeof annex === 'object') {
        const title = annex.title ? sanitizeText(annex.title) : 'Anexo';
        const description = annex.description ? ` - ${sanitizeText(annex.description)}` : '';
        return `<li>${title}${description}</li>`;
      }
      return null;
    })
    .filter(Boolean)
    .join('');
  return `<ul>${items}</ul>`;
}

function buildCustomIndicatorsSection(customIndicators) {
  const entries = Object.entries(customIndicators ?? {}).filter(([, value]) => Array.isArray(value) && value.length);
  if (!entries.length) {
    return '';
  }
  const sections = entries
    .map(([category, indicators]) => {
      const rows = indicators
        .map((indicator) => {
          const period = indicator.period ? sanitizeText(indicator.period) : 'N/D';
          const description = indicator.description ? `<div class="detail">${sanitizeText(indicator.description)}</div>` : '';
          return `
            <tr>
              <td>${sanitizeText(indicator.name ?? 'Indicador')}</td>
              <td>${period}</td>
              <td>${indicator.value != null ? sanitizeText(String(indicator.value)) : 'Sin dato'}</td>
              <td>${indicator.unit ? sanitizeText(indicator.unit) : ''}</td>
              <td>${description || ''}</td>
            </tr>
          `;
        })
        .join('');
      return `
        <div class="custom-indicators">
          <h3>${sanitizeText(categoryTitle(category))}</h3>
          <table>
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Periodo</th>
                <th>Valor</th>
                <th>Unidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    })
    .join('');
  return sections;
}

function buildEvidenceSection(aiInsights) {
  if (!Array.isArray(aiInsights) || !aiInsights.length) {
    return '<p class="placeholder">No se cargaron evidencias asistidas por IA para este periodo.</p>';
  }

  const cards = aiInsights
    .map((insight, index) => {
      const normalizedCategory = (insight?.category ?? '').toLowerCase();
      const badgeClass = ['ambiental', 'social', 'gobernanza'].includes(normalizedCategory)
        ? `badge badge-${normalizedCategory}`
        : 'badge';
      const category = sanitizeText(insight?.category ?? 'General');
      const fileName = sanitizeText(insight?.fileName ?? `Archivo ${index + 1}`);
      const analyzedAt = insight?.analyzedAt ? formatDate(insight.analyzedAt) : null;
      const summary = sanitizeMultilineText(
        insight?.summary ?? 'Se detectó información relevante para este reporte.',
      );
      const indicators = buildEvidenceIndicators(insight?.indicators);

      return `
        <article class="evidence-card">
          <header>
            <div>
              <span class="${badgeClass}">${category}</span>
              <h4>${fileName}</h4>
            </div>
            ${analyzedAt ? `<time>${sanitizeText(analyzedAt)}</time>` : ''}
          </header>
          ${summary}
          ${indicators}
        </article>
      `;
    })
    .join('');

  return `<div class="evidence-grid">${cards}</div>`;
}

function buildEvidenceIndicators(indicators) {
  if (!indicators || Object.keys(indicators).length === 0) {
    return '<p class="placeholder">Sin indicadores cuantitativos detectados.</p>';
  }
  const items = Object.entries(indicators)
    .map(([key, value]) => {
      const definition = ALL_INDICATOR_DEFINITIONS.find((item) => item.key === key);
      const label = sanitizeText(definition?.label ?? key);
      const formatted = definition ? formatValue(value, definition) : sanitizeText(String(value ?? ''));
      return `<li><strong>${label}:</strong> ${formatted}</li>`;
    })
    .join('');
  return `<ul class="evidence-indicators">${items}</ul>`;
}

function buildRecommendationsContent(recommendations) {
  let items = [];
  if (Array.isArray(recommendations)) {
    items = recommendations;
  } else if (recommendations && typeof recommendations === 'object') {
    items = Object.values(recommendations).map((value) => (value == null ? '' : String(value)));
  } else if (typeof recommendations === 'string') {
    items = recommendations
      .split(/\r?\n/)
      .map((entry) => entry.replace(/^\s*[-•\u2022]\s*/, '').trim())
      .filter(Boolean);
  }

  if (!items.length) {
    return '<div class="item placeholder">No se registran recomendaciones para este periodo.</div>';
  }

  return items
    .map((entry) => `<div class="item">${sanitizeText(entry)}</div>`)
    .join('');
}

function computeVariation(currentValue, previousValue, definition) {
  if (currentValue == null || previousValue == null) {
    return '<span class="placeholder">Sin dato</span>';
  }
  if (definition?.format === 'text') {
    return '<span class="placeholder">No aplica</span>';
  }
  if (definition?.format === 'boolean') {
    if (Boolean(currentValue) === Boolean(previousValue)) {
      return 'Sin variación';
    }
    return Boolean(currentValue) ? 'Implementado' : 'No implementado';
  }
  const diff = Number(currentValue) - Number(previousValue);
  if (Number.isNaN(diff)) {
    return '<span class="placeholder">Sin dato</span>';
  }
  const trend = diff === 0 ? 'Sin variación' : diff > 0 ? '↑ Mejora' : '↓ Retroceso';
  const formatted = formatValue(Math.abs(diff), definition);
  return `${trend} (${formatted})`;
}

function formatValue(value, definition = {}) {
  if (value == null || value === '') {
    return '<span class="placeholder">Sin dato</span>';
  }
  const format = definition.format ?? 'text';
  const numericValue = Number(value);
  switch (format) {
    case 'number': {
      if (Number.isNaN(numericValue)) {
        return sanitizeText(String(value));
      }
      return new Intl.NumberFormat('es-UY', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numericValue);
    }
    case 'currency': {
      if (Number.isNaN(numericValue)) {
        return sanitizeText(String(value));
      }
      return new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: definition.currency ?? 'USD',
        maximumFractionDigits: 2,
      }).format(numericValue);
    }
    case 'percentage': {
      if (Number.isNaN(numericValue)) {
        return sanitizeText(String(value));
      }
      const displayValue = Math.abs(numericValue) <= 1 && numericValue >= 0 ? numericValue * 100 : numericValue;
      return `${displayValue.toFixed(2)} %`;
    }
    case 'boolean': {
      return value === true || value === 'true' || value === 1 ? 'Sí' : 'No';
    }
    default:
      return sanitizeText(String(value));
  }
}

function buildLogoDataUrl(logoBuffer) {
  if (!logoBuffer) {
    return '';
  }
  if (typeof logoBuffer === 'string' && logoBuffer.startsWith('data:image')) {
    return logoBuffer;
  }
  if (Buffer.isBuffer(logoBuffer)) {
    const base64 = logoBuffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  }
  return '';
}

function sanitizeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeMultilineText(value) {
  const sanitized = sanitizeText(value);
  const lines = sanitized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return '<p class="placeholder">Sin información disponible.</p>';
  }
  return lines.map((line) => `<p>${line}</p>`).join('');
}

function defaultScopeText(companyName, period) {
  const baseCompany = companyName || 'la compañía';
  return `
    <p>Este reporte cubre las operaciones de ${sanitizeText(baseCompany)} correspondientes al periodo ${sanitizeText(period)}.</p>
    <p>Se contemplan las políticas de gestión bajo los marcos GRI Standards, SASB y las directrices de responsabilidad social ISO 26000.</p>
    <p>El alcance incluye datos corporativos recopilados mediante la plataforma EcoMind con procesos de aseguramiento interno.</p>
  `;
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function pillarTitle(pillar) {
  switch (pillar) {
    case 'environmental':
      return 'Pilar ambiental';
    case 'social':
      return 'Pilar social';
    case 'governance':
      return 'Pilar de gobernanza';
    default:
      return 'Indicador ESG';
  }
}

function categoryTitle(category) {
  switch (category) {
    case 'environmental':
      return 'Indicadores ambientales';
    case 'social':
      return 'Indicadores sociales';
    case 'gobernanza':
    case 'governance':
      return 'Indicadores de gobernanza';
    default:
      return `Indicadores ${category}`;
  }
}
