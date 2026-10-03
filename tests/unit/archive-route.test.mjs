// D-08 (05-03 Task 2): TDD RED/GREEN suite for src/lib/archive/archive-route.ts's tag-path
// matching, tag-key derivation and Server-Timing formatting. Task 1's articleArchiveKey already
// has coverage via worker-bundle.test.mjs's live behaviors; this file covers the functions Task 2
// adds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  articleArchiveKey,
  formatServerTiming,
  matchTagPath,
  tagArchiveKey,
} from '../../src/lib/archive/archive-route.ts';

// ---------------------------------------------------------------------------
// articleArchiveKey (Task 1 — re-confirmed here alongside the new functions)
// ---------------------------------------------------------------------------

test('articleArchiveKey: lowercases and prefixes a valid uuid', () => {
  assert.equal(
    articleArchiveKey('3F2504E0-4F89-11D3-9A0C-0305E82C3301'),
    'articles/3f2504e0-4f89-11d3-9a0c-0305e82c3301.html'
  );
});

test('articleArchiveKey: throws on a non-uuid argument', () => {
  assert.throws(() => articleArchiveKey('not-a-uuid'), /archive-route: invalid articleId/);
});

// ---------------------------------------------------------------------------
// matchTagPath
// ---------------------------------------------------------------------------

test('matchTagPath: bare canonical tag path', () => {
  assert.deepEqual(matchTagPath('/tag/el-paso'), { slug: 'el-paso', suffix: '', language: 'en' });
});

test('matchTagPath: trailing slash suffix', () => {
  assert.deepEqual(matchTagPath('/tag/el-paso/'), { slug: 'el-paso', suffix: '/', language: 'en' });
});

test('matchTagPath: .html suffix', () => {
  assert.deepEqual(matchTagPath('/tag/el-paso.html'), {
    slug: 'el-paso',
    suffix: '.html',
    language: 'en',
  });
});

test('matchTagPath: an uppercase slug is rejected', () => {
  assert.equal(matchTagPath('/tag/El-Paso'), null);
});

test('matchTagPath: a bare /tag/ with no slug is rejected', () => {
  assert.equal(matchTagPath('/tag/'), null);
});

test('matchTagPath: an extra path segment is rejected', () => {
  assert.equal(matchTagPath('/tag/a/b'), null);
});

test('matchTagPath: /tags (no trailing slash, the index page) is rejected', () => {
  assert.equal(matchTagPath('/tags'), null);
});

test('matchTagPath: a path-traversal-shaped slug is rejected', () => {
  assert.equal(matchTagPath('/tag/%2e%2e'), null);
});

test('matchTagPath: malformed percent-encoding returns null, never throws', () => {
  assert.equal(matchTagPath('/tag/%E0%A4%A'), null);
});

// ---------------------------------------------------------------------------
// tagArchiveKey
// ---------------------------------------------------------------------------

test('tagArchiveKey: prefixes a valid slug', () => {
  assert.equal(tagArchiveKey('el-paso'), 'tags/el-paso.html');
});

test('tagArchiveKey: throws on an invalid slug', () => {
  assert.throws(() => tagArchiveKey('El_Paso'), /archive-route: invalid tag slug/);
});

// ---------------------------------------------------------------------------
// 06-02 Task 2: abuse cases — malformed language (closed enum, no trimming/case-folding; T-06-07)
// and /es/tag path traversal (T-06-08)
// ---------------------------------------------------------------------------

test('matchTagPath: /es/tag/<slug> is a language "es" match', () => {
  assert.deepEqual(matchTagPath('/es/tag/el-paso'), { slug: 'el-paso', suffix: '', language: 'es' });
});

test('matchTagPath: /es/tag/%2e%2e (path traversal under /es) is rejected', () => {
  assert.equal(matchTagPath('/es/tag/%2e%2e'), null);
});

test('matchTagPath: /es/tag/ (no slug) is rejected', () => {
  assert.equal(matchTagPath('/es/tag/'), null);
});

test('matchTagPath: /es/tags (index page, no trailing slash) is rejected', () => {
  assert.equal(matchTagPath('/es/tags'), null);
});

test('articleArchiveKey: a language with trailing whitespace throws — no trimming', () => {
  assert.throws(
    () => articleArchiveKey('3f2504e0-4f89-11d3-9a0c-0305e82c3301', 'es '),
    /article-url: invalid language: "es "/
  );
});

test('tagArchiveKey: an uppercase language throws — no case-folding', () => {
  assert.throws(() => tagArchiveKey('a', 'ES'), /article-url: invalid language: "ES"/);
});

// ---------------------------------------------------------------------------
// formatServerTiming
// ---------------------------------------------------------------------------

test('formatServerTiming: formats a mix of desc-only, dur-only and bare metrics', () => {
  assert.equal(
    formatServerTiming([
      { name: 'archive', desc: 'r2' },
      { name: 'kv', dur: 12 },
      { name: 'r2', dur: 34 },
    ]),
    'archive;desc=r2, kv;dur=12, r2;dur=34'
  );
});

test('formatServerTiming: a single metric with no desc/dur renders as its bare name', () => {
  assert.equal(formatServerTiming([{ name: 'edge-cache' }]), 'edge-cache');
});

test('formatServerTiming: an empty list renders as an empty string', () => {
  assert.equal(formatServerTiming([]), '');
});
