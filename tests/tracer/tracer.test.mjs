#!/usr/bin/env node
// D-02: end-to-end proof that the built HTML and the KV manifest entry agree with the live D1
// row the tracer rendered. Runs against the real `dist/` build output and the real KV
// namespace — not a mock, not a fixture. Follows the `node:test` structure of
// design/tests/unit/check-contrast.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fetchLatestArticle } from '../../src/lib/server/d1-client.ts';
import { getManifestEntry } from '../../src/lib/server/kv-manifest.ts';

const DIST = path.resolve(import.meta.dirname, '../../dist');

function findArticleHtmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) {
      found.push(...findArticleHtmlFiles(full));
    } else if (entry === 'index.html' && full !== path.join(DIST, 'index.html')) {
      found.push(full);
    }
  }
  return found;
}

test('tracer: one real article renders and is recorded', async (t) => {
  const row = await fetchLatestArticle();
  assert.ok(row, 'fetchLatestArticle() must return the same live row the build used');

  await t.test('exactly one article HTML file was emitted', () => {
    const files = findArticleHtmlFiles(DIST);
    assert.equal(files.length, 1, `expected exactly 1 article index.html, found ${files.length}`);
  });

  await t.test('the built HTML carries the live headline', () => {
    const files = findArticleHtmlFiles(DIST);
    const html = readFileSync(files[0], 'utf8');
    assert.ok(
      html.includes(row.title),
      'built article HTML must contain the D1 row headline text, not a fixture/placeholder'
    );
  });

  await t.test('the KV manifest entry agrees with the D1 row', async () => {
    const entry = await getManifestEntry(row.id);
    assert.ok(entry, `manifest:${row.id} must exist in KV`);

    for (const key of [
      'articleId',
      'translationGroupId',
      'language',
      'contentHash',
      'schemaVersion',
      'renderedAt',
      'buildHash',
      'category',
      'publishedAt',
    ]) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(entry, key),
        `manifest entry is missing key "${key}" — a missing key and a null value are different failures`
      );
    }

    assert.equal(entry.articleId, row.id);
    // 03-04 Option C: translationGroupId equals the article's own uuid for every English-only
    // entry written today — never null, never a pointer to a record that does not exist yet.
    assert.equal(entry.translationGroupId, row.id);
    assert.equal(entry.language, 'en');
    assert.match(entry.contentHash, /^[0-9a-f]{64}$/, 'contentHash must be a 64-char hex string');
  });
});
