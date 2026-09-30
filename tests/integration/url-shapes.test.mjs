// 04-12: live URL-contract suite against the DEPLOYED dev site — SEO-04, SEO-06, SEO-08, FIX-04,
// FIX-05. Every request in this file is a real HTTP request against `LIVE_ORIGIN` (default
// `https://dev.915tldr.com`); nothing here is a build-output or fixture check. `redirect:
// 'manual'` throughout, so a redirect is observed as a 3xx response with a `location` header
// rather than silently followed.
//
// T-04-48 (this plan's own threat register): before trusting any other result, confirm the
// deployed commit actually matches local HEAD — a stale deploy verified by mistake would make
// every other check here meaningless.
//
// Every redirect-producing case runs TWICE: once with browser navigation headers
// (`Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document`, `Sec-Fetch-Site: none`, `Accept:
// text/html` — what a real link click sends) and once with none of those (what a bare `curl` or
// `fetch` sends). `wrangler.jsonc`'s `assets_navigation_has_no_effect` compatibility flag exists
// precisely because these two request kinds can be routed differently by Workers Static Assets —
// see 04-06-SUMMARY.md and this project's own CLAUDE.md verification standard ("drive the path
// the user takes"). A curl-only check would have missed the navigation-header routing trap the
// planning phase (04-06) found.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ARTICLE_SLUG_RE } from '../../src/lib/article-url.ts';
import { CATEGORIES } from '../../src/lib/categories.ts';

const LIVE_ORIGIN = process.env.LIVE_ORIGIN ?? 'https://dev.915tldr.com';
const ARTICLE_SAMPLE_SIZE = 5;
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;
// Small slack past the exact 48h boundary — network/build-clock skew between `builtAt` (recorded
// the instant the build process ran) and this test's own run (minutes to hours later against a
// live deploy) must not produce a false failure on an article sitting right at the edge.
const NEWS_WINDOW_SLACK_MS = 5 * 60 * 1000;

const NAVIGATE_HEADERS = {
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Site': 'none',
  Accept: 'text/html',
};
const PLAIN_HEADERS = {};

const REQUEST_KINDS = [
  ['navigation headers', NAVIGATE_HEADERS],
  ['plain request headers', PLAIN_HEADERS],
];

/** Matches a trailing 8-4-4-4-12 hex uuid at the end of a string — the same shape
 * `src/lib/article-redirect.ts`'s `TRAILING_UUID_RE` extracts from a request pathname in
 * production. Used here (not a single greedy `slug-uuid` regex) so a slug ending in
 * hex-and-hyphen-looking text can never be mis-split — the uuid boundary is found the same way
 * the deployed Worker itself finds it, not re-derived independently. */
const TRAILING_UUID_RE =
  /-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

/** True when `pathname` is a well-formed `/${category}/${slug}-${uuid}` canonical article path
 * (exactly two segments, second segment ends in a valid uuid, remainder is a valid slug). */
function isCanonicalArticlePath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 2) return false;
  const [, slugAndUuid] = segments;
  const uuidMatch = slugAndUuid.match(TRAILING_UUID_RE);
  if (!uuidMatch) return false;
  const slug = slugAndUuid.slice(0, slugAndUuid.length - uuidMatch[1].length - 1);
  return ARTICLE_SLUG_RE.test(slug);
}

async function fetchManual(path, headers = {}) {
  return fetch(`${LIVE_ORIGIN}${path}`, { redirect: 'manual', headers });
}

/** Resolves a `location` header (absolute or relative) to a pathname comparable against a
 * canonical path built without an origin. */
function locationPathname(location) {
  return new URL(location, LIVE_ORIGIN).pathname;
}

/**
 * Fetches `/rss.xml` from the live origin and returns up to `ARTICLE_SAMPLE_SIZE` canonical
 * article paths (pathname only — `astro.config.mjs`'s `site` is the PRODUCTION origin
 * `https://915tldr.com`, so every `<link>`/`<guid>` in the feed is an absolute production URL
 * regardless of which host actually serves the feed; only the path is reusable against
 * `LIVE_ORIGIN`).
 */
