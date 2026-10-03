// 06-05 (Task 1): pure builder coverage for `alternateLinks`/`pairedPath`, plus dist-based checks
// proving a real build emits a reciprocal `/` <-> `/es` hreflang pair with Spanish chrome and
// /es-only internal links. Follows `tests/unit/chrome.test.mjs`'s dist-based, skip-when-absent
// pattern (04-02).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { alternateLinks, pairedPath } from '../../src/lib/i18n/hreflang.ts';

const ORIGIN = 'https://915tldr.com';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_BUILT = existsSync(DIST_CLIENT);
const SKIP_REASON = 'dist/client not found — run `pnpm build` first (pnpm test:unit does this automatically)';

function readDist(relPath) {
  return readFileSync(path.join(DIST_CLIENT, relPath), 'utf8');
}

// ---------------------------------------------------------------------------
// Pure builder tests
// ---------------------------------------------------------------------------

test('pairedPath: English path -> /es-prefixed, Spanish path -> bare English path', () => {
  assert.equal(pairedPath('/crime'), '/es/crime');
  assert.equal(pairedPath('/es/crime'), '/crime');
  assert.equal(pairedPath('/'), '/es');
  assert.equal(pairedPath('/es'), '/');
});

test('alternateLinks: mode "paired" on an English page returns en/es/x-default in that fixed order, absolute URLs', () => {
  const links = alternateLinks({ canonicalPath: '/crime', lang: 'en', mode: 'paired', origin: ORIGIN });
  assert.deepEqual(links, [
    { hreflang: 'en', href: 'https://915tldr.com/crime' },
    { hreflang: 'es', href: 'https://915tldr.com/es/crime' },
    { hreflang: 'x-default', href: 'https://915tldr.com/crime' },
  ]);
});

test('alternateLinks: mode "paired" on a Spanish page returns the same reciprocal set', () => {
  const links = alternateLinks({ canonicalPath: '/es/crime', lang: 'es', mode: 'paired', origin: ORIGIN });
  assert.deepEqual(links, [
    { hreflang: 'en', href: 'https://915tldr.com/crime' },
    { hreflang: 'es', href: 'https://915tldr.com/es/crime' },
    { hreflang: 'x-default', href: 'https://915tldr.com/crime' },
  ]);
});

test('alternateLinks: mode "self" returns only en (self) and x-default (self)', () => {
  const links = alternateLinks({ canonicalPath: '/crime', lang: 'en', mode: 'self', origin: ORIGIN });
  assert.deepEqual(links, [
    { hreflang: 'en', href: 'https://915tldr.com/crime' },
    { hreflang: 'x-default', href: 'https://915tldr.com/crime' },
  ]);
});

test('alternateLinks: mode "none" returns an empty array', () => {
  assert.deepEqual(alternateLinks({ canonicalPath: '/crime', lang: 'en', mode: 'none', origin: ORIGIN }), []);
});

test('alternateLinks: throws on an invalid mode or language', () => {
  assert.throws(() => alternateLinks({ canonicalPath: '/crime', lang: 'en', mode: 'bogus', origin: ORIGIN }));
  assert.throws(() => alternateLinks({ canonicalPath: '/crime', lang: 'fr', mode: 'paired', origin: ORIGIN }));
});

// ---------------------------------------------------------------------------
// Dist-based reciprocity + /es-only-internal-links checks
// ---------------------------------------------------------------------------

function extractAlternates(html) {
  return [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => ({
    hreflang: m[1],
    href: m[2],
  }));
}

test('hreflang: dist/client/index.html and es.html exist', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(existsSync(path.join(DIST_CLIENT, 'index.html')), 'expected dist/client/index.html');
  assert.ok(existsSync(path.join(DIST_CLIENT, 'es.html')), 'expected dist/client/es.html');
});

test(
  'hreflang: / and /es emit reciprocal en/es/x-default alternates, in that fixed order',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const homeHtml = readDist('index.html');
    const esHtml = readDist('es.html');

    const homeAlternates = extractAlternates(homeHtml);
    const esAlternates = extractAlternates(esHtml);

    const expected = [
      { hreflang: 'en', href: 'https://915tldr.com/' },
      { hreflang: 'es', href: 'https://915tldr.com/es' },
      { hreflang: 'x-default', href: 'https://915tldr.com/' },
    ];

    assert.deepEqual(homeAlternates, expected, 'expected / to carry the reciprocal alternate set');
    assert.deepEqual(esAlternates, expected, 'expected /es to carry the identical reciprocal alternate set');
  }
);

test('hreflang: es.html declares <html lang="es">, index.html declares <html lang="en">', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const homeHtml = readDist('index.html');
  const esHtml = readDist('es.html');
  assert.match(homeHtml, /<html lang="en">/);
  assert.match(esHtml, /<html lang="es">/);
});

test(
  'hreflang: es.html carries a header language-switch link with text "English" to "/"',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const esHtml = readDist('es.html');
    const switchMatch = esHtml.match(/<p data-lang-switch>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    assert.ok(switchMatch, 'expected a [data-lang-switch] link in es.html');
    assert.equal(switchMatch[1], '/');
    assert.equal(switchMatch[2], 'English');
  }
);

test(
  'hreflang: index.html carries a header language-switch link with text "Español" to "/es"',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const homeHtml = readDist('index.html');
    const switchMatch = homeHtml.match(/<p data-lang-switch>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    assert.ok(switchMatch, 'expected a [data-lang-switch] link in index.html');
    assert.equal(switchMatch[1], '/es');
    assert.equal(switchMatch[2], 'Español');
  }
);

test(
  'hreflang: every internal href on es.html starts with /es, except the switch link ("/"), "#main" and external links',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const esHtml = readDist('es.html');
    // Scoped to <a> elements (navigable links) — not every `href="..."` in the document: font
    // preload <link>s and the canonical/alternate/RSS <link>s are resource references, not
    // internal navigation, and are deliberately NOT /es-prefixed (fonts aren't a language-scoped
    // resource; canonical/alternate/RSS hrefs are absolute URLs already covered by the
    // reciprocity test above).
    const hrefs = [...esHtml.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
    const violations = [];
    for (const href of hrefs) {
      if (href.startsWith('http')) continue; // external
      if (href === '#main') continue; // skip link
      if (href === '/') continue; // the language switch, deliberately pointing to English
      if (!href.startsWith('/es')) violations.push(href);
    }
    assert.deepEqual(violations, [], `expected every other internal href to start with /es, found: ${violations.join(', ')}`);
  }
);
