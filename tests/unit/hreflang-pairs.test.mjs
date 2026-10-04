// 06-12 (I18N-05, success criterion 2 — "verified per page pair"): full-corpus reciprocal hreflang
// invariant. Every built page — static (`dist/client`) AND archived (`dist/archive`, named by
// `dist/archive-plan.json`) — that declares alternates must have its en/es hrefs point at each
// other's canonicals, x-default equal to the English URL, and every alternate target resolve to a
// page this build actually produced; a noindex page must declare no alternates at all. No DOM
// library — plain regex extraction over raw HTML, matching `tests/unit/hreflang.test.mjs`'s own
// `extractAlternates()` convention, just run over the WHOLE corpus instead of two fixed samples.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pairedPath } from '../../src/lib/i18n/hreflang.ts';
import { languageOfPath } from '../../src/lib/article-url.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_ARCHIVE = path.join(REPO_ROOT, 'dist', 'archive');
const ARCHIVE_PLAN_PATH = path.join(REPO_ROOT, 'dist', 'archive-plan.json');

const DIST_BUILT = existsSync(DIST_CLIENT);
const SKIP_REASON = 'dist/client not found — run `pnpm build` first (pnpm test:unit does this automatically)';

const MAX_REPORTED_FAILURES = 20;

/** Recursively lists every `.html` file under `dir`, relative to `dir`, POSIX-separated. */
function walkHtml(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      out.push(...walkHtml(full).map((p) => path.join(entry, p)));
    } else if (info.isFile() && entry.endsWith('.html')) {
      out.push(entry);
    }
  }
  return out.map((p) => p.split(path.sep).join('/'));
}

/** Maps a `dist/client`-relative `.html` file path to its canonical URL path, per this project's
 * `build.format: 'file'` + `trailingSlash: 'never'` contract (D-07/D-13): `index.html` -> `/`,
 * `<x>/index.html` -> `/<x>`, otherwise `/<relPath without .html>`. */
function pathForRelHtml(relPath) {
  if (relPath === 'index.html') return '/';
  if (relPath.endsWith('/index.html')) return `/${relPath.slice(0, -'/index.html'.length)}`;
  return `/${relPath.slice(0, -'.html'.length)}`;
}

/** Builds the full-corpus page registry: `{ path, absFile }` for every static page under
 * `dist/client` plus every archived page named in `dist/archive-plan.json` (whose file lives at
 * `dist/archive/<key>`) — the two trees together are "every page this build produced." */
function buildCorpus() {
  const pages = [];
  for (const relPath of walkHtml(DIST_CLIENT)) {
    pages.push({ path: pathForRelHtml(relPath), absFile: path.join(DIST_CLIENT, relPath) });
  }
  if (existsSync(ARCHIVE_PLAN_PATH)) {
    const plan = JSON.parse(readFileSync(ARCHIVE_PLAN_PATH, 'utf8'));
    for (const entry of plan.entries) {
      pages.push({ path: entry.path, absFile: path.join(DIST_ARCHIVE, entry.key) });
    }
  }
  return pages;
}

function extractAlternates(html) {
  return [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/g)].map((m) => ({
    hreflang: m[1],
    href: m[2],
  }));
}

function hasNoindex(html) {
  return /<meta name="robots" content="noindex"\s*\/?>/.test(html);
}

/** Pathname of an absolute `href` (every alternate this project emits is `new URL(path, origin)
 * .href` — an absolute URL, per `src/lib/i18n/hreflang.ts`). Falls back to the raw string if it
 * doesn't parse as a URL (should never happen for a well-formed alternate; a failure to parse is
 * itself a real finding, not something to swallow). */
