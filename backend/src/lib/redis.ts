import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => console.error('[Redis] Error:', err.message));
redis.on('connect', () => console.log('[Redis] Connected'));

export async function getAIProvider(): Promise<string> {
  return (await redis.get('config:ai:provider')) ?? process.env.AI_PROVIDER_DEFAULT ?? 'anthropic';
}

export async function setAIProvider(provider: string): Promise<void> {
  await redis.set('config:ai:provider', provider);
}

export async function getMaintenanceMode(): Promise<boolean> {
  return (await redis.get('config:maintenance:enabled')) === 'true';
}

export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  await redis.set('config:maintenance:enabled', String(enabled));
}

export async function getAIFeaturesEnabled(): Promise<boolean> {
  const value = await redis.get('config:ai:enabled');
  return value == null ? true : value === 'true';
}

export async function setAIFeaturesEnabled(enabled: boolean): Promise<void> {
  await redis.set('config:ai:enabled', String(enabled));
}
