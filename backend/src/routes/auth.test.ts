import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../lib/db';
import { randomUUID } from 'crypto';

const TEST_EMAIL = `test+${randomUUID()}@zimhealthcpd.co.zw`;
const TEST_PASSWORD = 'Test@1234';
let councilId = '';
const registrationNumber = `NCZ-TEST-${randomUUID().slice(0, 8).toUpperCase()}`;

describe('Auth API', () => {
  beforeAll(async () => {
    const council = await db.council.findUnique({ where: { acronym: 'NCZ' }, select: { id: true } });
    if (!council) throw new Error('NCZ council seed missing');
    councilId = council.id;
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  function registrationPayload() {
    return {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      fullName: 'Test User',
      councilId,
      professionalTitle: 'Registered General Nurse',
      registrationNumber,
    };
  }

  it('POST /api/auth/register — creates a new user', async () => {
    const res = await request(app).post('/api/auth/register').send(registrationPayload());
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });

  it('POST /api/auth/register — duplicate email returns 409', async () => {
    const res = await request(app).post('/api/auth/register').send(registrationPayload());
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/login — returns tokens', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('POST /api/auth/login — wrong password returns 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: 'WrongPassword',
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me — returns user with valid token', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    const { accessToken } = loginRes.body;
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(TEST_EMAIL);
  });

  it('GET /api/auth/me — without token returns 401', async () => {
    const meRes = await request(app).get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });
});
