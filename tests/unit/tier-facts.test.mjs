// 05-01 Task 1 (tracer): proves a real build's tier facts (`.astro/tier-facts-articles.json`,
// `.astro/tier-facts-tags.json`) match the built pages end to end, and that
// `tools/tier-report.mjs` classifies them correctly. Dist-based — skips cleanly when dist/client
// or the facts are absent, same skip pattern as tests/unit/listing-pages.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { readTierFacts, ARTICLE_FACTS_PATH, TAG_FACTS_PATH } from '../../src/lib/archive/tier-facts.ts';
import { UUID_RE, TAG_SLUG_RE } from '../../src/lib/article-url.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const ARTICLE_FACTS_ABS = path.join(REPO_ROOT, ARTICLE_FACTS_PATH);
const TAG_FACTS_ABS = path.join(REPO_ROOT, TAG_FACTS_PATH);
const DIST_BUILT = existsSync(DIST_CLIENT) && existsSync(ARTICLE_FACTS_ABS) && existsSync(TAG_FACTS_ABS);
const SKIP_REASON =
  'dist/client or tier facts not found — run `pnpm build` first (pnpm test:unit does this automatically)';

const ARTICLE_FILE_RE =
  /^(.+)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;

/** Every article HTML file under a category directory (`dist/client/<category>/<slug>-<uuid>.html`). */
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

test(
  'tier-facts: one article fact per built article html file, each with a valid uuid/path/publishedAt',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const { articles } = readTierFacts();
    const articleFiles = findArticleHtmlFiles(DIST_CLIENT);
    assert.equal(articles.length, articleFiles.length, 'expected one article fact per built article html file');

    for (const fact of articles) {
      assert.match(fact.uuid, UUID_RE);
      assert.ok(fact.path.startsWith('/'), `expected path to start with /, got ${fact.path}`);
      assert.ok(fact.path.endsWith(fact.uuid), `expected path to end with the uuid, got ${fact.path}`);
      assert.ok(Number.isInteger(fact.publishedAt) && fact.publishedAt > 0, 'expected a positive integer publishedAt');
    }
  }
);

test(
  'tier-facts: tag fact count matches .astro/tag-build-log.json tagCount, each with a valid slug and a positive full count',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const buildLogPath = path.join(REPO_ROOT, '.astro', 'tag-build-log.json');
    assert.ok(existsSync(buildLogPath), 'expected .astro/tag-build-log.json to exist after a build');
    const buildLog = JSON.parse(readFileSync(buildLogPath, 'utf8'));

    const { tags } = readTierFacts();
    assert.equal(tags.length, buildLog.tagCount, "expected one tag fact per tag getStaticPaths's own authoritative count");

    for (const fact of tags) {
      assert.match(fact.slug, TAG_SLUG_RE);
      assert.ok(Number.isInteger(fact.count) && fact.count >= 1, 'expected a positive integer count');
    }
  }
);

test(
  'tier-facts: node tools/tier-report.mjs --json exits 0, classifies tags.hot as the count with count >= 10, flags hotWindow.provisional',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const out = execFileSync('node', ['tools/tier-report.mjs', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
    const report = JSON.parse(out);

    const { tags } = readTierFacts();
    const expectedHot = tags.filter((t) => t.count >= 10).length;

    assert.equal(report.tags.hot, expectedHot);
    assert.equal(report.hotWindow.provisional, true, 'expected the bootstrap D-07 window to report provisional: true');
  }
);

// ---------------------------------------------------------------------------
// Task 3: cross-checks against the real build — facts provably match the built pages.
// ---------------------------------------------------------------------------

test(
  'tier-facts: every article fact path maps to an existing dist/client<path>.html file',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const { articles } = readTierFacts();
    for (const fact of articles) {
      const htmlPath = path.join(DIST_CLIENT, `${fact.path}.html`);
      assert.ok(existsSync(htmlPath), `expected ${htmlPath} to exist for fact path ${fact.path}`);
    }
  }
);

test(
  'tier-facts: the set of fact uuids equals the set of uuids parsed from built article file names',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const { articles } = readTierFacts();
    const factUuids = new Set(articles.map((fact) => fact.uuid));

    const builtUuids = new Set();
    for (const filePath of findArticleHtmlFiles(DIST_CLIENT)) {
      const match = ARTICLE_FILE_RE.exec(path.basename(filePath));
      assert.ok(match, `expected ${filePath} to match the article file name pattern`);
      builtUuids.add(match[2].toLowerCase());
    }

    assert.equal(factUuids.size, builtUuids.size, 'expected the same number of unique uuids on both sides');
    for (const uuid of factUuids) {
      assert.ok(builtUuids.has(uuid), `fact uuid ${uuid} has no matching built article file`);
    }
    for (const uuid of builtUuids) {
      assert.ok(factUuids.has(uuid), `built article file uuid ${uuid} has no matching fact`);
    }
  }
);

test(
  'tier-facts: no duplicate uuid in article facts, no duplicate slug in tag facts',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const { articles, tags } = readTierFacts();

    const uuids = articles.map((fact) => fact.uuid);
    assert.equal(new Set(uuids).size, uuids.length, 'expected no duplicate uuid among article facts');

    const slugs = tags.map((fact) => fact.slug);
    assert.equal(new Set(slugs).size, slugs.length, 'expected no duplicate slug among tag facts');
  }
);

test(
  'tier-facts: the sum of tag facts with count >= 10 equals tools/tier-report.mjs --json\'s tags.hot',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const { tags } = readTierFacts();
    const expectedHot = tags.filter((fact) => fact.count >= 10).length;

    const out = execFileSync('node', ['tools/tier-report.mjs', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
    const report = JSON.parse(out);

    assert.equal(report.tags.hot, expectedHot);
  }
);
