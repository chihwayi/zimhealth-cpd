import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { parseLocaleFile, buildTemplateCsv } from '../services/localePackParser';
import { en as BASE_TRANSLATION_KEYS } from '@zimhealth/i18n';

const router: ExpressRouter = Router();

const localeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // translation files are tiny; 5MB is generous
  fileFilter: (_req, file, cb) => {
    const allowed = ['.json', '.csv', '.xlsx', '.xls'];
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error(`File type not allowed: ${ext}`));
    cb(null, true);
  },
});

// GET /api/locales — public: which language packs are available, for the
// language switcher. English isn't listed here — it ships built into the
// app as the static default, never a DB row.
router.get('/', async (_req, res) => {
  try {
    const packs = await db.languagePack.findMany({
      where: { isActive: true },
      select: { code: true, name: true, countryCodes: true, updatedAt: true },
      orderBy: { name: 'asc' },
    });
    res.json({ locales: packs });
  } catch {
    res.status(500).json({ error: 'Could not fetch language packs' });
  }
});

// GET /api/locales/template.csv — a fill-in-the-blank starting point for
// anyone preparing a new language: every key the app knows how to translate,
// with the English value shown for context, translation column left blank.
router.get('/template.csv', (_req, res) => {
  const csv = buildTemplateCsv(BASE_TRANSLATION_KEYS);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="zimhealth-translation-template.csv"');
  res.send(csv);
});

// GET /api/locales/:code — public: the actual dictionary, fetched at
// runtime by the frontend's i18next http backend when a learner switches
// language. This is the entire "dynamic language" mechanism — no code
// change needed to add a new one, just a new row here.
router.get('/:code', async (req, res) => {
  try {
    const pack = await db.languagePack.findUnique({ where: { code: req.params.code } });
    if (!pack || !pack.isActive) return res.status(404).json({ error: 'Language not found' });
    res.json(pack.translations);
  } catch {
    res.status(500).json({ error: 'Could not fetch language pack' });
  }
});

const UpsertLanguagePackSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(2).max(100),
  countryCodes: z.string().optional(), // comma-separated ISO codes from the multipart form
});

// POST /api/locales — ADMIN uploads a CSV/JSON/XLSX file of translations.
// This is the "just upload a file and it works" path: parses the file,
// upserts a LanguagePack row, and it's immediately live for every client.
router.post('/', requireAuth, requireRole('ADMIN'), localeUpload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const data = UpsertLanguagePackSchema.parse(req.body);

    const translations = await parseLocaleFile(req.file.buffer, req.file.originalname);
    if (Object.keys(translations).length === 0) {
      return res.status(400).json({ error: 'No translations found in the uploaded file.' });
    }

    const countryCodes = data.countryCodes
      ? data.countryCodes.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
      : [];

    const pack = await db.languagePack.upsert({
      where: { code: data.code },
      update: { name: data.name, countryCodes, translations, uploadedById: req.user!.id },
      create: {
        code: data.code,
        name: data.name,
        countryCodes,
        translations,
        uploadedById: req.user!.id,
      },
    });

    await db.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'LANGUAGE_PACK_UPLOADED',
        entityType: 'LanguagePack',
        entityId: pack.id,
        meta: { code: pack.code, name: pack.name, keyCount: Object.keys(translations).length },
      },
    });

    res.status(201).json({ code: pack.code, name: pack.name, keyCount: Object.keys(translations).length });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(400).json({ error: err.message ?? 'Could not process translation file' });
  }
});

const UpdateLanguagePackSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
  countryCodes: z.array(z.string().length(2)).optional(),
});

// PATCH /api/locales/:code — ADMIN: rename, retire, or re-scope a pack.
router.patch('/:code', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = UpdateLanguagePackSchema.parse(req.body);
    const pack = await db.languagePack.update({
      where: { code: req.params.code },
      data,
    });
    res.json({ code: pack.code, name: pack.name, isActive: pack.isActive, countryCodes: pack.countryCodes });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(404).json({ error: 'Language pack not found' });
  }
});

// GET /api/locales/all/admin — ADMIN: full list including inactive packs.
router.get('/all/admin', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const packs = await db.languagePack.findMany({
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { fullName: true, email: true } } },
    });
    res.json({ packs: packs.map((p) => ({ ...p, keyCount: Object.keys(p.translations as object).length })) });
  } catch {
    res.status(500).json({ error: 'Could not fetch language packs' });
  }
});

export default router;
