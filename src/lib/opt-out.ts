// Post-phase-06 closeout, task C: the logic behind `/opt-out` and `/es/opt-out` — a page the owner
// opens on any device to stop his OWN visits being counted in Umami (a phone cannot paste console
// code). Pure functions over a `Storage`-shaped object so they are unit-testable with fakes; the
// page's script passes `window.localStorage`.
//
// How the tracker behaves (read from the served https://stats.915websites.com/script.js on
// 2026-10-07): `g = window.localStorage` inside try/catch, and every send first evaluates
// `g?.getItem("umami.disabled")` — truthy means "do not send". Truthiness of a string: any
// non-empty string (including "0") disables; the empty string and an absent key (null) do not. It
// is read on each send, so the setting applies from the next page view with no reload dance.
//
// Everything is wrapped so an inaccessible store (Safari private mode, blocked site data, a
// throwing `localStorage` getter handled by the caller passing `undefined`) yields `'unavailable'`,
// never an exception. Writes are verified by reading back, so a store that silently ignores them is
// reported honestly instead of claiming success.
//
// Erasable TypeScript only (no enums/parameter properties): `src/lib/i18n/sitemap.ts` imports
// `OPT_OUT_PATHS` from here and `astro.config.mjs` loads that file under plain Node.

/** The key the Umami tracker checks. */
export const OPT_OUT_KEY = 'umami.disabled';

/** The two utility pages. noindex, excluded from every sitemap/feed, linked from no chrome. */
export const OPT_OUT_PATHS = ['/opt-out', '/es/opt-out'] as const;

export type OptOutStatus = 'counted' | 'opted-out' | 'unavailable';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What the tracker would do for this browser right now. */
export function readOptOutStatus(storage: StorageLike | null | undefined): OptOutStatus {
  if (!storage) return 'unavailable';
  try {
    return storage.getItem(OPT_OUT_KEY) ? 'opted-out' : 'counted';
  } catch {
    return 'unavailable';
  }
}

/** Opt out (`true`) or resume counting (`false`); returns the verified resulting status. */
export function setOptOut(storage: StorageLike | null | undefined, optedOut: boolean): OptOutStatus {
  if (!storage) return 'unavailable';
  try {
    if (optedOut) storage.setItem(OPT_OUT_KEY, '1');
    else storage.removeItem(OPT_OUT_KEY);
  } catch {
    return 'unavailable';
  }
  const actual = readOptOutStatus(storage);
  const wanted: OptOutStatus = optedOut ? 'opted-out' : 'counted';
  return actual === wanted ? actual : 'unavailable';
}

/** Flip the current setting; `'unavailable'` when it cannot be read or changed. */
export function toggleOptOut(storage: StorageLike | null | undefined): OptOutStatus {
  const current = readOptOutStatus(storage);
  if (current === 'unavailable') return 'unavailable';
  return setOptOut(storage, current === 'counted');
}
