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
// The guard compares CONTENT, not history (post-phase-06 closeout; logic and its unit tests live in
// tests/helpers/deploy-guard.mjs and tests/unit/deploy-guard.test.mjs): this project deploys merge
// commits from develop/main while local HEAD sits on a feature branch, so the deployed commit and
// HEAD are routinely NOT ancestors of each other even when every guarded path is identical. What
// matters is a zero `git diff` over the guarded paths. If the deployed commit is not present locally
// the test fails with the `git fetch` remedy; if `/version.json` carries a ref such as "main" (a
// cron rebuild: unknown commit) the test reports a visible skip reason, never a silent pass.
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
import {
  loadArchivePlan,
  pickArchivedArticles,
  pickArchivedTags,
  pickStaticTag,
} from '../helpers/archive-sample.mjs';
import { evaluateDeployGuard } from '../helpers/deploy-guard.mjs';
import { canonicalArticlePathsFromSitemap, strideSample } from '../helpers/live-samples.mjs';

// T-04-48's guarded paths: a diff here between the deployed commit and local HEAD means the
// live site may not be running the code these tests are written against.
const GUARDED_PATHS = ['src', 'tools', 'wrangler.jsonc', 'package.json', 'astro.config.mjs'];

const LIVE_ORIGIN = process.env.LIVE_ORIGIN ?? 'https://dev.915tldr.com';
const ARTICLE_SAMPLE_SIZE = 5;
// Wide, deterministic search for a fallback /es page (task B): evenly spread across the English sitemap.
const FALLBACK_SEARCH_SIZE = 300;
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
test('T-04-48: /version.json reports a deployed commit this checkout can trust (stale-deploy guard)', async (t) => {
  const res = await fetchManual('/version.json');
  assert.equal(res.status, 200);
  const body = await res.json();
  const localHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  const result = evaluateDeployGuard({
    reportedCommit: body.commit,
    localHead,
    guardedPaths: GUARDED_PATHS,
  });

  if (result.status === 'unknown') {
    // Visible, never silent: node:test prints this reason next to the skipped test.
    t.skip(result.message);
    return;
  }
  assert.equal(result.status, 'trusted', result.message);
  console.log(`[url-shapes] T-04-48: ${result.message}`);
});

let sampleArticlePaths;

test('url-shapes: sample 5 article URLs from the live /rss.xml', async () => {
  sampleArticlePaths = await fetchSampleArticlePaths();
  assert.equal(sampleArticlePaths.length, ARTICLE_SAMPLE_SIZE);
});

// 05-11: archived-article/tag URL-contract parity. Discovery, not fixtures — every path below
// comes from a LOCAL `pnpm run build` of the deployed commit's own `dist/archive-plan.json`
// (tests/helpers/archive-sample.mjs), sampled with a 2-day/5-article safety margin from the
// hot/archive tier boundary so build-to-build drift between this local build and the live one
// can never put a sampled URL on the wrong side of the cutoff.
let archivedArticles;
let archivedTags;
let staticTag;

