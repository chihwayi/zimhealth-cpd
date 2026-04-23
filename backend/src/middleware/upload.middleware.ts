import multer from 'multer';
import path from 'path';

function mb(value: number): number {
  return value * 1024 * 1024;
}

function getEnvMb(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? mb(value) : mb(fallback);
}

const ALLOWED_MIME: Record<string, number> = {
  'image/jpeg': getEnvMb('MEDIA_MAX_IMAGE_MB', 5),
  'image/png': getEnvMb('MEDIA_MAX_IMAGE_MB', 5),
  'image/webp': getEnvMb('MEDIA_MAX_IMAGE_MB', 5),
  'video/mp4': getEnvMb('MEDIA_MAX_VIDEO_MB', 2048),
  'audio/mpeg': getEnvMb('MEDIA_MAX_AUDIO_MB', 200),
  'audio/wav': getEnvMb('MEDIA_MAX_AUDIO_MB', 200),
  'application/pdf': getEnvMb('MEDIA_MAX_PDF_MB', 50),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': getEnvMb('MEDIA_MAX_DOCX_MB', 50),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': getEnvMb('MEDIA_MAX_PPTX_MB', 100),
  'text/plain': getEnvMb('MEDIA_MAX_TEXT_MB', 10),
  'text/html': getEnvMb('MEDIA_MAX_TEXT_MB', 10),
  'application/zip': getEnvMb('MEDIA_MAX_ARCHIVE_MB', 500),
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getEnvMb('MEDIA_MAX_UPLOAD_MB', 2048) },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const blockedExt = ['.exe', '.sh', '.bat', '.cmd', '.msi', '.php', '.js'];
    if (blockedExt.includes(ext)) {
      cb(new Error(`File extension not allowed: ${ext}`));
      return;
    }

    if (ALLOWED_MIME[file.mimetype] !== undefined) {
      if (file.size && file.size > ALLOWED_MIME[file.mimetype]) {
        cb(new Error(`File too large for type ${file.mimetype}`));
        return;
      }
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});
