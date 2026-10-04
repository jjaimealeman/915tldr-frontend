// 06-12 (I18N-03, success criterion 2 "verified per page pair"): full-corpus `<html lang>` and
// `/es` link-containment invariant. Every built page — static (`dist/client`) AND archived
// (`dist/archive`, named by `dist/archive-plan.json`) — under `/es` must render `<html lang="es">`
// and keep every internal `<a href>` under `/es` (external, mailto and fragment hrefs excepted,
// plus the one deliberate language-switch link back to English — D-12, the established exception
// from `tests/unit/es-static-pages.test.mjs`); every other page must render `<html lang="en">`.
// No DOM library — plain regex extraction, run over the WHOLE corpus instead of a fixed sample.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

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

/** Same URL-path mapping as `tests/unit/hreflang-pairs.test.mjs` (`build.format: 'file'` +
 * `trailingSlash: 'never'`, D-07/D-13). */
function pathForRelHtml(relPath) {
  if (relPath === 'index.html') return '/';
  if (relPath.endsWith('/index.html')) return `/${relPath.slice(0, -'/index.html'.length)}`;
  return `/${relPath.slice(0, -'.html'.length)}`;
}

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

function isEsPath(p) {
  return p === '/es' || p.startsWith('/es/');
}

function extractLangAttr(html) {
  const m = html.match(/<html lang="([^"]+)">/);
  return m ? m[1] : null;
}

/** Every internal (same-origin, path-only) `<a href>` on the page — external (`http(s)://`,
 * `//...`), `mailto:` and fragment (`#...`) hrefs never start with `/`, so filtering on that one
 * condition excludes all three at once, matching `tests/unit/es-static-pages.test.mjs`'s own
 * `internalHrefs()`. */
function internalHrefs(html) {
  const hrefs = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  return hrefs.filter((href) => href.startsWith('/') && !href.startsWith('//'));
}

/** The one deliberate exception (D-12): the header's language-switch link, which always points at
 * the OTHER language's pair of the current page by design (`src/layouts/Base.astro`'s
 * `switchPath`). Matches the `[data-lang-switch]` anchor regardless of which language it targets
 * (an `/es` page's switch link targets English; this helper is reused for both directions). */
function switchLinkHref(html) {
  const match = html.match(/<p data-lang-switch>\s*<a href="([^"]+)"/);
  return match ? match[1] : null;
}

test(
  'es-lang-and-links: full corpus — every /es page is lang="es" with /es-only internal links (switch link excepted), every other page is lang="en"',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const start = Date.now();
    const pages = buildCorpus();
    assert.ok(pages.length > 1000, `expected a large real corpus, got ${pages.length} pages`);

    const failures = [];
    let esChecked = 0;
    let enChecked = 0;

    for (const { path: pagePath, absFile } of pages) {
      const html = readFileSync(absFile, 'utf8');
      const lang = extractLangAttr(html);
      const expectLang = isEsPath(pagePath) ? 'es' : 'en';

      if (lang !== expectLang) {
        failures.push(`${pagePath}: <html lang> is ${JSON.stringify(lang)}, expected "${expectLang}"`);
      }

      if (isEsPath(pagePath)) {
        esChecked += 1;
        const switchHref = switchLinkHref(html);
        const hrefs = internalHrefs(html);
        for (const href of hrefs) {
          if (href === switchHref) continue; // D-12: the deliberate switch-to-English link
          if (!href.startsWith('/es')) {
            failures.push(`${pagePath}: internal href "${href}" does not start with /es`);
          }
        }
      } else {
        enChecked += 1;
      }
    }

    const elapsedMs = Date.now() - start;
    console.log(`[es-lang-and-links] checked ${pages.length} pages (${esChecked} /es, ${enChecked} other) in ${elapsedMs}ms`);

    if (failures.length > 0) {
      const shown = failures.slice(0, MAX_REPORTED_FAILURES);
      const more = failures.length > MAX_REPORTED_FAILURES ? ` (+${failures.length - MAX_REPORTED_FAILURES} more)` : '';
      assert.fail(`${failures.length} lang/link violation(s) found:\n${shown.join('\n')}${more}`);
    }
  }
);
