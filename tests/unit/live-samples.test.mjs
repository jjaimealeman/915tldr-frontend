// Post-phase-06 closeout, task B: deterministic wide sampling for the live fallback-page search.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strideSample, canonicalArticlePathsFromSitemap } from '../helpers/live-samples.mjs';

test('strideSample: deterministic, evenly spread, never more than n, keeps order', () => {
  const items = Array.from({ length: 1000 }, (_, i) => i);
  const a = strideSample(items, 10);
  assert.deepEqual(a, strideSample(items, 10));
  assert.equal(a.length, 10);
  assert.deepEqual(a, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900]);
});

test('strideSample: fewer items than n returns them all; n <= 0 returns none', () => {
  assert.deepEqual(strideSample([1, 2, 3], 10), [1, 2, 3]);
  assert.deepEqual(strideSample([1, 2, 3], 0), []);
});

test('canonicalArticlePathsFromSitemap: keeps /<category>/<slug>-<uuid> article paths only', () => {
  const xml = `<urlset>
    <url><loc>https://915tldr.com/</loc></url>
    <url><loc>https://915tldr.com/tag/busan</loc></url>
    <url><loc>https://915tldr.com/crime/some-story-0d1f2a3b-1111-4222-8333-444455556666</loc></url>
    <url><loc>https://915tldr.com/es/crime/some-story-0d1f2a3b-1111-4222-8333-444455556666</loc></url>
  </urlset>`;
  assert.deepEqual(canonicalArticlePathsFromSitemap(xml), ['/crime/some-story-0d1f2a3b-1111-4222-8333-444455556666']);
});