test('url-shapes: sample archived articles/tags from the local build’s dist/archive-plan.json', async () => {
  const plan = loadArchivePlan();
  archivedArticles = pickArchivedArticles(plan, 3, { marginDays: 2 });
  archivedTags = pickArchivedTags(plan, 3, { maxCount: 5 });
  staticTag = pickStaticTag(plan, { minCount: 25 });
  assert.equal(archivedArticles.length, 3, 'must sample 3 archived articles');
  assert.equal(archivedTags.length, 3, 'must sample 3 archived tags');
  assert.ok(staticTag, 'must find at least one static (non-archived) tag with >= 25 articles');
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

  // --- 05-11: archived-article URL-contract parity ---------------------------------------------

  test(`url-shapes (${kindName}): each sampled archived article's canonical URL answers 200 with an archive Server-Timing metric`, async () => {
    for (const archived of archivedArticles) {
      const res = await fetchManual(archived.path, headers);
      assert.equal(res.status, 200, `${archived.path} must answer 200`);
      const serverTiming = res.headers.get('server-timing') ?? '';
      assert.match(
        serverTiming,
        /\barchive\b/,
        `${archived.path} must carry an archive Server-Timing metric, got "${serverTiming}"`
      );
      assert.equal(
        res.headers.get('content-type'),
        'text/html',
        `${archived.path} must carry the same content-type as a live static HTML page`
      );
    }
  });

  test(`url-shapes (${kindName}): each sampled archived article's trailing-slash variant reaches the canonical in exactly one redirect`, async () => {
    for (const archived of archivedArticles) {
      const res = await fetchManual(`${archived.path}/`, headers);
      assert.ok(
        res.status >= 300 && res.status < 400,
        `${archived.path}/ must answer a 3xx redirect, got ${res.status}`
      );
      const location = res.headers.get('location');
      assert.ok(location, `${archived.path}/ must carry a location header`);
      assert.equal(
        locationPathname(location),
        archived.path,
        `${archived.path}/ must redirect to the exact canonical path`
      );
      // Measured live (2026-10-01): an archived article's trailing-slash variant answers 301 (the
      // Worker's own redirect branch, since the exact-slash file no longer exists in dist/client
      // once partitioned into R2) — a different code than a HOT article's trailing-slash 307
      // (Cloudflare's static-asset html_handling). Logged, not asserted to one value, matching
      // this file's own existing convention for the hot-article case above.
      console.log(
        `[url-shapes] archived trailing-slash redirect for ${archived.path}/ (${kindName}): observed status ${res.status}`
      );
    }
  });

  test(`url-shapes (${kindName}): a wrong-category variant of a sampled archived article redirects (301) to the canonical`, async () => {
    const archived = archivedArticles[0];
    const { category, uuid } = parseCanonicalPath(archived.path);
    const wrongCategory = CATEGORIES.find((c) => c.slug !== category)?.slug;
    assert.ok(wrongCategory, 'need at least one category different from the sampled archived article’s own');
    const wrongPath = `/${wrongCategory}/definitely-the-wrong-slug-${uuid}`;

    const res = await fetchManual(wrongPath, headers);
    assert.equal(res.status, 301, `${wrongPath} must answer 301`);
    const location = res.headers.get('location');
    assert.ok(location, `${wrongPath} must carry a location header`);
    assert.equal(
      locationPathname(location),
      archived.path,
      `${wrongPath} must redirect to the real archived canonical path`
    );
  });

  // --- 05-11: archived-tag URL-contract parity --------------------------------------------------

  test(`url-shapes (${kindName}): each sampled archived tag's canonical URL answers 200 with an archive Server-Timing metric`, async () => {
    for (const tag of archivedTags) {
      const res = await fetchManual(tag.path, headers);
      assert.equal(res.status, 200, `${tag.path} must answer 200`);
      const serverTiming = res.headers.get('server-timing') ?? '';
      assert.match(
        serverTiming,
        /\barchive\b/,
        `${tag.path} must carry an archive Server-Timing metric, got "${serverTiming}"`
      );
    }
  });

  test(`url-shapes (${kindName}): an archived tag's "/" and ".html" suffix variants match a static tag's own redirect shape`, async () => {
    const archived = archivedTags[0];
    for (const suffix of ['/', '.html']) {
      const archivedRes = await fetchManual(`${archived.path}${suffix}`, headers);
      const staticRes = await fetchManual(`${staticTag.path}${suffix}`, headers);
      assert.equal(
        archivedRes.status,
        staticRes.status,
        `archived tag suffix "${suffix}" must answer the same status as a static tag's own (${staticRes.status})`
      );
      assert.equal(
        locationPathname(archivedRes.headers.get('location') ?? ''),
        archived.path,
        `archived tag suffix "${suffix}" must redirect to its own canonical path`
      );
      assert.equal(
        locationPathname(staticRes.headers.get('location') ?? ''),
        staticTag.path,
        `static tag suffix "${suffix}" must redirect to its own canonical path (sanity check on the comparison baseline)`
      );
    }
  });

  test(`url-shapes (${kindName}): /tag/zz-no-such-tag-05 answers 404 with the styled 404 markup`, async () => {
    const unknownTagPath = '/tag/zz-no-such-tag-05';
    const res = await fetchManual(unknownTagPath, headers);
    assert.equal(res.status, 404, `${unknownTagPath} must answer 404`);
    const body = await res.text();
    assert.match(
      body,
      /data-404-suggestions/,
      `${unknownTagPath}'s 404 body must contain the data-404-suggestions section`
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

test('url-shapes: HEAD on a sampled archived article answers 200 with an empty body', async () => {
  const archived = archivedArticles[0];
  const res = await fetch(`${LIVE_ORIGIN}${archived.path}`, { method: 'HEAD', redirect: 'manual' });
  assert.equal(res.status, 200, `HEAD ${archived.path} must answer 200`);
  const body = await res.text();
  assert.equal(body, '', `HEAD ${archived.path} must carry an empty body`);
});

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

// =============================================================================================
// 06-16: the live /es URL contract (I18N-03/04/05/06/08, D-13). Same rules as above: real HTTP
// against LIVE_ORIGIN, redirect:'manual', every redirect case under both header kinds. Samples
// are discovered live (/es/rss.xml, /rss.xml) or from the local build's archive plan, never
// fixtured. The /es origin inside hreflang/canonical is the configured production origin
// (https://915tldr.com), regardless of which host serves the page.
// =============================================================================================
const PRODUCTION_ORIGIN = 'https://915tldr.com';

/** Project rule: live requests paced at <= 10/s. */
function pace(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function htmlLang(html) {
  return html.match(/<html[^>]*\blang="([^"]*)"/)?.[1] ?? null;
}

/** `{ hreflang -> pathname }` from the page's `<link rel="alternate" hreflang=…>` tags. */
function hreflangPaths(html) {
  const out = {};
  for (const m of html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)) {
    out[m[1]] = new URL(m[2]).pathname;
  }
  return out;
}

function canonicalHref(html) {
  return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
}

async function fetchHtml(pathname, headers = {}) {
  const res = await fetchManual(pathname, headers);
  return { res, html: await res.text() };
}

/** 200 + lang="es" + canonical on the production /es URL + reciprocal en/es/x-default hreflang: the
 * /es page names its English partner, and the English partner names this page back. */
async function assertEsPageContract(esPath, { partnerMayBeStale = false } = {}) {
  const { res, html } = await fetchHtml(esPath);
  assert.equal(res.status, 200, `${esPath} must answer 200`);
  assert.equal(htmlLang(html), 'es', `${esPath} must be <html lang="es">`);
  assert.equal(canonicalHref(html), `${PRODUCTION_ORIGIN}${esPath}`, `${esPath} canonical`);
  const alts = hreflangPaths(html);
  assert.equal(alts.es, esPath, `${esPath} hreflang es must point at itself`);
  const enPath = esPath === '/es' ? '/' : esPath.replace(/^\/es/, '');
  assert.equal(alts.en, enPath, `${esPath} hreflang en must name its English partner ${enPath}`);
  assert.equal(alts['x-default'], enPath, `${esPath} x-default must be the English partner`);
  const partner = await fetchHtml(enPath);
  assert.equal(partner.res.status, 200, `English partner ${enPath} must answer 200`);
  assert.equal(htmlLang(partner.html), 'en');
  const back = hreflangPaths(partner.html);
  if (partnerMayBeStale && back.es === undefined) {
    // An archived English object that the post-deploy re-upload (REND-12) has not reached yet still
    // carries pre-Phase-6 chrome: no hreflang, no language switch. Recorded as a finding, not
    // hidden and not failed here — the /es side above is what this test owns.
    console.log(`[url-shapes 06-16] FINDING: archived English partner ${enPath} is STALE (no hreflang, no Español switch) — awaiting the REND-12 re-upload backlog`);
    return html;
  }
  assert.equal(back.es, esPath, `${enPath} must carry hreflang es -> ${esPath} (reciprocal)`);
  assert.equal(back.en, enPath, `${enPath} must carry hreflang en -> itself`);
  return html;
}

let esTranslatedPaths; // English canonical paths whose /es page is translated (from /es/rss.xml)
let esFallbackPath; // English canonical path whose /es page is the D-05 fallback

test('url-shapes 06-16: sample translated (from /es/rss.xml) and fallback /es articles live', async () => {
  const res = await fetchManual('/es/rss.xml');
  assert.equal(res.status, 200);
  const xml = await res.text();
  esTranslatedPaths = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)]
    .map((m) => new URL(m[1]).pathname.replace(/^\/es/, ''))
    .slice(0, 3);
  assert.ok(esTranslatedPaths.length >= 1, '/es/rss.xml must list at least one translated article');
  for (const p of esTranslatedPaths) assert.ok(isCanonicalArticlePath(p), `${p} must be a canonical article path`);

  // Fallback: an English article whose /es page carries the fallback note AND robots noindex. The
  // five newest RSS items are all translated now (live ingest translates new articles), so search
  // them first and then a wide, deterministic sample (FALLBACK_SEARCH_SIZE evenly spread canonical
  // article paths from the English sitemap, which lists every public article). If nothing in the
  // whole sample qualifies this FAILS with the search size — it never skips.
  const candidates = [...sampleArticlePaths];
  const sitemapRes = await fetchManual('/sitemap-en-0.xml');
  assert.equal(sitemapRes.status, 200, '/sitemap-en-0.xml must answer 200 to draw the fallback search sample from it');
  candidates.push(...strideSample(canonicalArticlePathsFromSitemap(await sitemapRes.text()), FALLBACK_SEARCH_SIZE));

  let searched = 0;
  for (const enPath of candidates) {
    searched += 1;
    const { res: r, html } = await fetchHtml(`/es${enPath}`);
    if (r.status === 200 && /data-fallback-note/.test(html) && /<meta name="robots" content="noindex"/.test(html)) {
      esFallbackPath = enPath;
      break;
    }
    await pace();
  }
  console.log(`[url-shapes 06-16] translated sample: ${esTranslatedPaths[0]}; fallback sample: ${esFallbackPath} (found after ${searched} of ${candidates.length} candidates)`);
  assert.ok(
    esFallbackPath,
    `no /es article carrying [data-fallback-note] + robots noindex was found among ${candidates.length} candidates (5 newest RSS items + ${FALLBACK_SEARCH_SIZE} evenly spread from /sitemap-en-0.xml) — either every sampled article is translated (fallback behaviour unexercised) or fallback pages lost the note/noindex`
  );
});

test('url-shapes 06-16: /es and all 8 /es/<category> answer 200, lang="es", reciprocal hreflang', async () => {
  await assertEsPageContract('/es');
  for (const category of CATEGORIES) {
    await assertEsPageContract(`/es/${category.slug}`);
  }
});

/** Post-phase-06 closeout contract for a tag page pair (owner decision 2026-10-07): the `/es/tag/*`
 * page is 200, lang="es", robots noindex and declares NO alternates; its English twin is 200,
 * indexable, and declares en + x-default only (no `es`). `mayBeStale` (archived objects only):
 * an archived object not yet reached by the post-deploy re-upload backlog (REND-12, about 2 builds)
 * still carries the pre-closeout paired/indexable markup — recorded as a FINDING, not hidden and
 * not failed; a static page can never be stale, so it is strict. */
async function assertTagPairContract(esPath, { mayBeStale = false } = {}) {
  const enPath = esPath.replace(/^\/es/, '');
  const es = await fetchHtml(esPath);
  assert.equal(es.res.status, 200, `${esPath} must answer 200`);
  assert.equal(htmlLang(es.html), 'es', `${esPath} must be <html lang="es">`);
  assert.equal(canonicalHref(es.html), `${PRODUCTION_ORIGIN}${esPath}`, `${esPath} canonical`);
  const esNoindex = /<meta name="robots" content="noindex"/.test(es.html);
  const esAlts = hreflangPaths(es.html);
  const en = await fetchHtml(enPath);
  assert.equal(en.res.status, 200, `English twin ${enPath} must answer 200`);
  assert.equal(htmlLang(en.html), 'en');
  assert.ok(!/<meta name="robots" content="noindex"/.test(en.html), `${enPath} must stay indexable`);
  const enAlts = hreflangPaths(en.html);

  const esDone = esNoindex && Object.keys(esAlts).length === 0;
  const enDone = enAlts.es === undefined && enAlts.en === enPath && enAlts['x-default'] === enPath;
  if (mayBeStale && (!esDone || !enDone)) {
    console.log(`[url-shapes closeout] FINDING: archived tag pair ${esPath} not re-uploaded yet (es noindex=${esNoindex}, es alternates=${Object.keys(esAlts).length}, en has es alternate=${enAlts.es !== undefined}) — awaiting the REND-12 re-upload backlog`);
    return;
  }
  assert.ok(esNoindex, `${esPath} must be robots noindex`);
  assert.deepEqual(esAlts, {}, `${esPath} is noindex and must declare no hreflang alternates`);
  assert.equal(enAlts.es, undefined, `${enPath} must not advertise a noindex ${esPath} as an alternate`);
  assert.equal(enAlts.en, enPath, `${enPath} must carry hreflang en -> itself`);
  assert.equal(enAlts['x-default'], enPath, `${enPath} x-default must be itself`);
}

test('url-shapes closeout: /es/tag/<static> and /es/tag/<archived> are 200, lang="es", noindex with no alternates; English twins declare self alternates only; archived served by the Worker', async () => {
  await assertTagPairContract(`/es${staticTag.path}`);
  const archived = archivedTags[0];
  await assertTagPairContract(`/es${archived.path}`, { mayBeStale: true });
  for (const headers of [NAVIGATE_HEADERS, PLAIN_HEADERS]) {
    const res = await fetchManual(`/es${archived.path}`, headers);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('server-timing') ?? '', /\barchive;desc=(r2|edge-cache)\b/, `/es${archived.path} must be served from the archive tier`);
  }
});

/** Polish task B contract for a source page pair (owner decision 2026-10-08): same shape as the tag
 * pair — `/es/source/<slug>` is 200, lang="es", robots noindex, NO alternates; its English twin is
 * 200, indexable, en + x-default only. Source pages are never archived (a handful of static files,
 * `archive-plan.json` has no source kind), so there is no stale-object window: this is STRICT. */
async function assertSourcePairContract(esPath) {
  const enPath = esPath.replace(/^\/es/, '');
  const es = await fetchHtml(esPath);
  assert.equal(es.res.status, 200, `${esPath} must answer 200`);
  assert.equal(htmlLang(es.html), 'es', `${esPath} must be <html lang="es">`);
  assert.equal(canonicalHref(es.html), `${PRODUCTION_ORIGIN}${esPath}`, `${esPath} canonical`);
  assert.ok(/<meta name="robots" content="noindex"/.test(es.html), `${esPath} must be robots noindex`);
  assert.deepEqual(hreflangPaths(es.html), {}, `${esPath} is noindex and must declare no hreflang alternates`);
  const en = await fetchHtml(enPath);
  assert.equal(en.res.status, 200, `English twin ${enPath} must answer 200`);
  assert.equal(htmlLang(en.html), 'en');
  assert.ok(!/<meta name="robots" content="noindex"/.test(en.html), `${enPath} must stay indexable`);
  const enAlts = hreflangPaths(en.html);
  assert.equal(enAlts.es, undefined, `${enPath} must not advertise a noindex ${esPath} as an alternate`);
  assert.equal(enAlts.en, enPath, `${enPath} must carry hreflang en -> itself`);
  assert.equal(enAlts['x-default'], enPath, `${enPath} x-default must be itself`);
}

test('url-shapes polish: every /es/source/<slug> is 200, lang="es", noindex with no alternates; English twins declare en + x-default only; no /es/source URL is in any sitemap file (as <loc> or xhtml:link)', async () => {
  for (const slug of ['kvia', 'ktsm', 'el-paso-matters']) {
    await assertSourcePairContract(`/es/source/${slug}`);
    await pace();
  }
  const index = await fetchManual('/sitemap-index.xml');
  assert.equal(index.status, 200);
  const children = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  assert.ok(children.length >= 2, 'sitemap index must list child sitemaps');
  for (const child of children) {
    const xml = await (await fetchManual(child)).text();
    assert.ok(!/\/es\/source\//.test(xml), `${child} must not list or alternate any /es/source/ URL`);
    await pace();
  }
});

test('url-shapes 06-16: /es/tags and the static pages answer 200, lang="es", reciprocal hreflang', async () => {
  for (const p of ['/es/tags', '/es/about', '/es/contact', '/es/privacy', '/es/terms', '/es/changelog']) {
    await assertEsPageContract(p);
  }
});

test('url-shapes 06-16: a translated /es article is 200, lang="es", Spanish body, reciprocal hreflang, indexable', async () => {
  const esPath = `/es${esTranslatedPaths[0]}`;
  const html = await assertEsPageContract(esPath);
  assert.ok(!/<meta name="robots" content="noindex"/.test(html), 'a translated /es article must be indexable');
  assert.ok(!/data-fallback-note/.test(html), 'a translated /es article carries no fallback note');
  assert.match(html, /<p data-lang-link><a [^>]*hreflang="en"/, 'carries the Read in English link');
  assert.match(html, /Este resumen fue redactado por IA/, 'AI disclosure is in Spanish (I18N-09)');
});

test('url-shapes 06-16: a fallback /es article is 200, lang="es", robots noindex, with the Spanish note and English content', async () => {
  assert.ok(esFallbackPath, 'no fallback /es article was found by the sampling test above, so this contract is unexercised — failing, not skipping');
  const { res, html } = await fetchHtml(`/es${esFallbackPath}`);
  assert.equal(res.status, 200);
  assert.equal(htmlLang(html), 'es');
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.match(html, /data-fallback-note[^>]*>No disponible en español todavía/);
  assert.equal(canonicalHref(html), `${PRODUCTION_ORIGIN}/es${esFallbackPath}`);
});

test('url-shapes 06-16: an ARCHIVED /es article is served by the Worker from the archive tier with the /es page body', async () => {
  const archived = archivedArticles[0];
  const esPath = `/es${archived.path}`;
  for (const [kindName, headers] of REQUEST_KINDS) {
    const { res, html } = await fetchHtml(esPath, headers);
    assert.equal(res.status, 200, `${esPath} (${kindName}) must answer 200`);
    assert.match(
      res.headers.get('server-timing') ?? '',
      /\barchive;desc=(r2|edge-cache)\b/,
      `${esPath} (${kindName}) must be served by the Worker from R2 or the edge cache`
    );
    assert.equal(htmlLang(html), 'es', `${esPath} (${kindName}) body must be the /es page`);
    assert.match(html, /<p data-lang-link><a [^>]*hreflang="en"/, 'body carries the Read in English link');
    assert.equal(canonicalHref(html), `${PRODUCTION_ORIGIN}${esPath}`);
    const translated = !/data-fallback-note/.test(html);
    console.log(`[url-shapes 06-16] archived ${esPath} (${kindName}): server-timing="${res.headers.get('server-timing')}", ${translated ? 'translated Spanish body' : 'D-05 fallback (English content, untranslated)'}`);
  }
});

for (const [kindName, headers] of REQUEST_KINDS) {
  test(`url-shapes 06-16 (${kindName}): a non-canonical /es/<wrong-category>/<slug>-<uuid> answers exactly one 301 to the /es canonical (hot and archived)`, async () => {
    for (const canonicalEnPath of [esTranslatedPaths[0], archivedArticles[0].path]) {
      const { category, uuid } = parseCanonicalPath(canonicalEnPath);
      const wrongCategory = CATEGORIES.find((c) => c.slug !== category).slug;
      const wrongPath = `/es/${wrongCategory}/definitely-the-wrong-slug-${uuid}`;
      const res = await fetchManual(wrongPath, headers);
      assert.equal(res.status, 301, `${wrongPath} must answer 301`);
      const location = res.headers.get('location');
      assert.equal(locationPathname(location), `/es${canonicalEnPath}`, `${wrongPath} must redirect to the /es canonical`);
      // Exactly one hop: the target itself must answer 200 with no location header.
      const target = await fetchManual(locationPathname(location), headers);
      assert.equal(target.status, 200, 'the redirect target must be the final page (one hop)');
      assert.equal(target.headers.get('location'), null);
    }
  });

  test(`url-shapes 06-16 (${kindName}): /es/ ends on /es after one redirect`, async () => {
    const res = await fetchManual('/es/', headers);
    assert.ok(res.status >= 300 && res.status < 400, `/es/ must answer a 3xx redirect, got ${res.status}`);
    assert.equal(locationPathname(res.headers.get('location') ?? ''), '/es');
    const target = await fetchManual('/es', headers);
    assert.equal(target.status, 200);
    console.log(`[url-shapes 06-16] /es/ (${kindName}): ${res.status} -> /es`);
  });

  test(`url-shapes 06-16 (${kindName}): an unknown /es/... path answers 404 with the Spanish 404 page`, async () => {
    for (const p of ['/es/zz-no-such-page-0616', '/es/crime/this-page-has-no-uuid-at-all-0616']) {
      const { res, html } = await fetchHtml(p, headers);
      assert.equal(res.status, 404, `${p} must answer 404`);
      assert.equal(htmlLang(html), 'es', `${p} must serve the Spanish 404 page`);
      assert.match(html, /data-404-suggestions/);
    }
  });

  test(`url-shapes 06-16 (${kindName}): Accept-Language es-MX on / and an English article answers 200 English with no location header (D-13)`, async () => {
    for (const p of ['/', '/crime', sampleArticlePaths[0]]) {
      const { res, html } = await fetchHtml(p, { ...headers, 'Accept-Language': 'es-MX,es;q=0.9' });
      assert.equal(res.status, 200, `${p} must answer 200`);
      assert.equal(res.headers.get('location'), null, `${p} must carry no location header`);
      assert.equal(htmlLang(html), 'en', `${p} must stay English for a Spanish-preferring browser`);
    }
  });
}

test('url-shapes 06-16: /es/rss.xml parses as RSS with <language>es-us</language>; items are /es URLs', async () => {
  const res = await fetchManual('/es/rss.xml');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /xml/);
  const xml = await res.text();
  assert.match(xml, /^<\?xml[^>]*\?><rss version="2\.0">/);
  assert.match(xml, /<language>es-us<\/language>/);
  assert.match(xml, /<\/channel><\/rss>\s*$/);
  const links = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => m[1]);
  assert.ok(links.length >= 1, '/es/rss.xml must carry items');
  for (const link of links) assert.ok(link.startsWith(`${PRODUCTION_ORIGIN}/es/`), `${link} must be an /es URL`);
  assert.equal((xml.match(/<item>/g) ?? []).length, (xml.match(/<\/item>/g) ?? []).length, 'balanced <item> tags');
});

