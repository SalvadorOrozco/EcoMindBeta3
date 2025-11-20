import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// ✅ Interceptor para agregar token automáticamente a cada petición
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejo de respuestas y errores
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response } = error;
    let message = error.message ?? 'Error inesperado';

    if (response) {
      if (response.data instanceof Blob) {
        try {
          const text = await response.data.text();
          const parsed = JSON.parse(text);
          message = parsed.message ?? message;
        } catch (blobError) {
          console.error('No se pudo interpretar la respuesta del servidor', blobError);
        }
      } else {
        message = response.data?.message ?? response.data?.error ?? message;
      }

      // ✅ Si es 401 o 403, limpiar token y redirigir a login
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      }
    }

    const customError = new Error(message);
    customError.status = response?.status;
    customError.response = response;
    return Promise.reject(customError);
  }
);

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem('authToken', token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem('authToken');
  }
}

export async function loginRequest(credentials) {
  const { data } = await api.post('/auth/login', credentials);
  return data;
}

export async function registerRequest(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}

export async function fetchProfile() {
  const { data } = await api.get('/auth/me');
  return data.user;
}

export async function fetchCompanies() {
  const { data } = await api.get('/companies');
  return data;
}

export async function fetchCompanyMetrics(companyId, period) {
  const { data } = await api.get(`/metrics/company/${companyId}/${period}`);
  return data;
}

export async function upsertMetric(type, payload) {
  const { data } = await api.post(`/metrics/${type}`, payload);
  return data;
}

export async function fetchMetricHistory(type, companyId) {
  const { data } = await api.get(`/metrics/${type}/company/${companyId}`);
  return data;
}

export async function fetchHistoricalIndicators(companyId) {
  const { data } = await api.get(`/indicadores/historico/${companyId}`);
  return data;
}

export async function generateReport(payload) {
  const response = await api.post('/reports/generate', payload, {
    responseType: 'blob',
  });
  return response.data;
}

export async function previewImportIndicators(formData) {
  const response = await api.post('/metrics/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function confirmImportIndicators(records) {
  const { data } = await api.post('/metrics/import/confirm', { records });
  return data;
}

export async function uploadEvidenceFile(formData) {
  const { data } = await api.post('/evidencias', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function analyzeAiFiles(formData) {
  const { data } = await api.post('/ai/analyze-files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function runAutomatedIngestion(formData) {
  const { data } = await api.post('/ingestion/run', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchIngestionRuns(params) {
  const { data } = await api.get('/ingestion/runs', { params });
  return data;
}

export async function fetchIngestionAlerts(params) {
  const { data } = await api.get('/ingestion/alerts', { params });
  return data;
}

export async function resolveIngestionAlert(id) {
  const { data } = await api.patch(`/ingestion/alerts/${id}/resolve`);
  return data;
}

export async function runEsgAuditRequest(payload) {
  const { data } = await api.post('/audit/run', payload);
  return data;
}

export async function fetchAuditRuns(params) {
  const { data } = await api.get('/audit/runs', { params });
  return data.runs;
}

export async function fetchAuditSummary(params) {
  const { data } = await api.get('/audit/summary', { params });
  return data;
}

export async function fetchAiInsights(params) {
  const { data } = await api.get('/ai/insights', { params });
  return data;
}

export async function deleteAiInsight(id, params) {
  await api.delete(`/ai/insights/${id}`, { params });
}

export async function listEvidence(params) {
  const { data } = await api.get('/evidencias', { params });
  return data;
}

export async function deleteEvidence(id) {
  await api.delete(`/evidencias/${id}`);
}

export function buildEvidenceDownloadUrl(id) {
  return `/api/evidencias/${id}/download`;
}

export async function createCompany(payload) {
  const { data } = await api.post('/companies', payload);
  return data;
}

export async function updateCompany(id, payload) {
  const { data } = await api.put(`/companies/${id}`, payload);
  return data;
}

export async function deleteCompany(id) {
  await api.delete(`/companies/${id}`);
}

export async function fetchSustainabilityMarkers(options = {}) {
  const config = {};
  const params = {};
  if (options?.companyId) {
    params.companyId = options.companyId;
  }
  if (options?.scope) {
    params.scope = options.scope;
  }
  if (Object.keys(params).length > 0) {
    config.params = params;
  }
  const { data } = await api.get('/map', config);
  return data;
}

export async function fetchCustomIndicators(companyId, plantId) {
  const params = {};
  if (companyId) {
    params.companyId = companyId;
  }
  if (plantId) {
    params.plantId = plantId;
  }
  const { data } = await api.get('/indicadores', {
    params: Object.keys(params).length ? params : undefined,
  });
  return data;
}

export async function createCustomIndicator(payload) {
  const { data } = await api.post('/indicadores', payload);
  return data;
}

export async function deleteCustomIndicator(indicatorId, companyId) {
  const { data } = await api.delete(`/indicadores/${indicatorId}`, {
    params: companyId ? { companyId } : undefined,
  });
  return data;
}

export async function fetchPlants(companyId) {
  const params = companyId ? { companyId } : undefined;
  const { data } = await api.get('/plantas', { params });
  return data;
}

export async function createPlant(payload) {
  const { data } = await api.post('/plantas', payload);
  return data;
}

export async function deletePlant(plantId) {
  await api.delete(`/plantas/${plantId}`);
}

export async function fetchPlantReport(plantId, companyId) {
  const params = companyId ? { companyId } : undefined;
  const { data } = await api.get(`/plantas/${plantId}/report`, { params });
  return data;
}

export async function fetchCompanyPlantReport(companyId) {
  const params = companyId ? { companyId } : undefined;
  const { data } = await api.get('/empresa/report', { params });
  return data;
}

export async function fetchCarbonSummary(params) {
  const { data } = await api.get('/carbon/summary', { params });
  return data;
}

export async function fetchCarbonHistory(params) {
  const { data } = await api.get('/carbon/history', { params });
  return data;
}

export async function calculateCarbonFootprint(payload) {
  const { data } = await api.post('/carbon/calculate', payload);
  return data;
}

export async function simulateCarbonScenario(payload) {
  const { data } = await api.post('/carbon/simulate', payload);
  return data;
}

export default api;