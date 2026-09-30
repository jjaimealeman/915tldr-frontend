// 04-04 (Task 2): rail neighbour selection (owner decision 2026-09-26, option-a — article-relative
// rail) — pure module, no I/O, no build required. Follows the `node:test` + `assert/strict`
// structure this repo uses (tests/unit/format.test.mjs, tests/unit/structured-data.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRails, railFingerprint } from '../../src/lib/rail.ts';

/** Minimal fixture matching the ArticleData shape's render-relevant fields (uuid, title, slug,
 * category, source, publishedAt) — rail.ts never reads summary/keyPoints/url/tags. */
function article(uuid, publishedAt, categorySlug, categoryName = categorySlug, title = `Title ${uuid}`) {
  return {
    uuid,
    title,
    slug: `slug-${uuid}`,
    publishedAt,
    category: { slug: categorySlug, name: categoryName },
    source: { name: 'KTSM' },
  };
}

test('computeRails: "more" holds up to 3 same-category stories published before the article', () => {
  const articles = [
    article('a1', 500, 'crime'),
    article('a2', 400, 'crime'),
    article('a3', 300, 'crime'),
    article('a4', 200, 'crime'),
    article('a5', 100, 'crime'),
  ];
  const rails = computeRails(articles);
  const rail = rails.get('a1');
  assert.deepEqual(
    rail.more.map((a) => a.uuid),
    ['a2', 'a3', 'a4']
  );
});

test('computeRails: "second" (site-wide) holds up to 5 stories published before the article, across categories', () => {
  const articles = [
    article('a1', 600, 'crime'),
    article('a2', 500, 'politics'),
    article('a3', 400, 'sports'),
    article('a4', 300, 'crime'),
    article('a5', 200, 'business'),
    article('a6', 100, 'education'),
    article('a7', 50, 'health'),
  ];
  const rails = computeRails(articles);
  const rail = rails.get('a1');
  assert.deepEqual(
    rail.second.map((a) => a.uuid),
    ['a2', 'a3', 'a4', 'a5', 'a6']
  );
});

test('computeRails: secondHeading is "Earlier" (owner-selected option-a)', () => {
  const articles = [article('a1', 200, 'crime'), article('a2', 100, 'crime')];
  const rails = computeRails(articles);
  assert.equal(rails.get('a1').secondHeading, 'Earlier');
});

test('computeRails: the oldest article in the whole collection has empty more/second arrays', () => {
  const articles = [
    article('a1', 300, 'crime'),
    article('a2', 200, 'crime'),
    article('a3', 100, 'crime'),
  ];
  const rails = computeRails(articles);
  const oldest = rails.get('a3');
  assert.deepEqual(oldest.more, []);
  assert.deepEqual(oldest.second, []);
});

test('computeRails: ordering is publishedAt desc then uuid asc for tie-breaking', () => {
  const articles = [
    article('b', 100, 'crime'),
    article('a', 100, 'crime'),
    article('c', 200, 'crime'),
  ];
  const rails = computeRails(articles);
  // c (200) is newest; among the two tied at 100, uuid asc means "a" sorts before "b".
  assert.deepEqual(
    rails.get('c').more.map((x) => x.uuid),
    ['a', 'b']
  );
});

test('computeRails: a category with only one article gets an empty "more" array', () => {
  const articles = [
    article('a1', 200, 'crime'),
    article('a2', 100, 'politics'),
  ];
  const rails = computeRails(articles);
  assert.deepEqual(rails.get('a1').more, []);
});

test('computeRails: respects custom moreCount/secondCount options', () => {
  const articles = [
    article('a1', 500, 'crime'),
    article('a2', 400, 'crime'),
    article('a3', 300, 'crime'),
    article('a4', 200, 'crime'),
  ];
  const rails = computeRails(articles, { moreCount: 1, secondCount: 2 });
  const rail = rails.get('a1');
  assert.equal(rail.more.length, 1);
  assert.equal(rail.second.length, 2);
});

// --- railFingerprint -------------------------------------------------------------------------

test('railFingerprint: identical for identical inputs', () => {
  const articles = [article('a1', 200, 'crime'), article('a2', 100, 'crime')];
  const rails1 = computeRails(articles);
  const rails2 = computeRails(articles.map((a) => ({ ...a })));
  assert.equal(railFingerprint(rails1.get('a1')), railFingerprint(rails2.get('a1')));
});

test('railFingerprint: changes when a neighbour\'s title changes', () => {
  const base = [article('a1', 200, 'crime'), article('a2', 100, 'crime', 'crime', 'Original Title')];
  const changed = [article('a1', 200, 'crime'), article('a2', 100, 'crime', 'crime', 'Retitled')];
  const railsBase = computeRails(base);
  const railsChanged = computeRails(changed);
  assert.notEqual(railFingerprint(railsBase.get('a1')), railFingerprint(railsChanged.get('a1')));
});

test('railFingerprint: changes when a neighbour\'s slug changes', () => {
  const base = [article('a1', 200, 'crime'), article('a2', 100, 'crime')];
  const changed = [article('a1', 200, 'crime'), { ...article('a2', 100, 'crime'), slug: 'a-new-slug' }];
  const railsBase = computeRails(base);
  const railsChanged = computeRails(changed);
  assert.notEqual(railFingerprint(railsBase.get('a1')), railFingerprint(railsChanged.get('a1')));
});

test('railFingerprint: changes when a neighbour\'s category changes', () => {
  const base = [article('a1', 200, 'crime'), article('a2', 100, 'crime')];
  const changed = [article('a1', 200, 'crime'), article('a2', 100, 'politics')];
  const railsBase = computeRails(base);
  const railsChanged = computeRails(changed);
  // a2 no longer shares a1's category, so "more" differs too — compare "second" which still
  // includes a2 site-wide either way.
  assert.notEqual(railFingerprint(railsBase.get('a1')), railFingerprint(railsChanged.get('a1')));
});

test('railFingerprint: changes when a neighbour\'s uuid changes', () => {
  const base = [article('a1', 200, 'crime'), article('a2', 100, 'crime')];
  const changed = [article('a1', 200, 'crime'), article('a3', 100, 'crime')];
  const railsBase = computeRails(base);
  const railsChanged = computeRails(changed);
  assert.notEqual(railFingerprint(railsBase.get('a1')), railFingerprint(railsChanged.get('a1')));
});
