import type { PrismaClient as PrismaClientType } from '@prisma/client';

// Prisma reads DATABASE_URL when its client module is loaded/initialized.
// Ensure it's non-empty for test runs before requiring `@prisma/client`.
if (process.env.NODE_ENV === 'test' && (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '')) {
  // Matches `.github/workflows/ci.yml` postgres service credentials.
  process.env.DATABASE_URL = 'postgresql://nursepro:nursepro_dev@localhost:5432/nursepro';
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client') as { PrismaClient: typeof import('@prisma/client').PrismaClient };

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClientType | undefined;
}

export const db =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = db;
}

