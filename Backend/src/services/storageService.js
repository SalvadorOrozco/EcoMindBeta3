import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';
import createError from '../utils/createError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();

let s3Client = null;
let cloudinaryConfigured = false;

function resolveUploadsDir() {
  const rootDir = path.resolve(__dirname, '../../..');
  return path.join(rootDir, 'uploads', 'evidencias');
}

async function ensureDirectory(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

async function saveLocal(file, { companyId, period }) {
  const uploadsDir = resolveUploadsDir();
  await ensureDirectory(path.join(uploadsDir, String(companyId)));
  const safePeriod = String(period).replace(/[^a-zA-Z0-9_-]/g, '-');
  const fileName = `${Date.now()}-${file.originalname}`;
  const companyDir = path.join(uploadsDir, String(companyId), safePeriod);
  await ensureDirectory(companyDir);
  const filePath = path.join(companyDir, fileName);
  await fs.writeFile(filePath, file.buffer);
  const relativePath = path.relative(rootDir(), filePath);
  return {
    provider: 'local',
    storagePath: filePath,
    fileName,
    publicUrl: `/${relativePath.split(path.sep).join('/')}`,
  };
}

function rootDir() {
  return path.resolve(__dirname, '../../..');
}

function ensureS3Client() {
  if (s3Client) return s3Client;
  const region = process.env.AWS_REGION;
  const bucket = process.env.S3_BUCKET_NAME;
  if (!region || !bucket) {
    throw createError(500, 'Configura AWS_REGION y S3_BUCKET_NAME para usar S3');
  }
  s3Client = new S3Client({
    region,
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        }
      : undefined,
  });
  return s3Client;
}

async function saveS3(file, { companyId, period }) {
  const bucket = process.env.S3_BUCKET_NAME;
  const client = ensureS3Client();
  const key = `evidencias/${companyId}/${period}/${Date.now()}-${file.originalname}`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );
  const publicUrl = process.env.S3_PUBLIC_BASE_URL
    ? `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`
    : `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return {
    provider: 's3',
    storagePath: key,
    fileName: file.originalname,
    publicUrl,
  };
}

function ensureCloudinary() {
  if (cloudinaryConfigured) return cloudinary;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw createError(500, 'Configura CLOUDINARY_* para usar Cloudinary');
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  cloudinaryConfigured = true;
  return cloudinary;
}

async function saveCloudinary(file, { companyId, period }) {
  const cl = ensureCloudinary();
  const upload = await cl.uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`, {
    folder: `evidencias/${companyId}/${period}`,
    resource_type: 'auto',
  });
  return {
    provider: 'cloudinary',
    storagePath: upload.public_id,
    fileName: file.originalname,
    publicUrl: upload.secure_url,
  };
}

export async function saveEvidenceFile(file, metadata) {
  if (!file) {
    throw createError(400, 'No se recibió archivo de evidencia');
  }
  if (STORAGE_DRIVER === 's3') {
    return saveS3(file, metadata);
  }
  if (STORAGE_DRIVER === 'cloudinary') {
    return saveCloudinary(file, metadata);
  }
  return saveLocal(file, metadata);
}

export async function deleteEvidenceFile(record) {
  if (!record) return;
  if (record.proveedor === 's3') {
    const client = ensureS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: record.ruta,
      }),
    );
    return;
  }
  if (record.proveedor === 'cloudinary') {
    const cl = ensureCloudinary();
    await cl.uploader.destroy(record.ruta, { resource_type: 'auto' });
    return;
  }
  const absolutePath = path.isAbsolute(record.ruta)
    ? record.ruta
    : path.join(rootDir(), record.ruta);
  await fs.rm(absolutePath, { force: true });
}