test('url-shapes 06-16: sitemap-index.xml lists the Spanish sitemap; every <loc> in it starts with https://915tldr.com/es', async () => {
  const idx = await fetchManual('/sitemap-index.xml');
  assert.equal(idx.status, 200);
  const idxXml = await idx.text();
  assert.match(idxXml, /<sitemapindex[\s>]/);
  const locs = [...idxXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const esSitemaps = locs.filter((l) => /\/sitemap-es-\d+\.xml$/.test(l));
  assert.ok(esSitemaps.length >= 1, `sitemap-index.xml must list a Spanish sitemap, got ${locs.join(', ')}`);
  let total = 0;
  for (const loc of esSitemaps) {
    const res = await fetchManual(new URL(loc).pathname);
    assert.equal(res.status, 200, `${loc} must answer 200`);
    const xml = await res.text();
    assert.match(xml, /<urlset[\s>]/);
    assert.match(xml, /<\/urlset>\s*$/);
    // Only <url><loc> entries (hreflang partners live in xhtml:link href attributes, not <loc>).
    const urlLocs = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.ok(urlLocs.length > 0, `${loc} must list URLs`);
    for (const u of urlLocs) assert.ok(u.startsWith(`${PRODUCTION_ORIGIN}/es`), `${loc}: ${u} must start with ${PRODUCTION_ORIGIN}/es`);
    total += urlLocs.length;
  }
  console.log(`[url-shapes 06-16] ${esSitemaps.length} Spanish sitemap file(s), ${total} <loc> entries, all under /es`);
});

test('url-shapes 06-16: /es/news-sitemap.xml parses with <news:language>es</news:language>', async () => {
  const res = await fetchManual('/es/news-sitemap.xml');
  assert.equal(res.status, 200);
  const xml = await res.text();
  assert.match(xml, /<urlset[^>]*xmlns:news=/);
  assert.match(xml, /<\/urlset>\s*$/);
  const langs = [...xml.matchAll(/<news:language>([^<]+)<\/news:language>/g)].map((m) => m[1]);
  assert.ok(langs.length > 0, 'must carry at least one news entry');
  assert.ok(langs.every((l) => l === 'es'), `every <news:language> must be es, got ${[...new Set(langs)].join(',')}`);
  const locs = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const l of locs) assert.ok(l.startsWith(`${PRODUCTION_ORIGIN}/es/`));
});

