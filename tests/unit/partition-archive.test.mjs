// 05-06 Task 2: pins partition-archive.mjs's planning math (D-08/REND-09 age+tag-threshold
// classification against a hot window), its path-safety discipline (T-05-22), and its fail-loud
// cases. Temp-directory fixtures throughout (`fs.mkdtempSync` under the OS temp dir, matching
// tests/unit/derive-hot-window.test.mjs's own convention); `root`/`nowEpoch` always passed
// explicitly so no test touches the real dist or clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ARCHIVE_DIR,
  PARTITION_PLAN_PATH,
  planPartition,
  applyPartition,
  cleanPartitionInputs,
  countBuiltSpanishPages,
  assertSpanishFactsMatchBuilt,
} from '../../tools/partition-archive.mjs';

function tempRoot() {
  return mkdtempSync(path.join(tmpdir(), 'partition-archive-test-'));
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// A fixed "now" — 2026-10-01T00:00:00Z, UTC-day-floored already (matches hotCutoffEpoch's own
// flooring, so the fixture ages below land exactly where each test expects).
const NOW_EPOCH = Math.floor(new Date('2026-10-01T00:00:00Z').getTime() / 1000);
const SECONDS_PER_DAY = 86_400;
const FALLBACK_HOT_WINDOW = { status: 'fallback-provisional', provisional: true, days: 90, basis: 'age', decision: 'D-07' };

// ---------------------------------------------------------------------------
// planPartition: D-08/age-cutoff classification
// ---------------------------------------------------------------------------

test('planPartition: an article published exactly at the cutoff is hot, one second older is archive', () => {
  const cutoffEpoch = NOW_EPOCH - 90 * SECONDS_PER_DAY;
  const articleFacts = [
    { uuid: '11111111-1111-1111-1111-111111111111', path: '/crime/at-cutoff-11111111-1111-1111-1111-111111111111', publishedAt: cutoffEpoch },
    { uuid: '22222222-2222-2222-2222-222222222222', path: '/crime/one-second-older-22222222-2222-2222-2222-222222222222', publishedAt: cutoffEpoch - 1 },
  ];
  const plan = planPartition({ articleFacts, tagFacts: [], hotWindow: FALLBACK_HOT_WINDOW, nowEpoch: NOW_EPOCH });

  assert.equal(plan.counts.hotArticles, 1);
  assert.equal(plan.counts.archivedArticles, 1);
  const archived = plan.entries.filter((e) => e.kind === 'article');
  assert.equal(archived.length, 1);
  assert.equal(archived[0].key, 'articles/22222222-2222-2222-2222-222222222222.html');
});

test('planPartition: a 9-article tag is archive, a 10-article tag is hot (D-08 inclusive at 10)', () => {
  const tagFacts = [
    { slug: 'nine-articles', count: 9 },
    { slug: 'ten-articles', count: 10 },
  ];
  const plan = planPartition({ articleFacts: [], tagFacts, hotWindow: FALLBACK_HOT_WINDOW, nowEpoch: NOW_EPOCH });

  assert.equal(plan.counts.hotTags, 1);
  assert.equal(plan.counts.archivedTags, 1);
  const archivedTag = plan.entries.find((e) => e.kind === 'tag');
  assert.equal(archivedTag.key, 'tags/nine-articles.html');
});

test('planPartition: builds the article key/path/sourceRel and tag key/path/sourceRel shapes', () => {
  const articleFacts = [
    { uuid: '33333333-3333-3333-3333-333333333333', path: '/crime/old-story-33333333-3333-3333-3333-333333333333', publishedAt: 0 },
  ];
  const tagFacts = [{ slug: 'thin-tag', count: 1 }];
  const plan = planPartition({ articleFacts, tagFacts, hotWindow: FALLBACK_HOT_WINDOW, nowEpoch: NOW_EPOCH });

  const articleEntry = plan.entries.find((e) => e.kind === 'article');
  assert.equal(articleEntry.key, 'articles/33333333-3333-3333-3333-333333333333.html');
  assert.equal(articleEntry.path, '/crime/old-story-33333333-3333-3333-3333-333333333333');
  assert.equal(articleEntry.sourceRel, 'dist/client/crime/old-story-33333333-3333-3333-3333-333333333333.html');

  const tagEntry = plan.entries.find((e) => e.kind === 'tag');
  assert.equal(tagEntry.key, 'tags/thin-tag.html');
  assert.equal(tagEntry.path, '/tag/thin-tag');
  assert.equal(tagEntry.sourceRel, 'dist/client/tag/thin-tag.html');
});

// ---------------------------------------------------------------------------
// planPartition: 06-04 Spanish entries (articleFactsEs/tagFactsEs)
// ---------------------------------------------------------------------------

test('planPartition: Spanish facts yield es/articles and es/tags entries alongside English ones, with Es counts', () => {
  const cutoffEpoch = NOW_EPOCH - 90 * SECONDS_PER_DAY;
  const articleFacts = [
    { uuid: '44444444-4444-4444-4444-444444444444', path: '/crime/old-story-44444444-4444-4444-4444-444444444444', publishedAt: cutoffEpoch - 1 },
  ];
  const articleFactsEs = [
    {
      uuid: '44444444-4444-4444-4444-444444444444',
      path: '/es/crime/old-story-44444444-4444-4444-4444-444444444444',
      publishedAt: cutoffEpoch - 1,
      translated: true,
    },
  ];
  const tagFacts = [{ slug: 'thin-tag', count: 3 }];
  const tagFactsEs = [{ slug: 'thin-tag', count: 3 }];

  const plan = planPartition({
    articleFacts,
    tagFacts,
    articleFactsEs,
    tagFactsEs,
    hotWindow: FALLBACK_HOT_WINDOW,
    nowEpoch: NOW_EPOCH,
  });

  assert.deepEqual(plan.counts, {
    hotArticles: 0,
    archivedArticles: 1,
    hotTags: 0,
    archivedTags: 1,
    hotArticlesEs: 0,
    archivedArticlesEs: 1,
    hotTagsEs: 0,
    archivedTagsEs: 1,
  });

  const keys = plan.entries.map((e) => e.key).sort();
  assert.deepEqual(keys, [
    'articles/44444444-4444-4444-4444-444444444444.html',
    'es/articles/44444444-4444-4444-4444-444444444444.html',
    'es/tags/thin-tag.html',
    'tags/thin-tag.html',
  ]);

  const esArticle = plan.entries.find((e) => e.key === 'es/articles/44444444-4444-4444-4444-444444444444.html');
  assert.equal(esArticle.path, '/es/crime/old-story-44444444-4444-4444-4444-444444444444');
  assert.equal(esArticle.sourceRel, 'dist/client/es/crime/old-story-44444444-4444-4444-4444-444444444444.html');

  const esTag = plan.entries.find((e) => e.key === 'es/tags/thin-tag.html');
  assert.equal(esTag.path, '/es/tag/thin-tag');
  assert.equal(esTag.sourceRel, 'dist/client/es/tag/thin-tag.html');
});

test('planPartition: articleFactsEs/tagFactsEs default to [] — no Spanish entries, Es counts all zero', () => {
  const plan = planPartition({
    articleFacts: [],
    tagFacts: [],
    hotWindow: FALLBACK_HOT_WINDOW,
    nowEpoch: NOW_EPOCH,
  });
  assert.deepEqual(plan.entries, []);
  assert.equal(plan.counts.hotArticlesEs, 0);
  assert.equal(plan.counts.archivedArticlesEs, 0);
  assert.equal(plan.counts.hotTagsEs, 0);
  assert.equal(plan.counts.archivedTagsEs, 0);
});

test('planPartition: throws on a malformed hotWindow (no numeric days)', () => {
  assert.throws(
    () => planPartition({ articleFacts: [], tagFacts: [], hotWindow: { status: 'derived' }, nowEpoch: NOW_EPOCH }),
    /partition-archive:/
  );
});

// ---------------------------------------------------------------------------
// applyPartition: real moves, hashing, fail-loud cases, path-safety
// ---------------------------------------------------------------------------

function seedDistClient(root, files) {
  const distClient = path.join(root, 'dist', 'client');
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(distClient, relPath);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return distClient;
}

test('applyPartition: moves files byte-identically (sha256 before == after), writes a matching plan, leaves hot files in place', () => {
  const root = tempRoot();
  try {
    const archivedContent = '<html>archived article</html>';
    const hotContent = '<html>hot article</html>';
    seedDistClient(root, {
      'crime/archived-11111111-1111-1111-1111-111111111111.html': archivedContent,
      'crime/hot-22222222-2222-2222-2222-222222222222.html': hotContent,
    });
    const beforeHash = sha256(Buffer.from(archivedContent));

    const plan = {
      version: 1,
      generatedAt: new Date().toISOString(),
      hotWindow: FALLBACK_HOT_WINDOW,
      cutoffEpoch: NOW_EPOCH,
      counts: { hotArticles: 1, archivedArticles: 1, hotTags: 0, archivedTags: 0 },
      entries: [
        {
          kind: 'article',
          key: 'articles/11111111-1111-1111-1111-111111111111.html',
          path: '/crime/archived-11111111-1111-1111-1111-111111111111',
          sourceRel: 'dist/client/crime/archived-11111111-1111-1111-1111-111111111111.html',
        },
      ],
    };

    const finalized = applyPartition(plan, { root });

    // Moved: source gone, dest exists, byte-identical.
    const sourceAbs = path.join(root, 'dist/client/crime/archived-11111111-1111-1111-1111-111111111111.html');
    const destAbs = path.join(root, ARCHIVE_DIR, 'articles/11111111-1111-1111-1111-111111111111.html');
    assert.ok(!existsSync(sourceAbs), 'expected the source file to be moved away');
    assert.ok(existsSync(destAbs), 'expected the destination file to exist');
    const afterHash = sha256(readFileSync(destAbs));
    assert.equal(afterHash, beforeHash, 'expected the moved file to be byte-identical');

    // Hot file untouched.
    const hotAbs = path.join(root, 'dist/client/crime/hot-22222222-2222-2222-2222-222222222222.html');
    assert.ok(existsSync(hotAbs), 'expected the hot file to stay in place');

    // Plan written to disk matches the finalized entries (sha256/bytes added).
    const planOnDisk = JSON.parse(readFileSync(path.join(root, PARTITION_PLAN_PATH), 'utf8'));
    assert.equal(planOnDisk.entries.length, 1);
    assert.equal(planOnDisk.entries[0].sha256, beforeHash);
    assert.equal(planOnDisk.entries[0].bytes, Buffer.byteLength(archivedContent));
    assert.deepEqual(planOnDisk.entries, finalized.entries);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('applyPartition: throws "partition-archive:" when a planned source file is missing', () => {
  const root = tempRoot();
  try {
    seedDistClient(root, {});
    const plan = {
      entries: [
        {
          kind: 'article',
          key: 'articles/missing.html',
          path: '/crime/missing',
          sourceRel: 'dist/client/crime/missing.html',
        },
      ],
    };
    assert.throws(() => applyPartition(plan, { root }), /partition-archive:.*missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('applyPartition: throws "partition-archive:" when a fact path would resolve outside dist/client (path traversal)', () => {
  const root = tempRoot();
  try {
    seedDistClient(root, {});
    // Create a real file outside dist/client that a traversal would otherwise reach.
    writeFileSync(path.join(root, 'secret.html'), 'should never be touched');
    const plan = {
      entries: [
        {
          kind: 'article',
          key: 'articles/traversal.html',
          path: '/crime/traversal',
          sourceRel: '../secret.html',
        },
      ],
    };
    assert.throws(() => applyPartition(plan, { root }), /partition-archive:.*escapes/);
    assert.ok(existsSync(path.join(root, 'secret.html')), 'expected the escaped file to be untouched');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('applyPartition: moves a Spanish entry (es/ key) byte-identically into dist/archive/es/...', () => {
  const root = tempRoot();
  try {
    const content = '<html>archived Spanish article</html>';
    seedDistClient(root, {
      'es/crime/x-44444444-4444-4444-4444-444444444444.html': content,
    });
    const beforeHash = sha256(Buffer.from(content));

    const plan = {
      entries: [
        {
          kind: 'article',
          key: 'es/articles/44444444-4444-4444-4444-444444444444.html',
          path: '/es/crime/x-44444444-4444-4444-4444-444444444444',
          sourceRel: 'dist/client/es/crime/x-44444444-4444-4444-4444-444444444444.html',
        },
      ],
    };

    const finalized = applyPartition(plan, { root });

    const destAbs = path.join(root, ARCHIVE_DIR, 'es/articles/44444444-4444-4444-4444-444444444444.html');
    assert.ok(existsSync(destAbs), 'expected the Spanish archive destination to exist');
    assert.equal(sha256(readFileSync(destAbs)), beforeHash);
    assert.equal(finalized.entries[0].sha256, beforeHash);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('applyPartition: throws when a planned destination key would resolve outside dist/archive', () => {
  const root = tempRoot();
  try {
    seedDistClient(root, { 'crime/a.html': 'x' });
    const plan = {
      entries: [
        {
          kind: 'article',
          key: '../escape.html',
          path: '/crime/a',
          sourceRel: 'dist/client/crime/a.html',
        },
      ],
    };
    assert.throws(() => applyPartition(plan, { root }), /partition-archive:.*escapes/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// cleanPartitionInputs
// ---------------------------------------------------------------------------

test('cleanPartitionInputs: removes stale facts, dist/archive and the plan', () => {
  const root = tempRoot();
  try {
    mkdirSync(path.join(root, '.astro'), { recursive: true });
    writeFileSync(path.join(root, '.astro/tier-facts-articles.json'), '{}');
    writeFileSync(path.join(root, '.astro/tier-facts-tags.json'), '{}');
    mkdirSync(path.join(root, ARCHIVE_DIR, 'articles'), { recursive: true });
    writeFileSync(path.join(root, ARCHIVE_DIR, 'articles/stale.html'), 'stale');
    writeFileSync(path.join(root, PARTITION_PLAN_PATH), '{}');

    cleanPartitionInputs(root);

    assert.ok(!existsSync(path.join(root, '.astro/tier-facts-articles.json')));
    assert.ok(!existsSync(path.join(root, '.astro/tier-facts-tags.json')));
    assert.ok(!existsSync(path.join(root, ARCHIVE_DIR)));
    assert.ok(!existsSync(path.join(root, PARTITION_PLAN_PATH)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('cleanPartitionInputs: is a no-op when stale facts/archive/plan are all absent', () => {
  const root = tempRoot();
  try {
    assert.doesNotThrow(() => cleanPartitionInputs(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// countBuiltSpanishPages / assertSpanishFactsMatchBuilt (06-04)
// ---------------------------------------------------------------------------

test('countBuiltSpanishPages: returns {articles:0, tags:0} when dist/client/es does not exist (no-op before 06-09/06-10)', () => {
  const root = tempRoot();
  try {
    assert.deepEqual(countBuiltSpanishPages(root), { articles: 0, tags: 0 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('countBuiltSpanishPages: counts article html files under dist/client/es/<category>/ and tag html files under dist/client/es/tag/', () => {
  const root = tempRoot();
  try {
    seedDistClient(root, {
      'es/crime/a-11111111-1111-1111-1111-111111111111.html': 'x',
      'es/crime/b-22222222-2222-2222-2222-222222222222.html': 'x',
      'es/sports/c-33333333-3333-3333-3333-333333333333.html': 'x',
      'es/tag/el-paso.html': 'x',
    });
    assert.deepEqual(countBuiltSpanishPages(root), { articles: 3, tags: 1 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('assertSpanishFactsMatchBuilt: throws "partition-archive:" when built /es article pages do not match Spanish tier facts', () => {
  assert.throws(
    () => assertSpanishFactsMatchBuilt({ articles: 3, tags: 0 }, 2, 0),
    /partition-archive: built \/es article pages \(3\) do not match Spanish tier facts \(2\)/
  );
});

test('assertSpanishFactsMatchBuilt: throws "partition-archive:" when built /es tag pages do not match Spanish tier facts', () => {
  assert.throws(
    () => assertSpanishFactsMatchBuilt({ articles: 0, tags: 2 }, 0, 1),
    /partition-archive: built \/es tag pages \(2\) do not match Spanish tier facts \(1\)/
  );
});

test('assertSpanishFactsMatchBuilt: does not throw when counts match, including the zero/zero no-op case', () => {
  assert.doesNotThrow(() => assertSpanishFactsMatchBuilt({ articles: 0, tags: 0 }, 0, 0));
  assert.doesNotThrow(() => assertSpanishFactsMatchBuilt({ articles: 2, tags: 1 }, 2, 1));
});
