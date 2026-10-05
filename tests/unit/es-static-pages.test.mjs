// 06-07 Task 2 (D-17, I18N-04): proves the five Spanish static page types against REAL built
// output — follows tests/unit/static-pages.test.mjs's and tests/unit/es-article-pages.test.mjs's
// "assert on rendered output, skip if unbuilt" convention. Covers this task's own <behavior>
// block: /es/changelog's Spanish chrome + untranslated lang="en" entries matching the English
// page's count, reciprocal hreflang + self canonical on all five /es static pages, and the
// /es-only internal-link discipline (D-14) on all five.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_BUILT = existsSync(DIST_CLIENT);
const SKIP_REASON = 'dist/client not found — run `pnpm build` first (pnpm test:unit does this automatically)';

function readDist(relPath) {
  return readFileSync(path.join(DIST_CLIENT, relPath), 'utf8');
}

function distFileExists(relPath) {
  return existsSync(path.join(DIST_CLIENT, relPath));
}

function extractCanonical(html) {
  const match = html.match(/<link rel="canonical" href="([^"]+)"/);
  return match ? match[1] : null;
}

function extractAlternates(html) {
  const matches = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)];
  return matches.map((m) => ({ hreflang: m[1], href: m[2] }));
}

// ---------------------------------------------------------------------------
// /es/changelog (D-17)
// ---------------------------------------------------------------------------

test(
  'es-static-pages: es/changelog.html has <html lang="es">, a Spanish heading/intro and the English-build-notes note',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    assert.ok(distFileExists('es/changelog.html'));
    const html = readDist('es/changelog.html');
    assert.match(html, /<html lang="es">/);
    assert.match(html, /<h1>Registro de cambios<\/h1>/);
    assert.match(html, /Las notas de la versión se publican en inglés\./);
  }
);

test(
  'es-static-pages: es/changelog.html renders the same number of dispatch entries as changelog.html, each inside a lang="en" element',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const enHtml = readDist('changelog.html');
    const esHtml = readDist('es/changelog.html');

    const enCount = (enHtml.match(/<article data-dispatch>/g) ?? []).length;
    const esDispatchEls = [...esHtml.matchAll(/<article data-dispatch([^>]*)>/g)];
    assert.equal(esDispatchEls.length, enCount, 'expected the same number of dispatch entries on /es/changelog as /changelog');
    assert.ok(esDispatchEls.length > 0, 'expected at least one dispatch entry');
    for (const match of esDispatchEls) {
      assert.match(match[1], /lang="en"/, 'expected every /es/changelog entry element to carry lang="en"');
    }
  }
);

// ---------------------------------------------------------------------------
// hreflang + self canonical — all five Spanish static page types
// ---------------------------------------------------------------------------

const STATIC_PAGE_PAIRS = [
  { es: 'es/about.html', en: 'https://915tldr.com/about', esCanonical: 'https://915tldr.com/es/about' },
  { es: 'es/privacy.html', en: 'https://915tldr.com/privacy', esCanonical: 'https://915tldr.com/es/privacy' },
  { es: 'es/terms.html', en: 'https://915tldr.com/terms', esCanonical: 'https://915tldr.com/es/terms' },
  { es: 'es/contact.html', en: 'https://915tldr.com/contact', esCanonical: 'https://915tldr.com/es/contact' },
  { es: 'es/changelog.html', en: 'https://915tldr.com/changelog', esCanonical: 'https://915tldr.com/es/changelog' },
];

for (const pair of STATIC_PAGE_PAIRS) {
  test(
    `es-static-pages: ${pair.es} has a self canonical and reciprocal en/es/x-default hreflang with its English page`,
    { skip: !DIST_BUILT && SKIP_REASON },
    () => {
      assert.ok(distFileExists(pair.es), `expected dist/client/${pair.es} to exist`);
      const html = readDist(pair.es);
      assert.equal(extractCanonical(html), pair.esCanonical);

      const alternates = extractAlternates(html);
      const byLang = new Map(alternates.map((a) => [a.hreflang, a.href]));
      assert.equal(byLang.get('en'), pair.en, `expected an en alternate pointing at ${pair.en}`);
      assert.equal(byLang.get('es'), pair.esCanonical, `expected an es alternate pointing at ${pair.esCanonical}`);
      assert.equal(byLang.get('x-default'), pair.en, 'expected x-default to point at the English page');
      assert.equal(alternates.length, 3, 'expected exactly 3 alternate links (en, es, x-default)');
    }
  );
}

// ---------------------------------------------------------------------------
// /es-only internal links (D-14) — all five Spanish static page types
// ---------------------------------------------------------------------------

function internalHrefs(html) {
  const hrefs = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  return hrefs.filter((href) => href.startsWith('/') && !href.startsWith('//'));
}

/** The one deliberate exception (D-12): the header's language-switch link to the English pair of
 * the current page — e.g. `<p data-lang-switch><a href="/terms" hreflang="en" lang="en">...`. */
function switchLinkHref(html) {
  const match = html.match(/<p data-lang-switch><a href="([^"]+)" hreflang="en" lang="en">/);
  return match ? match[1] : null;
}

for (const pair of STATIC_PAGE_PAIRS) {
  test(
    `es-static-pages: every internal href on ${pair.es} starts with /es, except the language switch and fragment links`,
    { skip: !DIST_BUILT && SKIP_REASON },
    () => {
      const html = readDist(pair.es);
      const hrefs = internalHrefs(html);
      assert.ok(hrefs.length > 0, 'expected at least one internal href to check');

      const switchHref = switchLinkHref(html);
      assert.ok(switchHref, `expected a [data-lang-switch] link on ${pair.es}`);

      for (const href of hrefs) {
        if (href === switchHref) continue; // the deliberate language switch target (D-12)
        if (href.startsWith('#')) continue; // skip link / in-page fragment
        assert.ok(href.startsWith('/es'), `expected internal href "${href}" on ${pair.es} to start with /es`);
      }
    }
  );
}
