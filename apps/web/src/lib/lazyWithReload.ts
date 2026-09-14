import { lazy } from 'react';
import type { ComponentType } from 'react';

// Wraps React.lazy() so that a stale-chunk load failure (a tab left open
// across a deploy, trying to fetch a hashed JS file that no longer exists —
// the server's SPA fallback returns index.html instead, which the browser
// rejects as the wrong MIME type) triggers exactly one automatic reload to
// pick up the new build, instead of leaving the user stuck on a white screen
// or console error. If it still fails after reloading, the error is thrown
// normally rather than looping forever.
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    const key = 'zimhealth-chunk-reload-attempted';
    try {
      const result = await factory();
      sessionStorage.removeItem(key); // reset the reload budget after any successful chunk load
      return result;
    } catch (err) {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Never resolves — the reload is already in flight.
        return new Promise<{ default: T }>(() => {});
      }
      sessionStorage.removeItem(key);
      throw err;
    }
  });
}
