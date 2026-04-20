import { PrismaClient } from '@prisma/client';

// In CI, we may not have a checked-in `../.env`, but the workflow can still provide DATABASE_URL.
// Prisma reads DATABASE_URL at client initialization time, so ensure it's present for tests.
if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL = 'postgresql://localhost:5432/nursepro';
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const db =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = db;
}

