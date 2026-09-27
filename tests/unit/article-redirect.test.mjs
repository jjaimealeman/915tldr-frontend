// D-08 / T-04-22 / T-04-23: TDD RED/GREEN suite for src/lib/article-redirect.ts, the pure
// uuid-extraction + redirect-decision module the 04-06 Worker (src/worker.ts) is built from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractArticleUuid, resolveRedirect } from '../../src/lib/article-redirect.ts';

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const UUID_UPPER = '3F2504E0-4F89-11D3-9A0C-0305E82C3301';

// ---------------------------------------------------------------------------
// extractArticleUuid
// ---------------------------------------------------------------------------

test('extractArticleUuid: extracts and lowercases an uppercase uuid at the end of a category/slug path', () => {
  assert.equal(extractArticleUuid(`/crime/some-slug-${UUID_UPPER}`), UUID);
});

test('extractArticleUuid: /article/<uuid> shape', () => {
  assert.equal(extractArticleUuid(`/article/${UUID}`), UUID);
});

test('extractArticleUuid: a trailing slash after the uuid is tolerated', () => {
  assert.equal(extractArticleUuid(`/article/${UUID}/`), UUID);
});

test('extractArticleUuid: a .html suffix is tolerated', () => {
  assert.equal(extractArticleUuid(`/article/${UUID}.html`), UUID);
});

test('extractArticleUuid: returns null for a bare category path with no uuid', () => {
  assert.equal(extractArticleUuid('/crime'), null);
});

test('extractArticleUuid: returns null for a category/slug path with no uuid', () => {
  assert.equal(extractArticleUuid('/crime/some-slug'), null);
});

test('extractArticleUuid: returns null for an 8-character short id (D-09)', () => {
  assert.equal(extractArticleUuid('/crime/some-slug-3f2504e0'), null);
});

test('extractArticleUuid: returns null for malformed percent-encoding', () => {
  assert.equal(extractArticleUuid('/%E0%A4%A'), null);
});

// ---------------------------------------------------------------------------
// resolveRedirect
// ---------------------------------------------------------------------------

function validEntry(overrides = {}) {
  return {
    schemaVersion: '2',
    articleId: UUID,
    category: 'crime',
    slug: 'new-title',
    ...overrides,
  };
}

test('resolveRedirect: a non-canonical path with a valid v2 entry redirects to the canonical path', () => {
  const decision = resolveRedirect(`/politics/old-title-${UUID}`, validEntry());
  assert.deepEqual(decision, { type: 'redirect', location: `/crime/new-title-${UUID}` });
});

test('resolveRedirect: the canonical path itself never redirects (loop guard)', () => {
  const decision = resolveRedirect(`/crime/new-title-${UUID}`, validEntry());
  assert.deepEqual(decision, { type: 'not-found' });
});

test('resolveRedirect: a null entry is not-found', () => {
  assert.deepEqual(resolveRedirect(`/politics/old-title-${UUID}`, null), { type: 'not-found' });
});

test('resolveRedirect: schemaVersion "1" is not-found (pre-slug manifest entry)', () => {
  const decision = resolveRedirect(`/politics/old-title-${UUID}`, validEntry({ schemaVersion: '1' }));
  assert.deepEqual(decision, { type: 'not-found' });
});

test('resolveRedirect: a slug containing "/" is not-found', () => {
  const decision = resolveRedirect(`/politics/old-title-${UUID}`, validEntry({ slug: 'new/title' }));
  assert.deepEqual(decision, { type: 'not-found' });
});

test('resolveRedirect: a category failing CATEGORY_SLUG_RE is not-found', () => {
  const decision = resolveRedirect(`/politics/old-title-${UUID}`, validEntry({ category: 'Crime!' }));
  assert.deepEqual(decision, { type: 'not-found' });
});

test('resolveRedirect: a malformed articleId is not-found', () => {
  const decision = resolveRedirect(`/politics/old-title-${UUID}`, validEntry({ articleId: 'not-a-uuid' }));
  assert.deepEqual(decision, { type: 'not-found' });
});

test('resolveRedirect: the Location is built only from validated manifest fields, never the request path (T-04-22)', () => {
  // A pathname carrying a suspicious host-like segment must not leak into the Location — the
  // redirect target is derived solely from `entry`.
  const decision = resolveRedirect(`//evil.example.com/${UUID}`, validEntry());
  assert.deepEqual(decision, { type: 'redirect', location: `/crime/new-title-${UUID}` });
  assert.ok(decision.location.startsWith('/crime/'));
  assert.ok(!decision.location.includes('evil.example.com'));
});
