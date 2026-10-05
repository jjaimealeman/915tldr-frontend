// 06-05 (Task 2, D-13/T-06-21): structurally guards against automatic language selection by
// scanning the real `src/` tree for the five forbidden surfaces (the `Accept-Language` header
// name, `navigator.language`/`navigator.languages`, the Cloudflare country header, `request.cf`/
// `.cf.country`, and `document.cookie`) — outside comments, since this project's own doc comments
// (`src/worker.ts`, `src/lib/article-url.ts`) correctly MENTION these surfaces to explain why they
// are never read. A fixture-string self-test proves the pattern actually catches each surface
// before trusting it against the real tree. Also extends the project's config-shape assertion
// convention (`tests/unit/astro-config.test.mjs`) to confirm `astro.config.mjs` defines no
// top-level `i18n` key — Astro's own i18n routing ships fallback-redirect helpers that are exactly
// the behavior D-13 forbids.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const SCAN_EXTENSIONS = new Set(['.ts', '.astro', '.mjs', '.vue']);

/** Case-insensitive pattern covering every surface D-13 forbids reading a language from. */
const FORBIDDEN_PATTERN =
  /accept-language|navigator\.languages?|cf-ipcountry|request\.cf\b|\.cf\.country|document\.cookie/i;

/**
 * Strips `<!-- -->` HTML comments, `/* *\/` block comments, and `//` line comments — but NOT a
 * `//` immediately preceded by `:` (a URL protocol separator, e.g. `https://...`), so a real,
 * non-comment line containing an absolute URL is never truncated.
 */
function stripComments(source) {
  let out = source.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(?<!:)\/\/.*$/gm, '');
  return out;
}

function findSourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      found.push(...findSourceFiles(full));
    } else if (SCAN_EXTENSIONS.has(path.extname(entry))) {
      found.push(full);
    }
  }
  return found;
}

function violationsIn(source) {
  const stripped = stripComments(source);
  const matches = stripped.match(new RegExp(FORBIDDEN_PATTERN, 'gi'));
  return matches ?? [];
}

// ---------------------------------------------------------------------------
// Self-test: the pattern must catch each of the five surfaces, and must NOT flag a comment
// mentioning them, or an unrelated URL containing "//".
// ---------------------------------------------------------------------------

test('no-auto-language pattern: catches a real (non-comment) read of each forbidden surface', () => {
  const fixtures = [
    'const lang = request.headers.get("Accept-Language");',
    'const lang = navigator.language;',
    'const langs = navigator.languages[0];',
    'const country = request.headers.get("CF-IPCountry");',
    'const country = request.cf.country;',
    'const country = ctx.request.cf.country;',
    'const cookie = document.cookie;',
  ];
  for (const fixture of fixtures) {
    assert.ok(
      violationsIn(fixture).length > 0,
      `expected the pattern to flag: ${fixture}`
    );
  }
});

test('no-auto-language pattern: ignores the surfaces when only mentioned inside comments', () => {
  const fixtures = [
    '// this file never reads Accept-Language, a cookie or request.cf to pick a language\nconst x = 1;',
    '/** Derives nothing from navigator.language or document.cookie (D-13). */\nconst x = 1;',
    '<!-- Does not read CF-IPCountry or request.cf.country -->\n<p>hi</p>',
  ];
  for (const fixture of fixtures) {
    assert.deepEqual(violationsIn(fixture), [], `expected no violations in: ${fixture}`);
  }
});

test('no-auto-language pattern: does not truncate a real line at a URL\'s "//" (protocol separator)', () => {
  const fixture =
    '<script is:inline defer src="https://stats.915websites.com/script.js" data-website-id="x"></script>';
  assert.deepEqual(violationsIn(fixture), []);
  // Confirm the URL itself survives stripping (i.e. it was not treated as a line comment).
  assert.ok(stripComments(fixture).includes('stats.915websites.com'));
});

// ---------------------------------------------------------------------------
// Real tree scan
// ---------------------------------------------------------------------------

