import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireAuth } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { generateUniqueCodes } from './vouchers';
import { sendEmail } from '../lib/email';
import { getLearnerCPDSummary } from '../services/cpd-engine';
import type { SubscriptionTier } from '@prisma/client';

const router: ExpressRouter = Router();

type BatchAccessResult =
  | { error: 403 | 404; message: string }
  | {
      batch: {
        id: string;
        name: string;
        sponsorName: string;
        tier: SubscriptionTier;
        totalCount: number;
        createdById: string;
        institutionContactId: string | null;
      };
    };

async function loadBatchForAccess(req: AuthRequest, batchId: string): Promise<BatchAccessResult> {
  const batch = await db.voucherBatch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true, sponsorName: true, tier: true, totalCount: true, createdById: true, institutionContactId: true },
  });
  if (!batch) return { error: 404, message: 'Batch not found' };

  const isAdmin = req.user?.role === 'PLATFORM_OWNER';
  const isOwner = batch.createdById === req.user?.id;
  const isContact = batch.institutionContactId === req.user?.id;
  if (!isAdmin && !isOwner && !isContact) {
    return { error: 403, message: 'You do not administer this batch' };
  }
  return { batch };
}

// GET /api/institutions/my-batches — batches the current user administers
// (created by them, or designated as the institution contact), plus all
// batches for ADMIN.
router.get('/my-batches', requireAuth, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user!.role === 'PLATFORM_OWNER';
    const batches = await db.voucherBatch.findMany({
      where: isAdmin ? undefined : { OR: [{ createdById: req.user!.id }, { institutionContactId: req.user!.id }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        sponsorName: true,
        tier: true,
        totalCount: true,
        createdAt: true,
        institutionContact: { select: { id: true, fullName: true, email: true } },
        _count: { select: { vouchers: true } },
      },
    });
    res.json({ batches });
  } catch {
    res.status(500).json({ error: 'Could not fetch batches' });
  }
});

// GET /api/institutions/:batchId/roster — every invitee/redeemer in the batch,
// with redemption + CPD compliance status.
router.get('/:batchId/roster', requireAuth, async (req: AuthRequest, res) => {
  try {
    const access = await loadBatchForAccess(req, req.params.batchId);
    if ('error' in access) return res.status(access.error).json({ error: access.message });

    const vouchers = await db.voucher.findMany({
      where: { batchId: req.params.batchId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        code: true,
        inviteeEmail: true,
        inviteePhone: true,
        redeemedAt: true,
        redeemedBy: { select: { id: true, fullName: true, email: true, cadre: true } },
      },
    });

    const roster = await Promise.all(
      vouchers.map(async (v) => {
        const summary = v.redeemedBy ? await getLearnerCPDSummary(v.redeemedBy.id) : null;
        return {
          voucherId: v.id,
          code: v.code,
          invitedEmail: v.inviteeEmail,
          invitedPhone: v.inviteePhone,
          status: v.redeemedAt ? 'REDEEMED' : v.inviteeEmail || v.inviteePhone ? 'INVITED' : 'UNASSIGNED',
          learner: v.redeemedBy,
          compliance: summary
            ? {
                totalPoints: summary.totalPoints,
                requiredPoints: summary.requiredPoints,
                percentComplete: summary.percentComplete,
              }
            : null,
        };
      }),
    );

    res.json({ batch: access.batch, roster });
  } catch {
    res.status(500).json({ error: 'Could not fetch roster' });
  }
});

const InviteSchema = z.object({
  invitees: z
    .array(
      z.object({
        email: z.string().email().optional(),
        phone: z.string().min(5).optional(),
        fullName: z.string().min(2).max(150).optional(),
      }).refine((i) => i.email || i.phone, { message: 'Each invitee needs an email or phone' }),
    )
    .min(1)
    .max(500),
});

// POST /api/institutions/:batchId/invite — assigns named staff to existing
// unassigned codes in the batch (codes are pre-generated in bulk when the
// batch is created, same as the NGO voucher flow — see vouchers.ts), so they
// show on the roster immediately, and emails the code where an email was
// given. Only generates fresh codes if the batch somehow has none spare
// (shouldn't happen via the normal admin batch-creation flow, but keeps this
// endpoint safe to call standalone).
router.post('/:batchId/invite', requireAuth, async (req: AuthRequest, res) => {
  try {
    const access = await loadBatchForAccess(req, req.params.batchId);
    if ('error' in access) return res.status(access.error).json({ error: access.message });
    const { batch } = access;

    const data = InviteSchema.parse(req.body);

    const spareVouchers = await db.voucher.findMany({
      where: { batchId: batch.id, inviteeEmail: null, inviteePhone: null, redeemedAt: null },
      orderBy: { createdAt: 'asc' },
      take: data.invitees.length,
      select: { id: true },
    });

    if (spareVouchers.length < data.invitees.length) {
      const codes = await generateUniqueCodes(data.invitees.length - spareVouchers.length);
      const extra = await db.$transaction(
        codes.map((code) =>
          db.voucher.create({
            data: { code, batchId: batch.id, tier: batch.tier as SubscriptionTier },
            select: { id: true },
          }),
        ),
      );
      spareVouchers.push(...extra);
      await db.voucherBatch.update({
        where: { id: batch.id },
        data: { totalCount: batch.totalCount + extra.length },
      });
    }

    const vouchers = await db.$transaction(
      data.invitees.map((invitee, i) =>
        db.voucher.update({
          where: { id: spareVouchers[i].id },
          data: {
            inviteeEmail: invitee.email ?? null,
            inviteePhone: invitee.phone ?? null,
          },
          select: { code: true },
        }),
      ),
    );

    await Promise.all(
      data.invitees.map(async (invitee, i) => {
        if (!invitee.email) return;
        try {
          await sendEmail(
            invitee.email,
            `You've been invited to ZimHealth CPD by ${batch.sponsorName}`,
            `Hi${invitee.fullName ? ` ${invitee.fullName}` : ''},\n\n${batch.sponsorName} has sponsored your access to ZimHealth CPD.\n\nYour voucher code: ${vouchers[i].code}\n\nRedeem it after registering or logging in, under Subscription > Redeem a voucher.`,
          );
        } catch {
          // Email failure shouldn't roll back the invite — the code still exists and can be shared manually.
        }
      }),
    );

    await db.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'INSTITUTION_INVITE_SENT',
        entityType: 'VoucherBatch',
        entityId: batch.id,
        meta: { count: vouchers.length },
      },
    });

    res.status(201).json({ invited: vouchers.length });
  } catch (err: any) {
    if (err?.name === 'ZodError') return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Could not send invites' });
  }
});

export default router;
