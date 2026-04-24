import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { Role, SubscriptionTier } from '@prisma/client';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';

const TEST_SUFFIX = randomUUID().slice(0, 8).toUpperCase();
const ADMIN_EMAIL = `voucher-admin-${TEST_SUFFIX}@zimhealthcpd.co.zw`;
const LEARNER_EMAIL = `voucher-learner-${TEST_SUFFIX}@zimhealthcpd.co.zw`;
const VOUCHER_CODE = `ZHCPD-${TEST_SUFFIX.slice(0, 4)}-${TEST_SUFFIX.slice(4, 8)}-TST1`;

let adminId = '';
let learnerId = '';
let batchId = '';
let learnerToken = '';

describe('Voucher redemption', () => {
  beforeAll(async () => {
    const [admin, learner] = await Promise.all([
      db.user.create({
        data: {
          email: ADMIN_EMAIL,
          passwordHash: 'test-hash',
          fullName: 'Voucher Admin',
          role: Role.ADMIN,
          isApproved: true,
        },
        select: { id: true, email: true, role: true },
      }),
      db.user.create({
        data: {
          email: LEARNER_EMAIL,
          passwordHash: 'test-hash',
          fullName: 'Voucher Learner',
          role: Role.LEARNER,
          isApproved: true,
        },
        select: { id: true, email: true, role: true },
      }),
    ]);

    adminId = admin.id;
    learnerId = learner.id;
    learnerToken = signAccessToken(learner);

    const batch = await db.voucherBatch.create({
      data: {
        name: `Test Voucher Batch ${TEST_SUFFIX}`,
        sponsorName: 'Test Sponsor',
        tier: SubscriptionTier.STANDARD,
        totalCount: 1,
        createdById: adminId,
        vouchers: {
          create: {
            code: VOUCHER_CODE,
            tier: SubscriptionTier.STANDARD,
          },
        },
      },
      select: { id: true },
    });
    batchId = batch.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { userId: { in: [adminId, learnerId].filter(Boolean) } } });
    await db.subscription.deleteMany({ where: { learnerId } });
    await db.voucher.deleteMany({ where: { batchId } });
    await db.voucherBatch.deleteMany({ where: { id: batchId } });
    await db.user.deleteMany({ where: { id: { in: [adminId, learnerId].filter(Boolean) } } });
  });

  it('redeems a sponsor voucher once and upgrades the learner', async () => {
    const res = await request(app)
      .post('/api/payments/redeem-voucher')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ code: VOUCHER_CODE.toLowerCase() });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, tier: 'STANDARD', sponsorName: 'Test Sponsor' });

    const [voucher, learner, subscription] = await Promise.all([
      db.voucher.findUniqueOrThrow({ where: { code: VOUCHER_CODE } }),
      db.user.findUniqueOrThrow({ where: { id: learnerId } }),
      db.subscription.findUniqueOrThrow({ where: { learnerId } }),
    ]);

    expect(voucher.redeemedById).toBe(learnerId);
    expect(voucher.redeemedAt).toBeTruthy();
    expect(learner.subscriptionTier).toBe(SubscriptionTier.STANDARD);
    expect(subscription.gateway).toBe('voucher');

    const secondRes = await request(app)
      .post('/api/payments/redeem-voucher')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ code: VOUCHER_CODE });

    expect(secondRes.status).toBe(409);
  });
});