function pathFromHref(href) {
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

test(
  'hreflang-pairs: full corpus — reciprocal en/es pairs, x-default, no alternates on noindex, every target resolves to a built page',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const start = Date.now();
    const pages = buildCorpus();
    assert.ok(pages.length > 1000, `expected a large real corpus, got ${pages.length} pages`);

    const records = pages.map(({ path: pagePath, absFile }) => {
      const html = readFileSync(absFile, 'utf8');
      return { path: pagePath, noindex: hasNoindex(html), alternates: extractAlternates(html) };
    });
    const byPath = new Map(records.map((r) => [r.path, r]));

    const failures = [];
    let pairedChecked = 0;
    let selfChecked = 0;
    let noAlternates = 0;

    for (const r of records) {
      if (r.noindex) {
        if (r.alternates.length > 0) {
          failures.push(`${r.path}: noindex page declares ${r.alternates.length} alternate link(s)`);
        }
        continue;
      }

      if (r.alternates.length === 0) {
        noAlternates += 1;
        continue; // a page with no canonicalPath at all emits no alternates — not itself a violation
      }

      const byLang = new Map(r.alternates.map((a) => [a.hreflang, a.href]));
      const enHref = byLang.get('en');
      const esHref = byLang.get('es');
      const xdefaultHref = byLang.get('x-default');

      if (!enHref || !xdefaultHref) {
        failures.push(`${r.path}: missing en or x-default alternate (got ${JSON.stringify(r.alternates)})`);
        continue;
      }
      if (enHref !== xdefaultHref) {
        failures.push(`${r.path}: x-default (${xdefaultHref}) does not equal en (${enHref})`);
      }

      for (const href of [enHref, esHref, xdefaultHref].filter(Boolean)) {
        const targetPath = pathFromHref(href);
        if (!byPath.has(targetPath)) {
          failures.push(`${r.path}: alternate target "${href}" (${targetPath}) is not a page this build produced`);
        }
      }

      // Reciprocity, checked via the independent path-math helper (`pairedPath`), NOT by
      // trusting either side's own self-reported href — on an /es page, its own "es" alternate
      // is a SELF-reference (the page pairs with English, not with itself), so parsing that href
      // to find "the other page" would wrongly treat the page as its own counterpart. Computing
      // the expected counterpart path directly sidesteps that ambiguity entirely.
      const lang = languageOfPath(r.path);
      if (lang === 'en') {
        const expectedEnPath = r.path;
        if (pathFromHref(enHref) !== expectedEnPath) {
          failures.push(`${r.path}: own "en" alternate (${enHref}) does not equal its own canonical path`);
        }
        if (esHref) {
          pairedChecked += 1;
          const expectedEsPath = pairedPath(r.path);
          if (pathFromHref(esHref) !== expectedEsPath) {
            failures.push(`${r.path}: own "es" alternate (${esHref}) does not equal the expected pair ${expectedEsPath}`);
          }
          const esRecord = byPath.get(expectedEsPath);
          if (esRecord) {
            const esByLang = new Map(esRecord.alternates.map((a) => [a.hreflang, a.href]));
            const esOwnEn = esByLang.get('en');
            const esOwnEs = esByLang.get('es');
            if (!esOwnEn || pathFromHref(esOwnEn) !== expectedEnPath) {
              failures.push(
                `${r.path} <-> ${expectedEsPath}: es page's own "en" alternate (${esOwnEn ?? 'missing'}) does not point back at ${expectedEnPath}`
              );
            }
            if (!esOwnEs || pathFromHref(esOwnEs) !== expectedEsPath) {
              failures.push(
                `${r.path} <-> ${expectedEsPath}: es page's own "es" alternate (${esOwnEs ?? 'missing'}) does not self-reference ${expectedEsPath}`
              );
            }
          }
          // esRecord missing is already reported above via the "not a built page" check.
        } else {
          selfChecked += 1; // mode "self" — an English page with no Spanish counterpart yet (06-09)
        }
      } else {
        // lang === 'es': every indexable /es page is paired (D-05's untranslated fallback pages
        // are noindex, handled in the branch above) — verify its own hrefs point at the expected
        // pair without re-running the cross-check already performed once from the English side.
        const expectedEsPath = r.path;
        const expectedEnPath = pairedPath(r.path);
        if (!esHref || pathFromHref(esHref) !== expectedEsPath) {
          failures.push(`${r.path}: own "es" alternate (${esHref ?? 'missing'}) does not self-reference ${expectedEsPath}`);
        }
        if (pathFromHref(enHref) !== expectedEnPath) {
          failures.push(`${r.path}: own "en" alternate (${enHref}) does not equal the expected pair ${expectedEnPath}`);
        }
      }
    }

    const elapsedMs = Date.now() - start;
    console.log(
      `[hreflang-pairs] checked ${records.length} pages (${pairedChecked} paired, ${selfChecked} self, ` +
        `${noAlternates} with no alternates) in ${elapsedMs}ms`
    );

    if (failures.length > 0) {
      const shown = failures.slice(0, MAX_REPORTED_FAILURES);
      const more = failures.length > MAX_REPORTED_FAILURES ? ` (+${failures.length - MAX_REPORTED_FAILURES} more)` : '';
      assert.fail(`${failures.length} hreflang violation(s) found:\n${shown.join('\n')}${more}`);
    }
  }
);
