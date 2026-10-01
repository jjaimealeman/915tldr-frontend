// 05-01 Task 1 (tracer): proves a real build's tier facts (`.astro/tier-facts-articles.json`,
// `.astro/tier-facts-tags.json`) match the built pages end to end, and that
// `tools/tier-report.mjs` classifies them correctly. Dist-based — skips cleanly when dist/client
// or the facts are absent, same skip pattern as tests/unit/listing-pages.test.mjs.
//
// 05-06 (Task 3): every cross-check below now applies the "static or archived" rule — a fact's
// page may legitimately live under dist/client (hot tier) OR have been moved to dist/archive by
// tools/partition-archive.mjs (archive tier, named by dist/archive-plan.json). Both the "built"
// uuid set and the per-fact existence check now look in both places, so partitioning an
// archive-tier article out of dist/client is never mistaken for a missing/orphaned fact.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { readTierFacts, ARTICLE_FACTS_PATH, TAG_FACTS_PATH } from '../../src/lib/archive/tier-facts.ts';
import { UUID_RE, TAG_SLUG_RE } from '../../src/lib/article-url.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const ARCHIVE_PLAN_PATH = path.join(REPO_ROOT, 'dist', 'archive-plan.json');
const ARTICLE_FACTS_ABS = path.join(REPO_ROOT, ARTICLE_FACTS_PATH);
const TAG_FACTS_ABS = path.join(REPO_ROOT, TAG_FACTS_PATH);
const DIST_BUILT = existsSync(DIST_CLIENT) && existsSync(ARTICLE_FACTS_ABS) && existsSync(TAG_FACTS_ABS);
const SKIP_REASON =
  'dist/client or tier facts not found — run `pnpm build` first (pnpm test:unit does this automatically)';

const ARTICLE_FILE_RE =
  /^(.+)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;
const ARCHIVED_ARTICLE_KEY_RE =
  /^articles\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;

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

/** Reads `dist/archive-plan.json` if present (a build with nothing archived, or a stale
 * pre-05-06 dist/, both legitimately have none) — returns `{ entries: [] }` otherwise, never
 * throws, so every cross-check below degrades to "archived set is empty" rather than failing to
 * even read the plan. */
function loadArchivePlan() {
  if (!existsSync(ARCHIVE_PLAN_PATH)) return { entries: [] };
  return JSON.parse(readFileSync(ARCHIVE_PLAN_PATH, 'utf8'));
}

/** The set of uuids named by every archived ARTICLE entry in the plan (parsed from the entry's
 * own `key`, e.g. `articles/<uuid>.html` — the plan's own contract, not re-derived from a fact). */
function archivedArticleUuids(plan) {
  const uuids = new Set();
  for (const entry of plan.entries) {
    if (entry.kind !== 'article') continue;
    const match = ARCHIVED_ARTICLE_KEY_RE.exec(entry.key);
    if (match) uuids.add(match[1].toLowerCase());
  }
  return uuids;
}

/** The set of canonical paths named by every archived ARTICLE entry in the plan — used by the
 * "every fact path maps to an existing page" cross-check's archived branch. */
function archivedArticlePaths(plan) {
  return new Set(plan.entries.filter((e) => e.kind === 'article').map((e) => e.path));
}

test(
  'tier-facts: one article fact per built article html file (static dist/client + archived dist/archive-plan.json entries combined)',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const { articles } = readTierFacts();
    const staticFiles = findArticleHtmlFiles(DIST_CLIENT);
    const plan = loadArchivePlan();
    const archivedCount = plan.entries.filter((e) => e.kind === 'article').length;
    assert.equal(
      articles.length,
      staticFiles.length + archivedCount,
      'expected one article fact per built article html file, whether it stayed static or was archived'
    );

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
  'tier-facts: node tools/tier-report.mjs --json exits 0, classifies tags.hot as the count with count >= 10, and reports hotWindow.provisional matching the window currently committed to hot-window.json',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const out = execFileSync('node', ['tools/tier-report.mjs', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' });
    const report = JSON.parse(out);

    const { tags } = readTierFacts();
    const expectedHot = tags.filter((t) => t.count >= 10).length;

    assert.equal(report.tags.hot, expectedHot);
    // 05-01 pinned this to `true` (the D-07 bootstrap in effect at the time). 05-05 replaced the
    // bootstrap with a real traffic-derived window (D-07b), so the live committed file's own
    // `provisional` flag is now the source of truth, not a hardcoded expectation — this test
    // follows whichever window is actually committed rather than re-pinning a transient state.
    const committed = JSON.parse(readFileSync(path.join(REPO_ROOT, 'src/lib/archive/hot-window.json'), 'utf8'));
    assert.equal(report.hotWindow.provisional, committed.provisional);
  }
);

// ---------------------------------------------------------------------------
// Task 3: cross-checks against the real build — facts provably match the built pages.
// ---------------------------------------------------------------------------

test(
  'tier-facts: every article fact path maps to an existing dist/client<path>.html file, or to the archived file named by dist/archive-plan.json for that path',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const { articles } = readTierFacts();
    const plan = loadArchivePlan();
    const archivedPaths = archivedArticlePaths(plan);

    for (const fact of articles) {
      const htmlPath = path.join(DIST_CLIENT, `${fact.path}.html`);
      const isStatic = existsSync(htmlPath);
      const isArchived = archivedPaths.has(fact.path);
      assert.ok(
        isStatic || isArchived,
        `expected ${fact.path} to map to an existing static file (${htmlPath}) or an archive-plan entry`
      );
    }
  }
);

test(
  'tier-facts: the set of fact uuids equals the set of uuids parsed from built article file names (static dist/client union archived dist/archive-plan.json entries)',
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
    const plan = loadArchivePlan();
    for (const uuid of archivedArticleUuids(plan)) builtUuids.add(uuid);

    assert.equal(factUuids.size, builtUuids.size, 'expected the same number of unique uuids on both sides');
    for (const uuid of factUuids) {
      assert.ok(builtUuids.has(uuid), `fact uuid ${uuid} has no matching built or archived article file`);
    }
    for (const uuid of builtUuids) {
      assert.ok(factUuids.has(uuid), `built/archived article file uuid ${uuid} has no matching fact`);
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
