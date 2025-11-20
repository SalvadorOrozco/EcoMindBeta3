import XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import createError from './createError.js';

const TYPE_ALIASES = {
  ambiental: 'environmental',
  environmental: 'environmental',
  ambiente: 'environmental',
  social: 'social',
  governance: 'governance',
  gobernanza: 'governance',
  gobierno: 'governance',
};

const FIELD_ALIASES = {
  empresaid: 'companyId',
  empresaId: 'companyId',
  empresa: 'companyId',
  empresa_id: 'companyId',
  companyid: 'companyId',
  companyId: 'companyId',
  company: 'companyId',
  compania: 'companyId',
  compañia: 'companyId',
  idempresa: 'companyId',
  orgid: 'companyId',
  organizationid: 'companyId',
  periodoid: 'period',
  periodo: 'period',
  periodo_reporte: 'period',
  periodo_repor: 'period',
  periodo_esg: 'period',
  año: 'period',
  anio: 'period',
  ano: 'period',
  year: 'period',
  trimestre: 'period',
  quarter: 'period',
};

export function parseIndicatorFile(buffer, originalname) {
  if (!buffer?.length) {
    throw createError(400, 'El archivo de importación está vacío');
  }
  const extension = (originalname ?? '').toLowerCase();
  const rows = extension.endsWith('.csv') ? parseCsv(buffer) : parseWorkbook(buffer);

  const grouped = {
    environmental: [],
    social: [],
    governance: [],
  };

  rows.forEach((row) => {
    const normalized = normalizeRow(row.data);
    const type = resolveType(row.typeHint, normalized.type);
    if (!type) {
      throw createError(400, `No se pudo determinar el tipo de indicador para la fila ${row.index}`);
    }
    const { type: _ignored, ...rest } = normalized;
    grouped[type].push({ ...rest, __source: row.source, __index: row.index });
  });

  return grouped;
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const rows = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const data = XLSX.utils.sheet_to_json(sheet, { defval: null });
    data.forEach((row, index) => {
      rows.push({
        data: row,
        index: index + 2, // assume headers at row 1
        typeHint: sheetName,
        source: sheetName,
      });
    });
  });
  return rows;
}

function parseCsv(buffer) {
  const content = buffer.toString('utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records.map((row, index) => ({
    data: row,
    index: index + 2,
    typeHint: resolveCsvTypeHint(row),
    source: 'csv',
  }));
}

function resolveCsvTypeHint(row) {
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = camelCase(key);
    if (
      ['type', 'tipo', 'pilar', 'categoria', 'tipoIndicador', 'pilarEsg', 'pillar']
        .includes(normalizedKey)
    ) {
      if (value) return value;
    }
  }
  return null;
}

function normalizeRow(row) {
  const output = {};
  Object.entries(row).forEach(([key, value]) => {
    if (value === undefined) return;
    const normalizedKey = camelCase(key);
    const finalKey = FIELD_ALIASES[normalizedKey] ?? normalizedKey;
    output[finalKey] = value;
  });
  return output;
}

function camelCase(value) {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .split('_')
    .filter(Boolean)
    .map((segment, index) =>
      index === 0
        ? segment.toLowerCase()
        : segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
    )
    .join('');
}

function resolveType(sheetName, value) {
  const candidates = [sheetName, value];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.toString().trim().toLowerCase();
    if (TYPE_ALIASES[normalized]) {
      return TYPE_ALIASES[normalized];
    }
  }
  return null;
}
