import { Platform } from 'react-native';
import { storage } from './storage';

const REQUEST_TIMEOUT_MS = 15000;

function getBaseUrl() {
  const platformUrl =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_API_URL_IOS
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_API_URL_ANDROID
        : undefined;

  const configured = platformUrl ?? process.env.EXPO_PUBLIC_API_URL;

  if (!configured) {
    throw new Error('Missing EXPO_PUBLIC_API_URL environment configuration.');
  }

  return configured;
}

export const API_BASE_URL = getBaseUrl();

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await storage.getItem('access_token');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: unknown };
      throw new Error(
        typeof err.error === 'string' ? err.error : `HTTP ${res.status}`,
      );
    }

    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out connecting to ${API_BASE_URL}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get:    <T>(path: string)                  => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown)   => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown)   => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                  => request<T>('DELETE', path),
};
