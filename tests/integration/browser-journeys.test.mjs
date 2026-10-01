// 04-12 Task 2: drives the reader's ACTUAL path in a real Chromium browser against the deployed
// `LIVE_ORIGIN` (default `https://dev.915tldr.com`) — CLAUDE.md's verification standard ("drive
// the path the user takes, not just a path"). `tests/integration/url-shapes.test.mjs` proves the
// HTTP contract with `fetch`; this file proves the same routes hold for a real browser click,
// with the browser's own redirect record, not a second `fetch`-based inference.
//
// Uses `node:test` + the `chromium` launcher exported directly by the installed `@playwright/
// test` package (NOT `@playwright/test`'s own test runner/`playwright.config.ts` — this is a
// live-site integration check, not a mockup/design test), launched with the same fontconfig
// isolation `design/scripts/pw.mjs` uses for native (non-Docker) runs (see that file's header
// comment) so a locally-installed webfont with the same family name as this project's own fonts
// can never influence what's rendered/screenshotted here.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import {
  loadArchivePlan,
  pickArchivedArticles,
  pickArchivedTags,
  archivedArticleUuids,
  archivedTagSlugs,
} from '../helpers/archive-sample.mjs';

const LIVE_ORIGIN = process.env.LIVE_ORIGIN ?? 'https://dev.915tldr.com';

// 05-11: real-browser-click journeys into archived pages. Discovery (which tag page's first
// card is itself an archived article; which hot article's own tag links include an archived
// tag) runs over plain `fetch()` BEFORE any Playwright navigation — cheap, and keeps the actual
// click-driven assertions free of discovery noise. Paced well under the project's 10 req/s cap.
const CARD_RE = /<article[^>]*data-card[^>]*data-uuid="([0-9a-fA-F-]{36})"[^>]*>/g;
const TAGS_SECTION_RE = /<section[^>]*data-tags[^>]*>([\s\S]*?)<\/section>/;
const TAG_HREF_RE = /href="\/tag\/([^"]+)"/g;

/** Project rule: live requests paced at <= 10/s. Discovery loops below call this between
 * iterations rather than firing every candidate request back to back. */
