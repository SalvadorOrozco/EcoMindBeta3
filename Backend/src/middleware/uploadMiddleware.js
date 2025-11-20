import multer from 'multer';

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

export const handleImportUpload = importUpload.single('file');
export const handleEvidenceUpload = evidenceUpload.single('file');

const aiUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 35 * 1024 * 1024,
    files: 12,
  },
});

export const handleAiUpload = aiUpload.array('files', 12);

const ingestionUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 40 * 1024 * 1024,
    files: 20,
  },
});

export const handleIngestionUpload = ingestionUpload.array('files', 20);