// Stylesheet check (06-05's suspected pre-existing gap): an archived page references the stylesheet
// hash of the build that rendered it; if that hashed file is gone from the current deploy the page
// is unstyled. The post-deploy re-upload (REND-12) converges this over a few builds, so right after
// a CSS-changing deploy some archived ENGLISH pages legitimately still name the old hash. This test
// therefore (a) records every status code, (b) FAILS if any archived /es page or any hot page
// has a non-200 stylesheet (those are rendered by, or pre-populated for, the current build), and
// (c) reports the archived English count separately as a finding rather than failing the suite.
test('url-shapes 06-16: stylesheet referenced by archived EN/es pages and hot baselines (status recorded; stale archived EN reported)', async () => {
  const plan = loadArchivePlan();
  const enEntries = plan.entries.filter((e) => !e.path.startsWith('/es/'));
  const spread = (list, n) => Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]);
  const samples = [
    ...spread(enEntries.filter((e) => e.kind === 'article'), 12),
    ...spread(enEntries.filter((e) => e.kind === 'tag'), 12),
  ];
  const cssStatus = new Map();
  async function statusOf(href) {
    if (!cssStatus.has(href)) {
      const css = await fetchManual(new URL(href, LIVE_ORIGIN).pathname);
      await css.arrayBuffer();
      cssStatus.set(href, css.status);
    }
    return cssStatus.get(href);
  }
  const tally = {};
  const hardFailures = [];
  const pages = [
    ...samples.map((e) => ({ label: `archived EN ${e.kind}`, path: e.path, hard: false })),
    ...samples.map((e) => ({ label: `archived /es ${e.kind}`, path: `/es${e.path}`, hard: true })),
    { label: 'hot EN article', path: sampleArticlePaths[0], hard: true },
    { label: 'hot /es article', path: `/es${esTranslatedPaths[0]}`, hard: true },
  ];
  for (const page of pages) {
    const { res, html } = await fetchHtml(page.path);
    assert.equal(res.status, 200, `${page.path} must answer 200`);
    const hrefs = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 0, `${page.path} must reference an external stylesheet`);
    for (const href of hrefs) {
      const status = await statusOf(href);
      const key = `${page.label}: ${href} -> ${status}`;
      tally[key] = (tally[key] ?? 0) + 1;
      if (page.hard && status !== 200) hardFailures.push(`${page.path} -> ${href} -> ${status}`);
    }
    await pace();
  }
  const lines = Object.entries(tally).map(([k, n]) => `${n} x ${k}`);
  console.log(`[url-shapes 06-16] stylesheet status codes:\n  ${lines.join('\n  ')}`);
  const staleEn = Object.entries(tally).filter(([k]) => k.startsWith('archived EN') && !k.endsWith('-> 200'));
  if (staleEn.length > 0) {
    console.log(
      `[url-shapes 06-16] FINDING: ${staleEn.reduce((n, [, c]) => n + c, 0)} sampled archived English page(s) reference a stylesheet that answers non-200 — they render unstyled until the REND-12 re-upload reaches them`
    );
  }
  assert.deepEqual(hardFailures, [], `current-build pages with a non-200 stylesheet:\n${hardFailures.join('\n')}`);
});