function pace(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Finds the first (tagPath, cardHref) pair, among `tagCandidates`, whose tag page's FIRST
 * article card is itself an archived article (per `archivedUuids`) — a small/old tag does not
 * guarantee its own listed articles are archived (tag archival tracks the tag's total lifetime
 * count; article archival tracks the article's own publish date), so this is a real discovery
 * step, not a given. Throws with a clear message if none of `tagCandidates` qualifies. */
async function findArchivedTagWithArchivedFirstCard(tagCandidates, archivedUuids) {
  for (const tag of tagCandidates) {
    const res = await fetch(`${LIVE_ORIGIN}${tag.path}`);
    if (res.status === 200) {
      const html = await res.text();
      const match = CARD_RE.exec(html);
      CARD_RE.lastIndex = 0; // global regex: reset between iterations
      if (match && archivedUuids.has(match[1])) {
        return { tagPath: tag.path, uuid: match[1] };
      }
    }
    await pace();
  }
  throw new Error(
    `none of ${tagCandidates.length} sampled archived tags has an archived article as its first card — widen the sample`
  );
}

/** Finds the first hot article, among `hotArticlePaths`, whose own rendered `[data-tags]`
 * section links to at least one archived tag (per `archivedSlugs`). Returns `{ articlePath,
 * tagSlug }`. Throws with a clear message if none of `hotArticlePaths` qualifies. */
async function findHotArticleWithArchivedTag(hotArticlePaths, archivedSlugs) {
  for (const articlePath of hotArticlePaths) {
    const res = await fetch(`${LIVE_ORIGIN}${articlePath}`);
    if (res.status === 200) {
      const html = await res.text();
      const sectionMatch = html.match(TAGS_SECTION_RE);
      if (sectionMatch) {
        const hrefs = [...sectionMatch[1].matchAll(TAG_HREF_RE)].map((m) => m[1]);
        const archivedSlug = hrefs.find((slug) => archivedSlugs.has(slug));
        if (archivedSlug) {
          return { articlePath, tagSlug: archivedSlug };
        }
      }
    }
    await pace();
  }
  throw new Error(
    `none of ${hotArticlePaths.length} sampled hot articles links to an archived tag — widen the sample`
  );
}

/** Same RSS-sampling technique the existing journeys below already use — up to `limit` of the
 * live feed's own canonical article paths (always hot: `/rss.xml` only ever lists recent
 * articles, well inside the hot window). */
async function fetchRecentArticlePaths(limit) {
  const res = await fetch(`${LIVE_ORIGIN}/rss.xml`);
  assert.equal(res.status, 200);
  const xml = await res.text();
  return [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)]
    .map((m) => new URL(m[1]).pathname)
    .slice(0, limit);
}

// Same isolation directory design/scripts/pw.mjs uses — an empty, project-local XDG_DATA_HOME
// with no "fonts" subdirectory, so fontconfig falls through to system directories only and never
// picks up this dev machine's locally-installed "Instrument Serif"/"Source Serif 4" fonts (see
// pw.mjs's header comment for the full history of why that matters).
const ISOLATED_XDG_DATA_HOME = path.resolve('design/.cache/fontconfig-isolated-xdg-data-home');

// Screenshots are a human-only artifact for the owner's end-of-phase prominence check (Task 3's
// human-check item 2) — written to the session scratchpad, never committed, per this plan's own
// project rules (T-04-49: screenshots stay in the session scratchpad).
const SCREENSHOT_DIR =
  process.env.SCREENSHOT_OUTPUT_DIR ?? path.resolve('/tmp/915tldr-04-12-screenshots');

// 05-11's own screenshot directory (distinct from 04-12's default above, same override
// convention) — never committed, owner's visual spot-check only.
const ARCHIVE_SCREENSHOT_DIR =
  process.env.ARCHIVE_SCREENSHOT_OUTPUT_DIR ?? path.resolve('/tmp/915tldr-05-11-screenshots');

let browser;
let page;

before(async () => {
  mkdirSync(ISOLATED_XDG_DATA_HOME, { recursive: true });
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  mkdirSync(ARCHIVE_SCREENSHOT_DIR, { recursive: true });
  browser = await chromium.launch({
    env: { ...process.env, XDG_DATA_HOME: ISOLATED_XDG_DATA_HOME },
  });
  page = await browser.newPage();
});

after(async () => {
  await browser?.close();
});

test('browser-journey: home -> Crime nav -> first article card, real mouse clicks, no redirects', async () => {
  await page.goto(`${LIVE_ORIGIN}/`);

  const [crimeResponse] = await Promise.all([
    page.waitForNavigation(),
    page.click('a[data-nav-category="crime"]'),
  ]);
  assert.equal(page.url(), `${LIVE_ORIGIN}/crime`, 'clicking the Crime nav link must land on /crime');
  assert.equal(crimeResponse.status(), 200, '/crime navigation must answer 200');
  assert.equal(
    crimeResponse.request().redirectedFrom(),
    null,
    '/crime navigation must not be a redirect'
  );

  const firstCardHref = await page.getAttribute('[data-card] a', 'href');
  assert.ok(firstCardHref, '/crime must render at least one [data-card] article link');

  const [articleResponse] = await Promise.all([
    page.waitForNavigation(),
    page.click('[data-card] a'),
  ]);
  assert.equal(
    page.url(),
    new URL(firstCardHref, LIVE_ORIGIN).href,
    'clicking the first article card must land on exactly that link’s href'
  );
  assert.equal(articleResponse.status(), 200, 'the article navigation must answer 200');
  assert.equal(
    articleResponse.request().redirectedFrom(),
    null,
    'the article navigation must not be a redirect'
  );
});

test('browser-journey: a non-canonical URL for a known article ends on the canonical after exactly one 301 hop', async () => {
  // Sample a real, currently-canonical article path the same way url-shapes.test.mjs does — from
  // the live /rss.xml — so this journey exercises a real, currently-live article, not a fixture.
  const rssRes = await page.request.get(`${LIVE_ORIGIN}/rss.xml`);
  assert.equal(rssRes.status(), 200);
  const xml = await rssRes.text();
  const firstLink = xml.match(/<item>[\s\S]*?<link>([^<]+)<\/link>/)[1];
  const canonicalUrl = new URL(firstLink);
  const canonicalPath = canonicalUrl.pathname;

  const segments = canonicalPath.split('/').filter(Boolean);
  const [category, slugAndUuid] = segments;
  const uuidMatch = slugAndUuid.match(
    /-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/
  );
  assert.ok(uuidMatch, `"${canonicalPath}" must end in a valid uuid`);
  const uuid = uuidMatch[1];

  // A legacy `/article/<uuid>` URL — same-origin, non-canonical, known to the render manifest.
  const nonCanonicalUrl = `${LIVE_ORIGIN}/article/${uuid}`;

  const response = await page.goto(nonCanonicalUrl);
  assert.equal(
    page.url(),
    `${LIVE_ORIGIN}${canonicalPath}`,
    'a non-canonical known-article URL must end on the real canonical path'
  );

  // Walk the browser's OWN redirect chain (response.request().redirectedFrom()), not a second
  // fetch — exactly one hop, and that hop's response was a 301.
  const finalRequest = response.request();
  const redirectedFrom = finalRequest.redirectedFrom();
  assert.ok(redirectedFrom, 'the navigation must have been redirected at least once');
  assert.equal(
    redirectedFrom.redirectedFrom(),
    null,
    'the redirect chain must be exactly one hop, not more'
  );
  const redirectResponse = await redirectedFrom.response();
  assert.equal(redirectResponse.status(), 301, 'the single redirect hop must be a 301');
});

test('browser-journey: an unknown-uuid path matching a recent story’s title shows 404 suggestions within 5s', async () => {
  const rssRes = await page.request.get(`${LIVE_ORIGIN}/rss.xml`);
  assert.equal(rssRes.status(), 200);
  const xml = await rssRes.text();
  const firstLink = xml.match(/<item>[\s\S]*?<link>([^<]+)<\/link>/)[1];
  const canonicalPath = new URL(firstLink).pathname;
  const segments = canonicalPath.split('/').filter(Boolean);
  const [category, slugAndUuid] = segments;
  const uuidMatch = slugAndUuid.match(
    /-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/
  );
  const slug = slugAndUuid.slice(0, slugAndUuid.length - uuidMatch[1].length - 1);

  // Same real category+slug (whose tokens match this exact article's own title/summary words in
  // the 404 suggestion index) with a random, unknown uuid — a well-formed path the render
  // manifest has never seen.
  const unknownUuid = crypto.randomUUID();
  const unknownUrl = `${LIVE_ORIGIN}/${category}/${slug}-${unknownUuid}`;

  const response = await page.goto(unknownUrl);
  assert.equal(response.status(), 404, 'an unknown well-formed uuid path must answer 404');

  const suggestions = page.locator('[data-404-suggestions]');
  await suggestions.waitFor({ state: 'visible', timeout: 5000 });
  const linkCount = await suggestions.locator('a').count();
  assert.ok(linkCount >= 1, '[data-404-suggestions] must contain at least one link once visible');
});

test('browser-journey: /categories ends on the homepage', async () => {
  await page.goto(`${LIVE_ORIGIN}/categories`);
  assert.equal(page.url(), `${LIVE_ORIGIN}/`, '/categories must end on the homepage');
});

test('browser-journey: /crime/ ends on /crime', async () => {
  await page.goto(`${LIVE_ORIGIN}/crime/`);
  assert.equal(page.url(), `${LIVE_ORIGIN}/crime`, '/crime/ must end on the no-slash canonical /crime');
});

test('browser-journey: capture article-page screenshots at 320px and 1280px for the owner’s prominence check', async () => {
  const rssRes = await page.request.get(`${LIVE_ORIGIN}/rss.xml`);
  assert.equal(rssRes.status(), 200);
  const xml = await rssRes.text();
  const firstLink = xml.match(/<item>[\s\S]*?<link>([^<]+)<\/link>/)[1];
  const articlePath = new URL(firstLink).pathname;

  await page.goto(`${LIVE_ORIGIN}${articlePath}`);

  await page.setViewportSize({ width: 320, height: 900 });
  const narrowPath = path.join(SCREENSHOT_DIR, '04-12-article-320px.png');
  await page.screenshot({ path: narrowPath, fullPage: true });
  assert.ok(existsSync(narrowPath), '320px screenshot must be written');

  await page.setViewportSize({ width: 1280, height: 900 });
  const widePath = path.join(SCREENSHOT_DIR, '04-12-article-1280px.png');
  await page.screenshot({ path: widePath, fullPage: true });
  assert.ok(existsSync(widePath), '1280px screenshot must be written');

  console.log(`[browser-journeys] screenshots written to ${SCREENSHOT_DIR}`);
});

// --- 05-11: real-browser journeys into archived pages -------------------------------------------
// Every click below is a real `page.click()`/`Locator.click()` dispatching an actual mouse event
// (the same mechanism the existing journeys above already use) against an element visible in the
// page — never a synthetic event on a hidden element, never `page.goto` straight to the target.

test('browser-journey: 05-11 archived-tag page -> real click into an archived article, no redirect', async () => {
  const plan = loadArchivePlan();
  const archivedUuids = archivedArticleUuids(plan);
  const tagCandidates = pickArchivedTags(plan, 15, { maxCount: 5 });
  const { tagPath } = await findArchivedTagWithArchivedFirstCard(tagCandidates, archivedUuids);

  await page.goto(`${LIVE_ORIGIN}${tagPath}`);

  const cardLinkHref = await page.getAttribute('[data-card] a', 'href');
  assert.ok(cardLinkHref, `${tagPath} must render at least one [data-card] article link`);
  const cardLinkTitle = (await page.textContent('[data-card] a'))?.trim();
  assert.ok(cardLinkTitle, 'the archived tag page’s first article card must carry visible link text (its title)');

  const [articleResponse] = await Promise.all([
    page.waitForNavigation(),
    page.click('[data-card] a'),
  ]);

  assert.equal(
    page.url(),
    new URL(cardLinkHref, LIVE_ORIGIN).href,
    'clicking the archived tag page’s first article card must land on exactly that link’s href'
  );
  assert.equal(articleResponse.status(), 200, 'the archived article navigation must answer 200');
  assert.equal(
    articleResponse.request().redirectedFrom(),
    null,
    'landing on the archived article must not involve a redirect'
  );

  const heading = (await page.textContent('h1'))?.trim();
  assert.equal(
    heading,
    cardLinkTitle,
    'the landed archived article’s own <h1> must match the clicked card’s title'
  );
});

test('browser-journey: 05-11 hot article -> real click on an archived tag link, no redirect', async () => {
  const plan = loadArchivePlan();
  const archivedSlugs = archivedTagSlugs(plan);
  const hotArticlePaths = await fetchRecentArticlePaths(10);
  const { articlePath, tagSlug } = await findHotArticleWithArchivedTag(hotArticlePaths, archivedSlugs);

  await page.goto(`${LIVE_ORIGIN}${articlePath}`);

  const tagLink = page.locator(`[data-tags] a[href="/tag/${tagSlug}"]`);
  await tagLink.waitFor({ state: 'visible' });
  const tagLinkText = (await tagLink.textContent())?.trim();
  assert.ok(tagLinkText, `the "${tagSlug}" tag link must carry visible text`);

  const [tagResponse] = await Promise.all([page.waitForNavigation(), tagLink.click()]);

  assert.equal(
    page.url(),
    `${LIVE_ORIGIN}/tag/${tagSlug}`,
    `clicking the "${tagSlug}" tag link must land on its canonical archived tag page`
  );
  assert.equal(tagResponse.status(), 200, 'the archived tag navigation must answer 200');
  assert.equal(
    tagResponse.request().redirectedFrom(),
    null,
    'landing on the archived tag page must not involve a redirect'
  );

  const heading = (await page.textContent('h1'))?.trim();
  assert.equal(
    heading,
    tagLinkText,
    'the archived tag page’s own <h1> must match the clicked tag link’s text'
  );
});

test('browser-journey: 05-11 an archived article’s trailing-slash variant redirects exactly once to the canonical', async () => {
  const plan = loadArchivePlan();
  const [archived] = pickArchivedArticles(plan, 1, { marginDays: 2 });

  const response = await page.goto(`${LIVE_ORIGIN}${archived.path}/`);
  assert.equal(
    page.url(),
    `${LIVE_ORIGIN}${archived.path}`,
    'the trailing-slash variant must end on the exact canonical archived path'
  );

  const finalRequest = response.request();
  const redirectedFrom = finalRequest.redirectedFrom();
  assert.ok(redirectedFrom, 'the navigation must have been redirected at least once');
  assert.equal(
    redirectedFrom.redirectedFrom(),
    null,
    'the redirect chain must be exactly one hop, not more'
  );
});

test('browser-journey: 05-11 capture an archived article’s screenshots at 320px and 1280px', async () => {
  const plan = loadArchivePlan();
  const [archived] = pickArchivedArticles(plan, 1, { marginDays: 2 });

  await page.goto(`${LIVE_ORIGIN}${archived.path}`);

  await page.setViewportSize({ width: 320, height: 900 });
  const narrowPath = path.join(ARCHIVE_SCREENSHOT_DIR, '05-11-archived-article-320px.png');
  await page.screenshot({ path: narrowPath, fullPage: true });
  assert.ok(existsSync(narrowPath), '320px archived-article screenshot must be written');

  await page.setViewportSize({ width: 1280, height: 900 });
  const widePath = path.join(ARCHIVE_SCREENSHOT_DIR, '05-11-archived-article-1280px.png');
  await page.screenshot({ path: widePath, fullPage: true });
  assert.ok(existsSync(widePath), '1280px archived-article screenshot must be written');

  console.log(
    `[browser-journeys] 05-11 archived-article screenshots (${archived.path}) written to ${ARCHIVE_SCREENSHOT_DIR}`
  );
});