async function fetchSampleArticlePaths() {
  const res = await fetchManual('/rss.xml');
  assert.equal(res.status, 200, '/rss.xml must answer 200 to sample article URLs from it');
  const xml = await res.text();

  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  assert.ok(itemBlocks.length > 0, '/rss.xml must contain at least one <item>');

  const paths = [];
  for (const block of itemBlocks) {
    const linkMatch = block.match(/<link>([^<]+)<\/link>/);
    assert.ok(linkMatch, 'every RSS <item> must carry a <link>');
    const pathname = new URL(linkMatch[1]).pathname;
    assert.ok(
      isCanonicalArticlePath(pathname),
      `RSS item link "${linkMatch[1]}" must resolve to a canonical article path`
    );
    paths.push(pathname);
    if (paths.length >= ARTICLE_SAMPLE_SIZE) break;
  }
  assert.equal(
    paths.length,
    ARTICLE_SAMPLE_SIZE,
    `expected at least ${ARTICLE_SAMPLE_SIZE} article links in /rss.xml`
  );
  return paths;
}

function parseCanonicalPath(pathname) {
  assert.ok(isCanonicalArticlePath(pathname), `"${pathname}" must be a canonical article path`);
  const [category, slugAndUuid] = pathname.split('/').filter(Boolean);
  const uuid = slugAndUuid.match(TRAILING_UUID_RE)[1];
  const slug = slugAndUuid.slice(0, slugAndUuid.length - uuid.length - 1);
  return { category, slug, uuid };
}

// ---------------------------------------------------------------------------------------------
// T-04-48: stale-deploy guard. Every other check in this file is meaningless if the deployed
// commit is not the commit actually under test — fail fast and name both commits.
// ---------------------------------------------------------------------------------------------
test('T-04-48: /version.json reports the deployed commit equals local HEAD (stale-deploy guard)', async () => {
  const res = await fetchManual('/version.json');
  assert.equal(res.status, 200);
  const body = await res.json();
  const localHead = execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  assert.equal(
    body.commit,
    localHead,
    `deployed commit (${body.commit}) must equal local HEAD (${localHead}) — every other check in this file trusts this deploy`
  );
});

let sampleArticlePaths;

test('url-shapes: sample 5 article URLs from the live /rss.xml', async () => {
  sampleArticlePaths = await fetchSampleArticlePaths();
  assert.equal(sampleArticlePaths.length, ARTICLE_SAMPLE_SIZE);
});

