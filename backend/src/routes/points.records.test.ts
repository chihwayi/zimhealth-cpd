import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../app';
import { db } from '../lib/db';
import { signAccessToken } from '../services/auth.service';

let learnerToken = '';

describe('Points API records endpoint', () => {
  beforeAll(async () => {
    const learner = await db.user.findUniqueOrThrow({
      where: { email: 'grace@zimhealthcpd.co.zw' },
      select: { id: true, email: true, role: true },
    });
    learnerToken = signAccessToken(learner);
  });

  it('redirects GET /api/points to the canonical /api/points/records endpoint', async () => {
    const res = await request(app)
      .get('/api/points?year=2026&limit=5')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).toBe(307);
    expect(res.headers.location).toBe('/api/points/records?year=2026&limit=5');
  });

  it('supports year and limit query params on /api/points/records', async () => {
    const res = await request(app)
      .get('/api/points/records?year=2026&limit=1')
      .set('Authorization', `Bearer ${learnerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(1);
    if (res.body.length > 0) {
      expect(res.body[0].cycleYear).toBe(2026);
      expect(res.body[0].course).toHaveProperty('category');
      expect(res.body[0].course).toHaveProperty('effectivePoints');
    }
  });
});
