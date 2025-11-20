import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import companyRoutes from './routes/companyRoutes.js';
import metricRoutes from './routes/metricRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import authRoutes from './routes/authRoutes.js';
import importRoutes from './routes/importRoutes.js';
import evidenceRoutes from './routes/evidenceRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import indicatorRoutes from './routes/indicatorRoutes.js';
import mapRoutes from './routes/mapRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import plantRoutes from './routes/plantRoutes.js';
import companyReportRoutes from './routes/companyReportRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import ingestionRoutes from './routes/ingestionRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import carbonRoutes from './routes/carbonRoutes.js';
import alertRoutes from './routes/alertRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadsDir));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/metrics', metricRoutes);
app.use('/api/metrics/import', importRoutes);
app.use('/api/evidencias', evidenceRoutes);
app.use('/api/integraciones', integrationRoutes);
app.use('/api/indicadores', indicatorRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/plantas', plantRoutes);
app.use('/api/empresa', companyReportRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ingestion', ingestionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/carbon', carbonRoutes);
app.use('/api/alerts', alertRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