for (const [kindName, headers] of REQUEST_KINDS) {
  test(`url-shapes (${kindName}): every sampled canonical article URL answers 200 with no location header`, async () => {
    for (const canonicalPath of sampleArticlePaths) {
      const res = await fetchManual(canonicalPath, headers);
      assert.equal(res.status, 200, `${canonicalPath} must answer 200`);
      assert.equal(
        res.headers.get('location'),
        null,
        `${canonicalPath} must carry no location header`
      );
    }
  });

  test(`url-shapes (${kindName}): the trailing-slash variant of a canonical article URL redirects once to the no-slash canonical`, async () => {
    for (const canonicalPath of sampleArticlePaths) {
      const res = await fetchManual(`${canonicalPath}/`, headers);
      assert.ok(
        res.status >= 300 && res.status < 400,
        `${canonicalPath}/ must answer a 3xx redirect, got ${res.status}`
      );
      const location = res.headers.get('location');
      assert.ok(location, `${canonicalPath}/ must carry a location header`);
      assert.equal(
        locationPathname(location),
        canonicalPath,
        `${canonicalPath}/ must redirect to the exact no-slash canonical path`
      );
      // Named deviation (docs/phase-04/spikes.md): Cloudflare's native html_handling never emits
      // 301 in any mode — 307 is the documented, measured, and accepted status here. Recorded via
      // diagnostic, not asserted to a single value, so this test never breaks if Cloudflare's
      // documented behavior for this mode changes.
      console.log(
        `[url-shapes] trailing-slash redirect for ${canonicalPath}/ (${kindName}): observed status ${res.status}`
      );
    }
  });

  test(`url-shapes (${kindName}): the same article under a wrong category and a wrong slug redirects (301) to the canonical`, async () => {
    const canonicalPath = sampleArticlePaths[0];
    const { category, uuid } = parseCanonicalPath(canonicalPath);
    const wrongCategory = CATEGORIES.find((c) => c.slug !== category)?.slug;
    assert.ok(wrongCategory, 'need at least one category different from the sampled article’s own');
    const wrongPath = `/${wrongCategory}/definitely-the-wrong-slug-${uuid}`;

    const res = await fetchManual(wrongPath, headers);
    assert.equal(res.status, 301, `${wrongPath} must answer 301`);
    const location = res.headers.get('location');
    assert.ok(location, `${wrongPath} must carry a location header`);
    assert.equal(
      locationPathname(location),
      canonicalPath,
      `${wrongPath} must redirect to the real canonical path`
    );
  });

  test(`url-shapes (${kindName}): /article/<uuid> redirects (301) to the canonical`, async () => {
    const canonicalPath = sampleArticlePaths[0];
    const { uuid } = parseCanonicalPath(canonicalPath);
    const legacyPath = `/article/${uuid}`;

    const res = await fetchManual(legacyPath, headers);
    assert.equal(res.status, 301, `${legacyPath} must answer 301`);
    const location = res.headers.get('location');
    assert.ok(location, `${legacyPath} must carry a location header`);
    assert.equal(
      locationPathname(location),
      canonicalPath,
      `${legacyPath} must redirect to the real canonical path`
    );
  });

  test(`url-shapes (${kindName}): a well-formed but unknown uuid answers 404 with 404-suggestions markup`, async () => {
    const canonicalPath = sampleArticlePaths[0];
    const { category, slug } = parseCanonicalPath(canonicalPath);
    const unknownUuid = crypto.randomUUID();
    const unknownPath = `/${category}/${slug}-${unknownUuid}`;

    const res = await fetchManual(unknownPath, headers);
    assert.equal(res.status, 404, `${unknownPath} must answer 404`);
    const body = await res.text();
    assert.match(
      body,
      /data-404-suggestions/,
      `${unknownPath}'s 404 body must contain the data-404-suggestions section`
    );
  });

  test(`url-shapes (${kindName}): a path with no uuid at all answers 404`, async () => {
    const noUuidPath = '/crime/this-page-has-no-uuid-in-it-at-all';
    const res = await fetchManual(noUuidPath, headers);
    assert.equal(res.status, 404, `${noUuidPath} must answer 404`);
  });

  for (const category of CATEGORIES) {
    test(`url-shapes (${kindName}): /${category.slug} answers 200`, async () => {
      const res = await fetchManual(`/${category.slug}`, headers);
      assert.equal(res.status, 200, `/${category.slug} must answer 200`);
    });

    test(`url-shapes (${kindName}): /${category.slug}/ redirects once to /${category.slug}`, async () => {
      const res = await fetchManual(`/${category.slug}/`, headers);
      assert.ok(
        res.status >= 300 && res.status < 400,
        `/${category.slug}/ must answer a 3xx redirect, got ${res.status}`
      );
      const location = res.headers.get('location');
      assert.ok(location, `/${category.slug}/ must carry a location header`);
      assert.equal(
        locationPathname(location),
        `/${category.slug}`,
        `/${category.slug}/ must redirect to the exact no-slash category path`
      );
    });
  }

  for (const legacyPath of ['/categories', '/sources', '/new']) {
    test(`url-shapes (${kindName}): ${legacyPath} redirects (301) to /`, async () => {
      const res = await fetchManual(legacyPath, headers);
      assert.equal(res.status, 301, `${legacyPath} must answer 301`);
      assert.equal(
        locationPathname(res.headers.get('location') ?? ''),
        '/',
        `${legacyPath} must redirect to /`
      );
    });
  }

  test(`url-shapes (${kindName}): /sitemap.xml redirects (301) to /sitemap-index.xml, which answers 200`, async () => {
    const res = await fetchManual('/sitemap.xml', headers);
    assert.equal(res.status, 301, '/sitemap.xml must answer 301');
    assert.equal(
      locationPathname(res.headers.get('location') ?? ''),
      '/sitemap-index.xml',
      '/sitemap.xml must redirect to /sitemap-index.xml'
    );

    const indexRes = await fetchManual('/sitemap-index.xml', headers);
    assert.equal(indexRes.status, 200, '/sitemap-index.xml must itself answer 200');
  });
}