test('no-auto-language: the real src/ tree has zero non-comment occurrences of any forbidden surface', () => {
  const files = findSourceFiles(SRC_DIR);
  assert.ok(files.length > 0, 'expected at least one source file to scan');

  const offenders = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const found = violationsIn(source);
    if (found.length > 0) {
      offenders.push(`${path.relative(REPO_ROOT, file)}: ${found.join(', ')}`);
    }
  }

  assert.deepEqual(offenders, [], `expected zero offenders, found:\n${offenders.join('\n')}`);
});

// ---------------------------------------------------------------------------
// astro.config.mjs defines no top-level i18n key (research anti-pattern)
// ---------------------------------------------------------------------------

/** Finds `marker`'s matching closing paren (depth-counted, so nested `{}`/`()` inside the call's
 * own arguments never confuses it) and returns the `[start, end)` span of everything between the
 * marker's own opening and closing parens — same technique `astro-config.test.mjs`'s
 * `extractCloudflareCallArgSource` already uses for the same reason (locating one specific call's
 * argument object in raw source text, not a regex that could match the wrong call). */
function findCallArgSpan(sourceText, marker) {
  const start = sourceText.indexOf(marker);
  if (start === -1) return null;
  let depth = 0;
  let argStart = -1;
  for (let i = start + marker.length - 1; i < sourceText.length; i++) {
    const ch = sourceText[i];
    if (ch === '(') {
      if (depth === 0) argStart = i + 1;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) return { start: argStart, end: i };
    }
  }
  return null;
}

test('astro.config.mjs: defines no top-level "i18n" config key', () => {
  const configSource = readFileSync(path.join(REPO_ROOT, 'astro.config.mjs'), 'utf8');
  const stripped = stripComments(configSource);
  // The config's own top-level keys (output, site, trailingSlash, build, session, adapter,
  // integrations, vite, experimental) are all object properties of the defineConfig({...}) call —
  // an added `i18n:` key would appear the same way. A plain `/\bi18n\s*:/` check (outside
  // comments) is sufficient since nothing else in this file's real TOP-LEVEL config object is
  // named i18n.
  //
  // 06-11 (Rule 1 fix): `@astrojs/sitemap`'s own `i18n` option (`sitemap({ i18n: {...} })`, per-
  // language `xhtml:link` alternates — an entirely different, legitimate thing from Astro's own
  // top-level routing `i18n` this test exists to forbid) is nested inside the `sitemap(...)`
  // integration call, several lines below this top-level object. A naive `/\bi18n\s*:/` match
  // over the whole file cannot tell the two apart, so the sitemap call's own argument span is
  // excised first — this test still catches a REAL top-level `i18n:` key appearing anywhere else
  // in the file (including a stray one added to `adapter: cloudflare({...})`).
  const sitemapCallArgs = findCallArgSpan(stripped, 'sitemap(');
  const withoutSitemapCallArgs = sitemapCallArgs
    ? stripped.slice(0, sitemapCallArgs.start) + stripped.slice(sitemapCallArgs.end)
    : stripped;
  assert.doesNotMatch(withoutSitemapCallArgs, /\bi18n\s*:/);
});

test('astro.config.mjs: the sitemap() integration call itself DOES set its own i18n option (sanity check for the test above)', () => {
  const configSource = readFileSync(path.join(REPO_ROOT, 'astro.config.mjs'), 'utf8');
  const stripped = stripComments(configSource);
  const sitemapCallArgs = findCallArgSpan(stripped, 'sitemap(');
  assert.ok(sitemapCallArgs, 'expected to find a sitemap(...) call in astro.config.mjs');
  const sitemapCallSource = stripped.slice(sitemapCallArgs.start, sitemapCallArgs.end);
  assert.match(
    sitemapCallSource,
    /\bi18n\s*:/,
    'expected the real sitemap() call to set its own i18n option — if this fails, the exclusion above may be silently hiding a real top-level i18n key instead'
  );
});
