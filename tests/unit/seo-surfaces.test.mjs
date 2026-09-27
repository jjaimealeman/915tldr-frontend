// 04-07 Task 2: proves robots.txt and rss.xml against REAL built output under dist/client,
// following tests/unit/not-found.test.mjs's established "assert on rendered output, skip if
// unbuilt" convention. No XML-parsing dependency added (not hoisted into this pnpm store per a
// direct-require check during this task) — regex extraction matching this suite's own established
// style (tests/unit/structured-data.test.mjs, tests/unit/not-found.test.mjs).
//
// robots.txt: owner decision 2026-09-27 — production's live `https://915tldr.com/robots.txt` is
// a fully permissive `User-Agent: *\nDisallow:` (v1's static `public/robots.txt` shadows its own
// `server/routes/robots.txt.ts`, so the elaborate per-bot/AI-crawler policy has never actually
// been served). The owner selected shipping the INTENDED policy (the route's rendered body) over
// mirroring the live accidental one — a deliberate production policy change, not a bug. See
// 04-07-SUMMARY.md "Deviations from Plan" for the full writeup. `tests/fixtures/v1-robots.txt`
// therefore holds that route's rendered body (siteUrl substituted), not a live curl capture.
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

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

test('seo-surfaces: robots.txt matches the fixture line-for-line except the Sitemap lines', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('robots.txt'), 'expected dist/client/robots.txt to exist');
  const built = readDist('robots.txt').split('\n');
  const fixture = readFileSync(
    path.join(REPO_ROOT, 'tests/fixtures/v1-robots.txt'),
    'utf8'
  ).split('\n');

  const builtNonSitemap = built.filter((line) => !line.startsWith('Sitemap:'));
  const fixtureNonSitemap = fixture.filter((line) => !line.startsWith('Sitemap:'));
  assert.deepEqual(
    builtNonSitemap,
    fixtureNonSitemap,
    'expected every non-Sitemap line to match the v1 fixture, in order'
  );
});

test('seo-surfaces: robots.txt preserves the Content-signal line and the per-bot AI-training blocks', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const built = readDist('robots.txt');
  assert.match(built, /^Content-signal: search=yes,ai-input=yes,ai-train=no$/m);
  for (const bot of ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'Bytespider', 'PerplexityBot']) {
    const re = new RegExp(`User-agent: ${bot}\\nDisallow: /`, 'i');
    assert.match(built, re, `expected ${bot} to be disallowed`);
  }
});

test('seo-surfaces: robots.txt names the v2 sitemap index and news sitemap, and only those', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const built = readDist('robots.txt');
  const sitemapLines = built.split('\n').filter((line) => line.startsWith('Sitemap:'));
  assert.deepEqual(sitemapLines, [
    'Sitemap: https://915tldr.com/sitemap-index.xml',
    'Sitemap: https://915tldr.com/news-sitemap.xml',
  ]);
});

// ---------------------------------------------------------------------------
// rss.xml
// ---------------------------------------------------------------------------

const GUID_RE = /<guid isPermaLink="true">(.*?)<\/guid>/g;
const LINK_RE = /<link>(.*?)<\/link>/g;
const ITEM_RE = /<item>[\s\S]*?<\/item>/g;

test('seo-surfaces: rss.xml has at most 30 items, and every link/guid answers a page this build produced', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  assert.ok(distFileExists('rss.xml'), 'expected dist/client/rss.xml to exist');
  const xml = readDist('rss.xml');

  const items = xml.match(ITEM_RE) ?? [];
  assert.ok(items.length >= 1, 'expected at least one rss item (corpus is non-empty)');
  assert.ok(items.length <= 30, `expected at most 30 items, got ${items.length}`);

  // First <link> in the document is the channel's own link, not an item link — skip it.
  const allLinks = [...xml.matchAll(LINK_RE)].map((m) => m[1]);
  const itemLinks = allLinks.slice(1);
  assert.equal(itemLinks.length, items.length, 'expected one <link> per item (after the channel link)');

  for (const link of itemLinks) {
    assert.match(link, /^https:\/\/915tldr\.com\//, `expected ${link} to start with the production origin`);
    assert.doesNotMatch(link, /\/$/, `expected ${link} to carry no trailing slash`);
    const relPath = link.replace('https://915tldr.com', '');
    assert.ok(
      distFileExists(`${relPath}.html`),
      `expected ${link} to map to a page this build produced (dist/client${relPath}.html)`
    );
  }

  const guids = [...xml.matchAll(GUID_RE)].map((m) => m[1]);
  assert.equal(guids.length, items.length, 'expected one <guid isPermaLink="true"> per item');
  for (let i = 0; i < guids.length; i += 1) {
    assert.equal(guids[i], itemLinks[i], 'expected v1\'s guid format: isPermaLink="true", equal to the item link');
  }
});

test('seo-surfaces: rss.xml channel carries v1\'s title, description and language', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const xml = readDist('rss.xml');
  assert.match(xml, /<title>915 TLDR - El Paso News, Simplified<\/title>/);
  assert.match(
    xml,
    /<description>AI-powered local news for El Paso\. Get the TLDR on what matters in the Sun City\.<\/description>/
  );
  assert.match(xml, /<language>en-us<\/language>/);
});
