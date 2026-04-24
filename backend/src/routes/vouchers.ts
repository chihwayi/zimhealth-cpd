import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import type { SubscriptionTier } from '@prisma/client';

const router: ExpressRouter = Router();

// ── Code generation ───────────────────────────────────────────────────────────

// Charset excludes visually ambiguous chars: 0/O, 1/I/L
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomSegment(length: number): string {
  let result = '';
  // Over-sample to eliminate modulo bias (CHARSET.length = 32 = 2^5, so bias is zero,
  // but the loop handles the general case cleanly).
  while (result.length < length) {
    const byte = randomBytes(1)[0];
    const idx = byte % CHARSET.length;
    if (idx < CHARSET.length) result += CHARSET[idx];
  }
  return result;
}

function generateVoucherCode(): string {
  return `ZHCPD-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}

// Generate `count` unique codes. Retries on the rare collision.
async function generateUniqueCodes(count: number): Promise<string[]> {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateVoucherCode());
  }

  // Verify none already exist in DB (extremely unlikely but safe)
  const existing = await db.voucher.findMany({
    where: { code: { in: Array.from(codes) } },
    select: { code: true },
  });
  const existingSet = new Set(existing.map((v) => v.code));

  const unique = Array.from(codes).filter((c) => !existingSet.has(c));

  // If any collided, generate replacements recursively
  if (unique.length < count) {
    const extras = await generateUniqueCodes(count - unique.length);
    return [...unique, ...extras];
  }

  return unique;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateBatchSchema = z.object({
  name:        z.string().min(2).max(100),
  sponsorName: z.string().min(2).max(100),
  tier:        z.enum(['STANDARD', 'DIASPORA']),
  count:       z.number().int().min(1).max(5000),
  expiresAt:   z.string().datetime().optional(),
  notes:       z.string().max(500).optional(),
});

// ── Admin: list batches ───────────────────────────────────────────────────────

router.get('/batches', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const batches = await db.voucherBatch.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        sponsorName: true,
        tier: true,
        totalCount: true,
        expiresAt: true,
        notes: true,
        createdAt: true,
        createdBy: { select: { fullName: true, email: true } },
        _count: { select: { vouchers: true } },
      },
    });

    // Count redeemed per batch in one query
    const batchIds = batches.map((b) => b.id);
    const redeemedCounts = batchIds.length
      ? await db.voucher.groupBy({
          by: ['batchId'],
          where: { batchId: { in: batchIds }, redeemedAt: { not: null } },
          _count: { id: true },
        })
      : [];

    const redeemedMap = Object.fromEntries(
      redeemedCounts.map((r) => [r.batchId, r._count.id]),
    );

    const result = batches.map((b) => ({
      ...b,
      redeemed: redeemedMap[b.id] ?? 0,
      remaining: b.totalCount - (redeemedMap[b.id] ?? 0),
    }));

    res.json({ batches: result });
  } catch {
    res.status(500).json({ error: 'Could not fetch voucher batches' });
  }
});

// ── Admin: generate a new batch ───────────────────────────────────────────────

router.post('/batches', requireAuth, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = CreateBatchSchema.parse(req.body);

    const codes = await generateUniqueCodes(data.count);

    const batch = await db.voucherBatch.create({
      data: {
        name:        data.name,
        sponsorName: data.sponsorName,
        tier:        data.tier as SubscriptionTier,
        totalCount:  data.count,
        expiresAt:   data.expiresAt ? new Date(data.expiresAt) : null,
        notes:       data.notes ?? null,
        createdById: req.user!.id,
        vouchers: {
          createMany: {
            data: codes.map((code) => ({ code, tier: data.tier as SubscriptionTier })),
          },
        },
      },
      select: { id: true, name: true, sponsorName: true, tier: true, totalCount: true, createdAt: true },
    });

    await db.auditLog.create({
      data: {
        userId:     req.user!.id,
        action:     'VOUCHER_BATCH_CREATED',
        entityType: 'VoucherBatch',
        entityId:   batch.id,
        meta:       { count: data.count, tier: data.tier, sponsorName: data.sponsorName },
      },
    });

    res.status(201).json({ batch, count: codes.length });
  } catch (err: any) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message ?? 'Could not generate voucher batch' });
  }
});

// ── Admin: batch detail (vouchers list) ───────────────────────────────────────

router.get('/batches/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const batch = await db.voucherBatch.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { fullName: true, email: true } },
        vouchers: {
          orderBy: { createdAt: 'asc' },
          include: {
            redeemedBy: {
              select: { id: true, fullName: true, email: true, cadre: true, nczRegistrationNumber: true },
            },
          },
        },
      },
    });

    if (!batch) return res.status(404).json({ error: 'Voucher batch not found' });

    const redeemed  = batch.vouchers.filter((v) => v.redeemedAt).length;
    const remaining = batch.totalCount - redeemed;

    res.json({ batch: { ...batch, redeemed, remaining } });
  } catch {
    res.status(500).json({ error: 'Could not fetch batch' });
  }
});

// ── Admin: CSV export ─────────────────────────────────────────────────────────

router.get('/batches/:id/export.csv', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const batch = await db.voucherBatch.findUnique({
      where: { id: req.params.id },
      include: {
        vouchers: {
          orderBy: { createdAt: 'asc' },
          include: {
            redeemedBy: { select: { fullName: true, email: true, nczRegistrationNumber: true } },
          },
        },
      },
    });

    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const rows = [
      ['Code', 'Tier', 'Status', 'Redeemed At', 'Redeemed By Name', 'Redeemed By Email', 'Registration No'],
      ...batch.vouchers.map((v) => [
        v.code,
        v.tier,
        v.redeemedAt ? 'REDEEMED' : 'AVAILABLE',
        v.redeemedAt ? new Date(v.redeemedAt).toISOString() : '',
        v.redeemedBy?.fullName ?? '',
        v.redeemedBy?.email ?? '',
        v.redeemedBy?.nczRegistrationNumber ?? '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const filename = `vouchers-${batch.name.replace(/[^a-z0-9]+/gi, '-')}-${batch.id.slice(-6)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Export failed' });
  }
});

// ── Admin: voucher lookup (audit search by code) ──────────────────────────────

router.get('/lookup', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';
    if (!code) return res.status(400).json({ error: 'code query param required' });

    const voucher = await db.voucher.findUnique({
      where: { code },
      include: {
        batch: { select: { id: true, name: true, sponsorName: true } },
        redeemedBy: {
          select: { id: true, fullName: true, email: true, cadre: true, nczRegistrationNumber: true },
        },
      },
    });

    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    res.json({ voucher });
  } catch {
    res.status(500).json({ error: 'Lookup failed' });
  }
});

export default router;
