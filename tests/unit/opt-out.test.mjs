// Post-phase-06 closeout, task C: the Umami opt-out page (`/opt-out`, `/es/opt-out`) so the owner
// can stop his OWN visits counting from any device (a phone cannot paste console code).
//
// The tracker (https://stats.915websites.com/script.js) skips every send when
// `localStorage.getItem("umami.disabled")` is truthy — read per send, so the flag takes effect on
// the next page view; localStorage is read inside try/catch (an inaccessible store means "count").
// So the whole feature is: set that key to a non-empty string, or remove it.
//
// Layers: 1. the pure toggle module with fake storages (always runs); 2. dictionary copy;
// 3. page/sitemap wiring at source level; 4. rendered HTML, sitemaps, feeds (needs a dist built
// after these sources — see tests/helpers/dist-fresh.mjs; otherwise a visible skip).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  OPT_OUT_KEY,
  OPT_OUT_PATHS,
  readOptOutStatus,
  setOptOut,
  toggleOptOut,
} from '../../src/lib/opt-out.ts';
import { DICTIONARY, t } from '../../src/lib/i18n/dictionary.ts';
import { isSitemapExcludedPath } from '../../src/lib/i18n/sitemap.ts';
import { staleDistReason, builtOptOutPagesExist } from '../helpers/dist-fresh.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');

