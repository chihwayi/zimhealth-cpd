import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { Role, SubscriptionTier } from '@prisma/client';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';

const TEST_SUFFIX = randomUUID().slice(0, 8).toUpperCase();
const ADMIN_EMAIL = `inst-admin-${TEST_SUFFIX}@zimhealthcpd.co.zw`;
const CONTACT_EMAIL = `inst-contact-${TEST_SUFFIX}@zimhealthcpd.co.zw`;
const OUTSIDER_EMAIL = `inst-outsider-${TEST_SUFFIX}@zimhealthcpd.co.zw`;
const LEARNER_EMAIL = `inst-learner-${TEST_SUFFIX}@zimhealthcpd.co.zw`;

let adminId = '';
let contactId = '';
let outsiderId = '';
let learnerId = '';
let contactToken = '';
let outsiderToken = '';
let learnerToken = '';
let batchId = '';

describe('Institution bulk-enrollment (/api/institutions)', () => {
  beforeAll(async () => {
    const [admin, contact, outsider, learner] = await Promise.all([
      db.user.create({
        data: { email: ADMIN_EMAIL, passwordHash: 'test-hash', fullName: 'Institution Admin', role: Role.ADMIN, isApproved: true },
        select: { id: true, email: true, role: true },
      }),
      db.user.create({
        data: { email: CONTACT_EMAIL, passwordHash: 'test-hash', fullName: 'Institution Contact', role: Role.CONTENT_MANAGER, isApproved: true },
        select: { id: true, email: true, role: true },
      }),
      db.user.create({
        data: { email: OUTSIDER_EMAIL, passwordHash: 'test-hash', fullName: 'Unrelated User', role: Role.CONTENT_MANAGER, isApproved: true },
        select: { id: true, email: true, role: true },
      }),
      db.user.create({
        data: { email: LEARNER_EMAIL, passwordHash: 'test-hash', fullName: 'Institution Learner', role: Role.LEARNER, isApproved: true },
        select: { id: true, email: true, role: true },
      }),
    ]);

    adminId = admin.id;
    contactId = contact.id;
    outsiderId = outsider.id;
    learnerId = learner.id;
    contactToken = signAccessToken(contact);
    outsiderToken = signAccessToken(outsider);
    learnerToken = signAccessToken(learner);

    const batch = await db.voucherBatch.create({
      data: {
        name: `Test Institution Batch ${TEST_SUFFIX}`,
        sponsorName: 'Test Hospital',
        tier: SubscriptionTier.INSTITUTION,
        totalCount: 3,
        createdById: adminId,
        institutionContactId: contactId,
        vouchers: {
          createMany: {
            data: [
              { code: `ZHCPD-${TEST_SUFFIX.slice(0, 4)}-INST-0001`, tier: SubscriptionTier.INSTITUTION },
              { code: `ZHCPD-${TEST_SUFFIX.slice(0, 4)}-INST-0002`, tier: SubscriptionTier.INSTITUTION },
              { code: `ZHCPD-${TEST_SUFFIX.slice(0, 4)}-INST-0003`, tier: SubscriptionTier.INSTITUTION },
            ],
          },
        },
      },
      select: { id: true },
    });
    batchId = batch.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { userId: { in: [adminId, contactId, outsiderId, learnerId].filter(Boolean) } } });
    await db.subscription.deleteMany({ where: { learnerId } });
    await db.voucher.deleteMany({ where: { batchId } });
    await db.voucherBatch.deleteMany({ where: { id: batchId } });
    await db.user.deleteMany({ where: { id: { in: [adminId, contactId, outsiderId, learnerId].filter(Boolean) } } });
  });

  it('rejects roster access from a user who neither created nor administers the batch (403)', async () => {
    const res = await request(app)
      .get(`/api/institutions/${batchId}/roster`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it('lets the designated institution contact bulk-invite staff by email/phone', async () => {
    const res = await request(app)
      .post(`/api/institutions/${batchId}/invite`)
      .set('Authorization', `Bearer ${contactToken}`)
      .send({
        invitees: [
          { email: `staff1-${TEST_SUFFIX}@example.com`, fullName: 'Staff One' },
          { phone: '+263771234567', fullName: 'Staff Two' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.invited).toBe(2);
  });

  it('assigns invitees to existing codes rather than exceeding totalCount', async () => {
    const vouchers = await db.voucher.findMany({ where: { batchId } });
    expect(vouchers.length).toBe(3); // still 3 — no new codes were minted
    expect(vouchers.filter((v) => v.inviteeEmail || v.inviteePhone).length).toBe(2);
  });

  it('shows invited staff on the roster before they redeem', async () => {
    const res = await request(app)
      .get(`/api/institutions/${batchId}/roster`)
      .set('Authorization', `Bearer ${contactToken}`);
    expect(res.status).toBe(200);
    const statuses = res.body.roster.map((r: { status: string }) => r.status);
    expect(statuses.filter((s: string) => s === 'INVITED').length).toBe(2);
    expect(statuses.filter((s: string) => s === 'UNASSIGNED').length).toBe(1);
  });

  it('reflects redemption and compliance status on the roster after a learner redeems', async () => {
    const voucher = await db.voucher.findFirst({ where: { batchId, inviteeEmail: { not: null } } });
    const redeemRes = await request(app)
      .post('/api/payments/redeem-voucher')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ code: voucher!.code });
    expect(redeemRes.status).toBe(200);

    const rosterRes = await request(app)
      .get(`/api/institutions/${batchId}/roster`)
      .set('Authorization', `Bearer ${contactToken}`);
    const entry = rosterRes.body.roster.find((r: { voucherId: string }) => r.voucherId === voucher!.id);
    expect(entry.status).toBe('REDEEMED');
    expect(entry.learner.id).toBe(learnerId);
    expect(entry.compliance).toHaveProperty('totalPoints');
    expect(entry.compliance).toHaveProperty('requiredPoints');
  });

  it('lists the batch under my-batches for the institution contact but not the outsider', async () => {
    const contactRes = await request(app).get('/api/institutions/my-batches').set('Authorization', `Bearer ${contactToken}`);
    expect(contactRes.body.batches.some((b: { id: string }) => b.id === batchId)).toBe(true);

    const outsiderRes = await request(app).get('/api/institutions/my-batches').set('Authorization', `Bearer ${outsiderToken}`);
    expect(outsiderRes.body.batches.some((b: { id: string }) => b.id === batchId)).toBe(false);
  });
});
