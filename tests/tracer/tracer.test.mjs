#!/usr/bin/env node
// D-02 / Task 2 (04-01-PLAN.md): end-to-end proof that the built HTML, the KV manifest entry, and
// (when TRACER_LIVE_ORIGIN is set) the live deployment all agree on the stored-slug canonical
// shape. Runs against the real `dist/client` build output and the real KV namespace — not a
// mock, not a fixture.
//
// Rewritten for 04-01: `build.format: 'file'` means article pages emit `<slug>-<uuid>.html`
// directly under their category directory (no `index.html` folder-per-route), and every URL is
// built from the loader's real content collection, not a single hand-picked "latest article"
// row. This test therefore samples the emitted corpus rather than asserting exactly one file, and
// compares titles decoded-to-decoded — never raw D1 text against Astro's HTML-escaped output, the
// exact bug in the folded todo
// .planning/todos/pending/2026-09-26-tracer-test-html-entity-title.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { getManifestEntry } from '../../src/lib/server/kv-manifest.ts';
import { ARTICLE_SLUG_RE, UUID_RE } from '../../src/lib/article-url.ts';
import { decodeEntities, textOf } from '../helpers/html-text.mjs';

const DIST_CLIENT = path.resolve(import.meta.dirname, '../../dist/client');
const ARTICLE_FILE_RE =
  /^(.+)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;
const SAMPLE_SIZE = 3;

/** Article pages live exactly one directory below `dist/client` — `dist/client/<category>/
 * <slug>-<uuid>.html` — with `build.format: 'file'` (04-01). Non-article top-level files
 * (`version.json`, `_headers`, etc.) and other directories are ignored. */
function findArticleHtmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    for (const inner of readdirSync(full)) {
      const innerFull = path.join(full, inner);
      if (statSync(innerFull).isFile() && ARTICLE_FILE_RE.test(inner)) {
        found.push(innerFull);
      }
    }
  }
  return found;
}

function parseArticleFile(filePath) {
  const filename = path.basename(filePath);
  const match = filename.match(ARTICLE_FILE_RE);
  if (!match) return null;
  const [, slug, uuid] = match;
  const category = path.basename(path.dirname(filePath));
  return { filePath, filename, slug, uuid, category };
}

test('tracer: the built corpus resolves to stored-slug canonical files and manifest v2 entries', async (t) => {
  const files = findArticleHtmlFiles(DIST_CLIENT);

  await t.test('at least one article HTML file was emitted', () => {
    assert.ok(files.length > 0, 'expected at least one article HTML file under dist/client');
  });

  await t.test('every emitted article filename slug segment matches ARTICLE_SLUG_RE', () => {
    for (const filePath of files) {
      const parsed = parseArticleFile(filePath);
      assert.ok(parsed, `file ${filePath} does not match the <slug>-<uuid>.html shape`);
      assert.match(parsed.slug, ARTICLE_SLUG_RE, `slug segment of ${filePath} fails ARTICLE_SLUG_RE`);
      assert.match(parsed.uuid, UUID_RE, `uuid segment of ${filePath} fails UUID_RE`);
    }
  });

  const sample = files.slice(0, SAMPLE_SIZE).map(parseArticleFile).filter(Boolean);

  await t.test(
    'sampled files: manifest entry is v2 with slug equal to the filename slug, and the <h1> title round-trips decoded',
    async () => {
      for (const item of sample) {
        const entry = await getManifestEntry(item.uuid);
        assert.ok(entry, `manifest:${item.uuid} must exist in KV`);
        assert.equal(entry.schemaVersion, '2', `manifest:${item.uuid} must be schema v2`);
        assert.equal(
          entry.slug,
          item.slug,
          `manifest:${item.uuid} slug must equal the filename's slug segment`
        );

        const html = readFileSync(item.filePath, 'utf8');
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        assert.ok(h1Match, `${item.filePath} must contain an <h1> title`);

        // Read the title straight from the page's own <h1> (manifest-independent — the manifest
        // never stores a title) and decode it explicitly, never comparing raw D1 text against
        // Astro's HTML-escaped output directly.
        const pageTitle = decodeEntities(h1Match[1]);
        assert.ok(pageTitle.length > 0, `${item.filePath}'s <h1> must not be empty after decoding`);
        assert.ok(
          textOf(html).includes(pageTitle),
          `${item.filePath} rendered text must include its own decoded <h1> title`
        );
      }
    }
  );

  const liveOrigin = process.env.TRACER_LIVE_ORIGIN;
  await t.test(
    'live: canonical path returns 200 with no Location header; trailing-slash variant redirects to it',
    { skip: !liveOrigin && 'TRACER_LIVE_ORIGIN not set' },
    async () => {
      const item = sample[0];
      assert.ok(item, 'expected at least one sampled file to test live');
      const canonicalPath = `/${item.category}/${item.filename.replace(/\.html$/, '')}`;

      const res = await fetch(`${liveOrigin}${canonicalPath}`, { redirect: 'manual' });
      assert.equal(res.status, 200, `expected 200 for ${canonicalPath}, got ${res.status}`);
      assert.equal(res.headers.get('location'), null, `expected no Location header for ${canonicalPath}`);

      const slashRes = await fetch(`${liveOrigin}${canonicalPath}/`, { redirect: 'manual' });
      assert.ok(
        slashRes.status >= 300 && slashRes.status < 400,
        `expected a 3xx for ${canonicalPath}/, got ${slashRes.status}`
      );
      const location = slashRes.headers.get('location');
      assert.ok(location, `expected a Location header for ${canonicalPath}/`);
      const resolvedPath = new URL(location, liveOrigin).pathname;
      assert.equal(
        resolvedPath,
        canonicalPath,
        'the trailing-slash variant Location header must resolve to the no-slash canonical path'
      );
    }
  );
});
