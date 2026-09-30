// 04-05 (Task 1): pure selection/grouping module every listing page (home, category, tag, /tags,
// source) draws from. Follows tests/unit/rail.test.mjs's node:test + assert/strict structure and
// minimal-fixture convention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareNewestFirst,
  sortNewestFirst,
  groupByCategory,
  groupByTag,
  groupBySource,
  tagIndex,
  assertNoRouteCollisions,
  RESERVED_TOP_LEVEL,
  HOME_FEED_COUNT,
  CATEGORY_PAGE_COUNT,
  TAG_PAGE_COUNT,
  SOURCE_PAGE_COUNT,
  TAGS_INDEX_COUNT,
} from '../../src/lib/listing.ts';

/** Minimal fixture matching the ArticleData shape's render-relevant fields. */
function article({
  uuid,
  publishedAt,
  categorySlug = 'crime',
  categoryName = 'Crime',
  tags = [],
  sourceSlug = 'ktsm',
  sourceName = 'KTSM',
  title = `Title ${uuid}`,
}) {
  return {
    uuid,
    title,
    slug: `slug-${uuid}`,
    summary: 'summary',
    keyPoints: null,
    url: 'https://example.com/a',
    publishedAt,
    category: { slug: categorySlug, name: categoryName },
    tags,
    source: { slug: sourceSlug, name: sourceName, websiteUrl: 'https://example.com' },
  };
}

// ---------------------------------------------------------------------------
// compareNewestFirst / sortNewestFirst
// ---------------------------------------------------------------------------

test('compareNewestFirst: newer publishedAt sorts first', () => {
  const a = article({ uuid: 'a', publishedAt: 100 });
  const b = article({ uuid: 'b', publishedAt: 200 });
  assert.ok(compareNewestFirst(b, a) < 0);
  assert.ok(compareNewestFirst(a, b) > 0);
});

test('compareNewestFirst: equal publishedAt breaks ties by uuid ascending', () => {
  const a = article({ uuid: 'aaa', publishedAt: 100 });
  const b = article({ uuid: 'bbb', publishedAt: 100 });
  assert.ok(compareNewestFirst(a, b) < 0);
  assert.ok(compareNewestFirst(b, a) > 0);
  assert.equal(compareNewestFirst(a, a), 0);
});

test('sortNewestFirst: does not mutate its input array', () => {
  const input = [article({ uuid: 'a', publishedAt: 100 }), article({ uuid: 'b', publishedAt: 200 })];
  const originalOrder = input.map((a) => a.uuid);
  const sorted = sortNewestFirst(input);
  assert.deepEqual(
    input.map((a) => a.uuid),
    originalOrder,
    'input array order must be unchanged'
  );
  assert.deepEqual(
    sorted.map((a) => a.uuid),
    ['b', 'a']
  );
  assert.notEqual(sorted, input, 'must return a new array, not the same reference');
});

// ---------------------------------------------------------------------------
// groupByCategory
// ---------------------------------------------------------------------------

test('groupByCategory: returns a Map with all 8 CATEGORIES slugs as keys, including empty categories', () => {
  const articles = [article({ uuid: 'a', publishedAt: 100, categorySlug: 'crime' })];
  const grouped = groupByCategory(articles);
  const EXPECTED_SLUGS = ['crime', 'politics', 'sports', 'business', 'education', 'community', 'health', 'weather'];
  assert.deepEqual([...grouped.keys()].sort(), [...EXPECTED_SLUGS].sort());
  assert.equal(grouped.get('crime').length, 1);
  assert.deepEqual(grouped.get('politics'), []);
});

test('groupByCategory: articles within a category are sorted newest first', () => {
  const articles = [
    article({ uuid: 'old', publishedAt: 100, categorySlug: 'crime' }),
    article({ uuid: 'new', publishedAt: 200, categorySlug: 'crime' }),
  ];
  const grouped = groupByCategory(articles);
  assert.deepEqual(
    grouped.get('crime').map((a) => a.uuid),
    ['new', 'old']
  );
});

// ---------------------------------------------------------------------------
// groupByTag
// ---------------------------------------------------------------------------

test('groupByTag: keys only tags present on at least one article', () => {
  const articles = [
    article({ uuid: 'a', publishedAt: 100, tags: [{ slug: 'weather-alert', name: 'Weather Alert' }] }),
  ];
  const grouped = groupByTag(articles);
  assert.equal(grouped.size, 1);
  assert.ok(grouped.has('weather-alert'));
});

test('groupByTag: each value is { name, articles } sorted newest first', () => {
  const tag = { slug: 'crime-news', name: 'Crime News' };
  const articles = [
    article({ uuid: 'old', publishedAt: 100, tags: [tag] }),
    article({ uuid: 'new', publishedAt: 200, tags: [tag] }),
  ];
  const grouped = groupByTag(articles);
  const entry = grouped.get('crime-news');
  assert.equal(entry.name, 'Crime News');
  assert.deepEqual(
    entry.articles.map((a) => a.uuid),
    ['new', 'old']
  );
});

