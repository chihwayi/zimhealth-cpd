import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { Role } from '@prisma/client';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken, signImpersonationToken } from '../services/auth.service';

// Regression coverage for RBAC audit finding #2 (unrestricted self-service
// admin minting) and the new COUNTRY_ADMIN country-scoping + impersonation
// feature. See docs/rbac-audit-report.md and docs/rbac-access-matrix.md.

const SUFFIX = randomUUID().slice(0, 8);

let platformOwnerId = '';
let platformOwnerToken = '';
let zwCountryAdminId = '';
let zwCountryAdminToken = '';
let zmCountryAdminId = '';
let zmLearnerId = ''; // out-of-scope for the ZW country admin

describe('RBAC: role-assignment escalation guard + country scoping', () => {
  beforeAll(async () => {
    const owner = await db.user.findUniqueOrThrow({
      where: { email: 'admin@zimhealthcpd.co.zw' },
      select: { id: true, email: true, role: true },
    });
    platformOwnerId = owner.id;
    platformOwnerToken = signAccessToken(owner);

    const zwAdmin = await db.user.create({
      data: {
        email: `zw-admin-${SUFFIX}@zimhealthcpd.co.zw`,
        passwordHash: 'test-hash',
        fullName: 'ZW Country Admin',
        role: Role.COUNTRY_ADMIN,
        countryCode: 'ZW',
        isApproved: true,
      },
      select: { id: true, email: true, role: true },
    });
    zwCountryAdminId = zwAdmin.id;
    zwCountryAdminToken = signAccessToken(zwAdmin);

    const zmAdmin = await db.user.create({
      data: {
        email: `zm-admin-${SUFFIX}@zimhealthcpd.co.zw`,
        passwordHash: 'test-hash',
        fullName: 'ZM Country Admin',
        role: Role.COUNTRY_ADMIN,
        countryCode: 'ZM',
        isApproved: true,
      },
      select: { id: true },
    });
    zmCountryAdminId = zmAdmin.id;

    const zmLearner = await db.user.create({
      data: {
        email: `zm-learner-${SUFFIX}@zimhealthcpd.co.zw`,
        passwordHash: 'test-hash',
        fullName: 'Zambian Learner',
        role: Role.LEARNER,
        countryCode: null,
        isApproved: true,
      },
      select: { id: true },
    });
    zmLearnerId = zmLearner.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({
      where: { OR: [{ userId: { in: [zwCountryAdminId, zmCountryAdminId] } }, { entityId: { in: [zwCountryAdminId, zmCountryAdminId, zmLearnerId] } }] },
    });
    await db.user.deleteMany({ where: { id: { in: [zwCountryAdminId, zmCountryAdminId, zmLearnerId] } } });
  });

  it('COUNTRY_ADMIN cannot assign COUNCIL_OFFICER to another user (403)', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${zmLearnerId}`)
      .set('Authorization', `Bearer ${zwCountryAdminToken}`)
      .send({ role: 'COUNCIL_OFFICER' });

    // Rejected either for being out-of-scope or for the role itself being
    // unassignable by a COUNTRY_ADMIN — both are correct outcomes here.
    expect([403]).toContain(res.status);
  });

  it('COUNTRY_ADMIN cannot self-promote to PLATFORM_OWNER (400/403)', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${zwCountryAdminId}`)
      .set('Authorization', `Bearer ${zwCountryAdminToken}`)
      .send({ role: 'PLATFORM_OWNER' });

    expect([400, 403]).toContain(res.status);

    const stillCountryAdmin = await db.user.findUniqueOrThrow({ where: { id: zwCountryAdminId }, select: { role: true } });
    expect(stillCountryAdmin.role).toBe('COUNTRY_ADMIN');
  });

  it('PLATFORM_OWNER can grant PLATFORM_OWNER to someone else (sanity check the guard is not overly strict)', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${zmCountryAdminId}`)
      .set('Authorization', `Bearer ${platformOwnerToken}`)
      .send({ role: 'PLATFORM_OWNER' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('PLATFORM_OWNER');

    // restore for isolation from other tests
    await db.user.update({ where: { id: zmCountryAdminId }, data: { role: Role.COUNTRY_ADMIN } });
  });

  it('PLATFORM_OWNER can assign any role (sanity check the guard is not overly strict)', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${zmLearnerId}`)
      .set('Authorization', `Bearer ${platformOwnerToken}`)
      .send({ role: 'HELPDESK' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('HELPDESK');

    // restore for isolation from other tests
    await db.user.update({ where: { id: zmLearnerId }, data: { role: Role.LEARNER } });
  });

  it('COUNTRY_ADMIN cannot view a user outside their own country via GET /users', async () => {
    const res = await request(app)
      .get(`/api/admin/users?search=${encodeURIComponent('zm-admin-' + SUFFIX)}`)
      .set('Authorization', `Bearer ${zwCountryAdminToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body.users as Array<{ id: string }>).map((u) => u.id);
    expect(ids).not.toContain(zmCountryAdminId);
  });

  it('COUNTRY_ADMIN cannot deactivate a user outside their own country (403)', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${zmLearnerId}`)
      .set('Authorization', `Bearer ${zwCountryAdminToken}`);

    expect(res.status).toBe(403);
  });
});

describe('RBAC: impersonation', () => {
  let targetLearnerId = '';

  beforeAll(async () => {
    const learner = await db.user.create({
      data: {
        email: `imp-learner-${SUFFIX}@zimhealthcpd.co.zw`,
        passwordHash: 'test-hash',
        fullName: 'Impersonation Target',
        role: Role.LEARNER,
        isApproved: true,
      },
      select: { id: true },
    });
    targetLearnerId = learner.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { entityId: targetLearnerId } });
    await db.user.deleteMany({ where: { id: targetLearnerId } });
  });

  it('PLATFORM_OWNER can start an impersonation session, and it is audit-logged', async () => {
    const res = await request(app)
      .post(`/api/auth/impersonate/${targetLearnerId}`)
      .set('Authorization', `Bearer ${platformOwnerToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(targetLearnerId);
    expect(res.body.expiresInMinutes).toBe(30);

    const log = await db.auditLog.findFirst({
      where: { action: 'IMPERSONATION_STARTED', entityId: targetLearnerId, userId: platformOwnerId },
    });
    expect(log).not.toBeNull();
  });

  it('cannot impersonate another PLATFORM_OWNER (403)', async () => {
    const otherOwner = await db.user.findFirst({ where: { role: Role.PLATFORM_OWNER, id: { not: platformOwnerId } } });
    const targetId = otherOwner?.id ?? platformOwnerId; // fall back to self if only one owner exists in seed data

    const res = await request(app)
      .post(`/api/auth/impersonate/${targetId}`)
      .set('Authorization', `Bearer ${platformOwnerToken}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('a non-PLATFORM_OWNER cannot start an impersonation session (403)', async () => {
    const res = await request(app)
      .post(`/api/auth/impersonate/${targetLearnerId}`)
      .set('Authorization', `Bearer ${zwCountryAdminToken ?? ''}`)
      .send({});

    expect([401, 403]).toContain(res.status);
  });

  it('an impersonation token carries the impersonatedBy claim and works against a normal endpoint', async () => {
    const target = await db.user.findUniqueOrThrow({
      where: { id: targetLearnerId },
      select: { id: true, email: true, role: true },
    });
    const impersonationToken = signImpersonationToken(target, platformOwnerId);

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${impersonationToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(targetLearnerId);
    expect(res.body.impersonating).toBe(true);
  });
});