/** A plain in-memory Storage stand-in. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}
const throwing = (which) => {
  const s = fakeStorage();
  s[which] = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  return s;
};

// ---------------------------------------------------------------------------
// 1. Pure toggle module
// ---------------------------------------------------------------------------

test('opt-out: the key is exactly the one the Umami tracker reads, and the paths are the two utility pages', () => {
  assert.equal(OPT_OUT_KEY, 'umami.disabled');
  assert.deepEqual([...OPT_OUT_PATHS], ['/opt-out', '/es/opt-out']);
});

test('readOptOutStatus: absent key is "counted"; a non-empty value is "opted-out"', () => {
  assert.equal(readOptOutStatus(fakeStorage()), 'counted');
  assert.equal(readOptOutStatus(fakeStorage({ [OPT_OUT_KEY]: '1' })), 'opted-out');
});

test('readOptOutStatus: matches the tracker\'s truthiness — an empty string is NOT opted out, any other string is', () => {
  assert.equal(readOptOutStatus(fakeStorage({ [OPT_OUT_KEY]: '' })), 'counted');
  assert.equal(readOptOutStatus(fakeStorage({ [OPT_OUT_KEY]: 'true' })), 'opted-out');
  assert.equal(readOptOutStatus(fakeStorage({ [OPT_OUT_KEY]: '0' })), 'opted-out'); // "0" is a truthy string to the tracker
});

test('setOptOut(true) writes "1" and reports opted-out; setOptOut(false) removes the key and reports counted', () => {
  const s = fakeStorage();
  assert.equal(setOptOut(s, true), 'opted-out');
  assert.equal(s.map.get(OPT_OUT_KEY), '1');
  assert.equal(setOptOut(s, false), 'counted');
  assert.equal(s.map.has(OPT_OUT_KEY), false);
});

test('setOptOut is idempotent', () => {
  const s = fakeStorage();
  setOptOut(s, true);
  assert.equal(setOptOut(s, true), 'opted-out');
  setOptOut(s, false);
  assert.equal(setOptOut(s, false), 'counted');
});

test('toggleOptOut flips counted -> opted-out -> counted', () => {
  const s = fakeStorage();
  assert.equal(toggleOptOut(s), 'opted-out');
  assert.equal(toggleOptOut(s), 'counted');
  assert.equal(s.map.has(OPT_OUT_KEY), false);
});

test('a missing storage (null/undefined) is "unavailable" for read, set and toggle — never throws', () => {
  for (const s of [null, undefined]) {
    assert.equal(readOptOutStatus(s), 'unavailable');
    assert.equal(setOptOut(s, true), 'unavailable');
    assert.equal(toggleOptOut(s), 'unavailable');
  }
});

test('a storage whose getItem throws is "unavailable" and nothing escapes', () => {
  const s = throwing('getItem');
  assert.equal(readOptOutStatus(s), 'unavailable');
  assert.equal(setOptOut(s, true), 'unavailable');
  assert.equal(toggleOptOut(s), 'unavailable');
});

test('a storage whose setItem/removeItem throws (e.g. Safari private mode) is "unavailable" on write, and the failed write never reports success', () => {
  assert.equal(setOptOut(throwing('setItem'), true), 'unavailable');
  assert.equal(toggleOptOut(throwing('setItem')), 'unavailable');
  const stuck = fakeStorage({ [OPT_OUT_KEY]: '1' });
  stuck.removeItem = () => {
    throw new DOMException('denied', 'SecurityError');
  };
  assert.equal(setOptOut(stuck, false), 'unavailable');
});

test('a storage that silently ignores writes is detected by read-back and reported "unavailable"', () => {
  const s = fakeStorage();
  s.setItem = () => {};
  assert.equal(setOptOut(s, true), 'unavailable');
});

// ---------------------------------------------------------------------------
// 2. Copy (EN + ES, plain Latin American Spanish, usted)
// ---------------------------------------------------------------------------

const COPY_KEYS = [
  'optOutPageTitle',
  'optOutPageDescription',
  'optOutHeading',
  'optOutIntro',
  'optOutChecking',
  'optOutStatusCounted',
  'optOutStatusOptedOut',
  'optOutStatusUnavailable',
  'optOutButtonStop',
  'optOutButtonResume',
  'optOutScope',
  'optOutNoScript',
];

test('dictionary: every opt-out key exists with a non-empty EN and ES string', () => {
  for (const key of COPY_KEYS) {
    assert.ok(Object.prototype.hasOwnProperty.call(DICTIONARY, key), `missing dictionary key ${key}`);
    assert.ok(t(key, 'en').length > 0 && t(key, 'es').length > 0, `${key} must be non-empty in both languages`);
  }
});

test('dictionary: the status lines say the honest thing in both languages, with the same NOT/ARE emphasis', () => {
  assert.match(t('optOutStatusOptedOut', 'en'), /NOT being counted/);
  assert.match(t('optOutStatusCounted', 'en'), /ARE being counted/);
  assert.match(t('optOutStatusOptedOut', 'es'), /NO se están contando/);
  assert.match(t('optOutStatusCounted', 'es'), /SÍ se están contando/);
});

test('dictionary: the Spanish copy uses usted forms (no tu/vosotros forms) and the scope note is honest about limits in both languages', () => {
  const es = COPY_KEYS.map((k) => t(k, 'es')).join(' ');
  // Unambiguous tu/vosotros forms. ("usa", "borra", "cambia" are valid usted indicatives, so they
  // are deliberately not banned.) \b is ASCII-only in JS, so accented words use explicit lookarounds.
  assert.doesNotMatch(es, /(?<![\p{L}])(tú|tu|tus|ti|puedes|tienes|quieres|estás|eres|vosotros|vuestro|vuestra)(?![\p{L}])/iu, 'tu/vosotros forms found');
  assert.match(t('optOutIntro', 'es'), /\busted\b/i);
  assert.match(t('optOutScope', 'es'), /solo afecta a este navegador/i);
  assert.match(t('optOutScope', 'es'), /deberá/);
  assert.match(t('optOutScope', 'en'), /only affects this browser/i);
  assert.match(t('optOutScope', 'en'), /private browsing/i);
  assert.match(t('optOutScope', 'en'), /another browser or device/i);
  assert.match(t('optOutScope', 'en'), /no cookies/i);
});

// ---------------------------------------------------------------------------
// 3. Source wiring
// ---------------------------------------------------------------------------

const src = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

test('both pages exist, are noindex with no alternates, share one component, and are not linked from Base chrome', () => {
  for (const [rel, lang, canonical] of [
    ['src/pages/opt-out.astro', 'en', '/opt-out'],
    ['src/pages/es/opt-out.astro', 'es', '/es/opt-out'],
  ]) {
    assert.ok(existsSync(path.join(REPO_ROOT, rel)), `${rel} must exist`);
    const s = src(rel);
    assert.match(s, /<Base[\s\S]*\bnoindex\b/, `${rel} must pass noindex to Base`);
    assert.match(s, /alternates="none"/, `${rel} must declare no hreflang alternates`);
    assert.ok(s.includes(`canonicalPath="${canonical}"`), `${rel} canonicalPath ${canonical}`);
    assert.match(s, /<OptOut[^>]*lang=/, `${rel} must render the shared OptOut component`);
    assert.ok(lang === 'es' ? /lang="es"/.test(s) : true);
  }
  const base = src('src/layouts/Base.astro');
  assert.ok(!/opt-out/i.test(base), 'Base.astro (nav/footer chrome) must not link the opt-out pages');
});

test('the OptOut component: aria-live status, a real <button type="button">, no external requests, no cookies, uses the pure module', () => {
  const rel = 'src/components/OptOut.astro';
  assert.ok(existsSync(path.join(REPO_ROOT, rel)), `${rel} must exist`);
  const s = src(rel);
  assert.match(s, /aria-live="polite"/);
  assert.match(s, /<button[^>]*type="button"/);
  assert.match(s, /lib\/opt-out\.ts/);
  assert.doesNotMatch(s.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm, ''), /document\.cookie|fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//);
});

test('the sitemap filter drops both opt-out pages and nothing else new', () => {
  for (const p of OPT_OUT_PATHS) assert.equal(isSitemapExcludedPath(p), true, `${p} must be excluded from the sitemap`);
  assert.equal(isSitemapExcludedPath('/opt-outs'), false);
  assert.equal(isSitemapExcludedPath('/about'), false);
  assert.equal(isSitemapExcludedPath('/es/about'), false);
});

// ---------------------------------------------------------------------------
// 4. Rendered output (gated on a fresh build)
// ---------------------------------------------------------------------------

const STALE = staleDistReason(
  [
    'src/pages/opt-out.astro',
    'src/pages/es/opt-out.astro',
    'src/components/OptOut.astro',
    'src/lib/opt-out.ts',
    'src/lib/i18n/dictionary.ts',
    'src/lib/i18n/sitemap.ts',
    'astro.config.mjs',
  ],
  builtOptOutPagesExist
);

function walk(dir, ext, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, ext, out);
    else if (entry.endsWith(ext)) out.push(full);
  }
  return out;
}

test('opt-out (rendered): both pages are 200-able HTML with the right lang, noindex, no alternates, an aria-live status and a 44px-capable button', { skip: STALE ?? false }, () => {
  for (const [file, lang] of [
    ['opt-out.html', 'en'],
    ['es/opt-out.html', 'es'],
  ]) {
    const html = readFileSync(path.join(DIST_CLIENT, file), 'utf8');
    assert.match(html, new RegExp(`<html lang="${lang}">`));
    assert.match(html, /<meta name="robots" content="noindex"\s*\/?>/);
    assert.doesNotMatch(html, /<link rel="alternate" hreflang=/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /<button[^>]*type="button"/);
    assert.ok(html.includes(t('optOutHeading', lang)), `${file} shows the ${lang} heading`);
  }
});

test('opt-out (rendered): neither page is in any sitemap file, the news sitemaps or the RSS feeds, and only the two Privacy pages link to them', { skip: STALE ?? false }, () => {
  const indexXml = readFileSync(path.join(DIST_CLIENT, 'sitemap-index.xml'), 'utf8');
  const children = [...indexXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].replace('https://915tldr.com/', ''));
  for (const rel of [...children, 'news-sitemap.xml', 'es/news-sitemap.xml', 'rss.xml', 'es/rss.xml']) {
    const body = readFileSync(path.join(DIST_CLIENT, rel), 'utf8');
    assert.doesNotMatch(body, /opt-out/, `${rel} must not mention opt-out`);
  }
  // Chrome (nav/footer) and every static page: no link to the utility pages, with ONE deliberate
  // exception (owner decision 2026-10-08, "yes, add the opt-out sentence to v2"): the Umami
  // paragraph of the two Privacy pages carries a visitor-facing "turn analytics off for this
  // browser" link, mirroring v1. The opt-out pages themselves are exempt (the language switch on
  // /opt-out points at /es/opt-out and back). Anything else linking to them is still a leak.
  const PRIVACY = /[\\/](es[\\/])?privacy\.html$/;
  const linkers = walk(DIST_CLIENT, '.html')
    .filter((f) => !/[\\/](es[\\/])?opt-out\.html$/.test(f))
    .filter((f) => /href="\/(es\/)?opt-out"/.test(readFileSync(f, 'utf8')));
  const offenders = linkers.filter((f) => !PRIVACY.test(f));
  assert.deepEqual(offenders.slice(0, 5), [], 'only the Privacy pages may link to /opt-out or /es/opt-out');
  assert.equal(linkers.filter((f) => PRIVACY.test(f)).length, 2, 'both Privacy pages carry the opt-out link');
});