test('url-shapes: /robots.txt carries the Content-signal policy line', async () => {
  const res = await fetchManual('/robots.txt');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(
    body,
    /^Content-signal: search=yes,ai-input=yes,ai-train=no$/m,
    '/robots.txt must carry the exact Content-signal policy line'
  );
});

test('url-shapes: every /news-sitemap.xml loc falls within 48h (plus slack) of /version.json builtAt', async () => {
  const versionRes = await fetchManual('/version.json');
  assert.equal(versionRes.status, 200);
  const { builtAt } = await versionRes.json();
  const builtAtMs = new Date(builtAt).getTime();
  assert.ok(Number.isFinite(builtAtMs), `/version.json builtAt must be a valid date, got ${builtAt}`);

  const sitemapRes = await fetchManual('/news-sitemap.xml');
  assert.equal(sitemapRes.status, 200);
  const xml = await sitemapRes.text();

  const pubDates = [...xml.matchAll(/<news:publication_date>([^<]+)<\/news:publication_date>/g)].map(
    (m) => m[1]
  );
  assert.ok(pubDates.length > 0, '/news-sitemap.xml must contain at least one entry to check');

  for (const pubDate of pubDates) {
    const pubMs = new Date(pubDate).getTime();
    assert.ok(Number.isFinite(pubMs), `news:publication_date "${pubDate}" must be a valid date`);
    const ageMs = builtAtMs - pubMs;
    assert.ok(
      ageMs <= NEWS_WINDOW_MS + NEWS_WINDOW_SLACK_MS,
      `news sitemap entry dated ${pubDate} is older than 48h relative to builtAt ${builtAt} (age ${ageMs}ms)`
    );
  }
});

// This plan's own must_haves truth says "at least 18 entries" — that count predates 04-08's
// execution-time finding (04-08-SUMMARY.md "Deviations from Plan"): v1's live changelog.json
// currently serves only 9 entries (3 more, committed 2026-09-21, were never deployed to v1
// production), so 9 JSON + 6 D1 = 15 is what production actually publishes today, not 18. The
// owner-approved floor is `CHANGELOG_MIN_EXPECTED` (`src/content/loaders/changelog-loader.ts`,
// = 15) — duplicated here as a local constant rather than imported, matching this project's own
// established convention (see `tests/unit/not-found.test.mjs`'s `NOT_FOUND_INDEX_COUNT`) for
// why a plain `node --test` file doesn't import a module that pulls in `astro/loaders`/`astro/
// zod`. The loader's own never-shrink ratchet raises this floor automatically (no code change)
// the first time a build observes 18, once v1 deploys those 3 entries.
const CHANGELOG_MIN_EXPECTED = 15;

test('url-shapes: /changelog renders at least CHANGELOG_MIN_EXPECTED (15) entries', async () => {
  const res = await fetchManual('/changelog');
  assert.equal(res.status, 200);
  const body = await res.text();
  const entryCount = (body.match(/<article\s[^>]*data-dispatch\b/g) ?? []).length;
  assert.ok(
    entryCount >= CHANGELOG_MIN_EXPECTED,
    `/changelog must render at least ${CHANGELOG_MIN_EXPECTED} data-dispatch entries, found ${entryCount}`
  );
});
