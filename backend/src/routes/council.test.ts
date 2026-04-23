import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import app from '../app';
import { db } from '../lib/db';

const OFFICER_EMAIL = `test.council.officer+${randomUUID()}@zimhealthcpd.co.zw`;
const OFFICER_PASSWORD = 'CouncilOfficer@12345';

describe('Council API aliasing (/api/council/* + /api/ncz/*)', () => {
  let officerToken = '';
  let councilId = '';

  beforeAll(async () => {
    const council = await db.council.findUnique({ where: { acronym: 'NCZ' }, select: { id: true } });
    if (!council) throw new Error('NCZ council seed missing');
    councilId = council.id;

    const passwordHash = await bcrypt.hash(OFFICER_PASSWORD, 12);
    await db.user.create({
      data: {
        email: OFFICER_EMAIL,
        passwordHash,
        fullName: 'Test Council Officer',
        role: 'COUNCIL_OFFICER',
        councilId,
        professionalTitle: 'Council Officer',
        isApproved: true,
        isActive: true,
      },
      select: { id: true },
    });

    const loginRes = await request(app).post('/api/auth/login').send({ email: OFFICER_EMAIL, password: OFFICER_PASSWORD });
    expect(loginRes.status).toBe(200);
    officerToken = loginRes.body.accessToken;
    expect(officerToken).toBeTruthy();
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: OFFICER_EMAIL } });
  });

  it('GET /api/council/learners returns learners for COUNCIL_OFFICER', async () => {
    const res = await request(app).get('/api/council/learners').set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.learners)).toBe(true);
  });

  it('GET /api/ncz/learners (alias) also works for COUNCIL_OFFICER', async () => {
    const res = await request(app).get('/api/ncz/learners').set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.learners)).toBe(true);
  });
});

