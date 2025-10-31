// src/config/multer.config.js
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const UPLOAD_DIR   = process.env.UPLOAD_DIR || 'public/images';
export const MOUNT_PATH = process.env.UPLOAD_MOUNT_PATH || '/images';

const UPLOAD_BASE = path.join(__dirname, '..', '..', UPLOAD_DIR);
fs.mkdirSync(UPLOAD_BASE, { recursive: true });

function safeName(original = 'file') {
  const ext  = path.extname(original || '').toLowerCase();
  const base = path.basename(original || 'file', ext)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
  return `${Date.now()}-${base}${ext || '.jpg'}`;
}

export function uploaderFor(subdir = '') {
  const dest = path.join(UPLOAD_BASE, subdir);
  fs.mkdirSync(dest, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => cb(null, safeName(file?.originalname))
  });

  return multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (_req, file, cb) => {
      const ok = /image\/(png|jpe?g|webp|gif)/i.test(file.mimetype);
      cb(ok ? null : new Error('Tipo de archivo no permitido'), ok);
    }
  });
}

// Construye la URL pública coherente con app.use(MOUNT_PATH, ...)
export function urlFor(subdir, filename) {
  return [MOUNT_PATH.replace(/\/+$/,''), subdir || '', filename]
    .filter(Boolean).join('/').replace(/\\/g, '/');
}
