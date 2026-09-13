import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import app from '../app';
import { db } from '../lib/db';

const OFFICER_EMAIL = `test.compliance.officer+${randomUUID()}@zimhealthcpd.co.zw`;
const OFFICER_PASSWORD = 'ComplianceOfficer@12345';
const LEARNER_EMAIL = `test.compliance.learner+${randomUUID()}@zimhealthcpd.co.zw`;

describe('Council compliance reporting (/api/council/compliance, /api/council/export/csv)', () => {
  let officerToken = '';
  let officerId = '';
  let councilId = '';
  let otherCouncilId = '';

  beforeAll(async () => {
    const [council, otherCouncil] = await Promise.all([
      db.council.findUnique({ where: { acronym: 'NCZ' }, select: { id: true } }),
      db.council.findUnique({ where: { acronym: 'MDPCZ' }, select: { id: true } }),
    ]);
    if (!council || !otherCouncil) throw new Error('Council seed missing (NCZ/MDPCZ)');
    councilId = council.id;
    otherCouncilId = otherCouncil.id;

    const passwordHash = await bcrypt.hash(OFFICER_PASSWORD, 12);
    const officer = await db.user.create({
      data: {
        email: OFFICER_EMAIL,
        passwordHash,
        fullName: 'Test Compliance Officer',
        role: 'COUNCIL_OFFICER',
        councilId,
        professionalTitle: 'Council Officer',
        isApproved: true,
        isActive: true,
      },
      select: { id: true },
    });
    officerId = officer.id;

    await db.user.create({
      data: {
        email: LEARNER_EMAIL,
        passwordHash,
        fullName: 'Test Compliance Learner',
        role: 'LEARNER',
        councilId,
        cadre: 'NURSE',
        isApproved: true,
        isActive: true,
      },
    });

    const loginRes = await request(app).post('/api/auth/login').send({ email: OFFICER_EMAIL, password: OFFICER_PASSWORD });
    expect(loginRes.status).toBe(200);
    officerToken = loginRes.body.accessToken;
    expect(officerToken).toBeTruthy();
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { userId: officerId } });
    await db.user.deleteMany({ where: { email: { in: [OFFICER_EMAIL, LEARNER_EMAIL] } } });
  });

  it('GET /api/council/compliance returns a JSON summary scoped to the officer council', async () => {
    const res = await request(app)
      .get(`/api/council/compliance?year=${new Date().getFullYear()}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalLearners');
    expect(res.body).toHaveProperty('complianceRate');
    expect(res.body.totalLearners).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/council/compliance rejects a councilId belonging to another council (403)', async () => {
    const res = await request(app)
      .get(`/api/council/compliance?councilId=${otherCouncilId}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/council/export/csv returns a valid CSV with a header row and learner data', async () => {
    const res = await request(app)
      .get(`/api/council/export/csv?year=${new Date().getFullYear()}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toContain('Sync Status');
    expect(lines[0]).toContain('Points Required');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/council/export/csv rejects a councilId belonging to another council (403)', async () => {
    const res = await request(app)
      .get(`/api/council/export/csv?councilId=${otherCouncilId}`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(403);
  });

  it('records an AuditLog entry per report pull', async () => {
    const before = await db.auditLog.count({ where: { action: 'COMPLIANCE_REPORT_GENERATED' } });
    await request(app)
      .get(`/api/council/compliance?year=${new Date().getFullYear()}`)
      .set('Authorization', `Bearer ${officerToken}`);
    const after = await db.auditLog.count({ where: { action: 'COMPLIANCE_REPORT_GENERATED' } });
    expect(after).toBeGreaterThan(before);
  });

  it('filters by cadre', async () => {
    const res = await request(app)
      .get(`/api/council/compliance?year=${new Date().getFullYear()}&cadre=PHARMACIST`)
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    // The seeded test learner is a NURSE, so filtering to PHARMACIST should exclude them.
    expect(res.body.totalLearners).toBe(0);
  });
});
