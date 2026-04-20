import multer from 'multer';

const ALLOWED_MIME: Record<string, number> = {
  'image/jpeg': 5 * 1024 * 1024, // 5 MB
  'image/png': 5 * 1024 * 1024,
  'image/webp': 5 * 1024 * 1024,
  'video/mp4': 2 * 1024 * 1024 * 1024, // 2 GB
  'audio/mpeg': 200 * 1024 * 1024, // 200 MB
  'audio/wav': 200 * 1024 * 1024,
  'application/pdf': 50 * 1024 * 1024, // 50 MB
  'application/zip': 500 * 1024 * 1024, // 500 MB (SCORM)
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // hard max 2GB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype] !== undefined) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