// ---------------------------------------------------------------------------
// groupBySource
// ---------------------------------------------------------------------------

test('groupBySource: keys by source slug with { source, articles }', () => {
  const articles = [
    article({ uuid: 'a', publishedAt: 100, sourceSlug: 'ktsm', sourceName: 'KTSM' }),
    article({ uuid: 'b', publishedAt: 200, sourceSlug: 'ktsm', sourceName: 'KTSM' }),
  ];
  const grouped = groupBySource(articles);
  assert.equal(grouped.size, 1);
  const entry = grouped.get('ktsm');
  assert.equal(entry.source.name, 'KTSM');
  assert.deepEqual(
    entry.articles.map((a) => a.uuid),
    ['b', 'a']
  );
});

// ---------------------------------------------------------------------------
// tagIndex
// ---------------------------------------------------------------------------

test('tagIndex: returns [{ slug, name, count }] sorted by count desc then slug asc', () => {
  const articles = [
    article({ uuid: 'a', publishedAt: 300, tags: [{ slug: 'zeta', name: 'Zeta' }] }),
    article({ uuid: 'b', publishedAt: 200, tags: [{ slug: 'alpha', name: 'Alpha' }] }),
    article({ uuid: 'c', publishedAt: 100, tags: [{ slug: 'alpha', name: 'Alpha' }] }),
  ];
  const index = tagIndex(articles);
  assert.deepEqual(index, [
    { slug: 'alpha', name: 'Alpha', count: 2 },
    { slug: 'zeta', name: 'Zeta', count: 1 },
  ]);
});

test('tagIndex: equal counts break ties by slug ascending', () => {
  const articles = [
    article({ uuid: 'a', publishedAt: 200, tags: [{ slug: 'zeta', name: 'Zeta' }] }),
    article({ uuid: 'b', publishedAt: 100, tags: [{ slug: 'alpha', name: 'Alpha' }] }),
  ];
  const index = tagIndex(articles);
  assert.deepEqual(
    index.map((t) => t.slug),
    ['alpha', 'zeta']
  );
});

// ---------------------------------------------------------------------------
// assertNoRouteCollisions
// ---------------------------------------------------------------------------

test('assertNoRouteCollisions: throws naming the colliding slug', () => {
  assert.throws(
    () => assertNoRouteCollisions(['crime', 'changelog']),
    /listing: category slug "changelog" collides with a reserved top-level route/
  );
});

test('assertNoRouteCollisions: the 8 real category slugs pass', () => {
  const REAL_CATEGORY_SLUGS = ['crime', 'politics', 'sports', 'business', 'education', 'community', 'health', 'weather'];
  assert.doesNotThrow(() => assertNoRouteCollisions(REAL_CATEGORY_SLUGS));
});

test('RESERVED_TOP_LEVEL: contains every documented reserved name', () => {
  const EXPECTED = [
    'changelog',
    'contact',
    'about',
    'privacy',
    'terms',
    'tags',
    'tag',
    'source',
    '404',
    'rss.xml',
    'news-sitemap.xml',
    'sitemap-index.xml',
    'sitemap.xml',
    'version.json',
    '404-index.json',
    'latest.json',
    'categories',
    'sources',
    'new',
    'search',
    'stats',
    'article',
    'fonts',
    '_astro',
  ];
  for (const name of EXPECTED) {
    assert.ok(RESERVED_TOP_LEVEL.includes(name), `expected RESERVED_TOP_LEVEL to include "${name}"`);
  }
});

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

test('constants: CATEGORY_PAGE_COUNT, TAG_PAGE_COUNT and SOURCE_PAGE_COUNT are 30; TAGS_INDEX_COUNT is 100', () => {
  assert.equal(CATEGORY_PAGE_COUNT, 30);
  assert.equal(TAG_PAGE_COUNT, 30);
  assert.equal(SOURCE_PAGE_COUNT, 30);
  assert.equal(TAGS_INDEX_COUNT, 100);
});

test('constants: HOME_FEED_COUNT matches the initial no-JS card count in design/mockups/index.html', () => {
  // design/mockups/index.html's no-JS feed state: 1 lead article + 6 cards inside
  // <section data-grid> between the feed:start/feed:end markers = 7 total rendered cards.
  // sortNewestFirst().slice(0, HOME_FEED_COUNT) draws the whole rendered set from one flat list
  // (no separate "lead" concept in the loader), so HOME_FEED_COUNT counts every card shown.
  assert.equal(HOME_FEED_COUNT, 7);
});
