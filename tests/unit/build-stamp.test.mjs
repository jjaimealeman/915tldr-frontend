// OPS-05 / OPS-06 / T-03-07: proves `/version.json` and the public footer report the same build
// identity, and that the git-fallback resolution order refuses to fire inside CI. Follows the
// `node:test` + `assert/strict` structure this repo uses (design/tests/unit/check-contrast.test.mjs,
// tests/ci-fixtures/assert-no-d1.test.mjs) — no Jest, no Vitest.
//
// Two shapes of case here:
//   1. `resolveBuildHash(env)` / `resolveCommitDate(env, run)` unit cases — call the exported pure
//      functions directly with a synthetic env object (and, for `resolveCommitDate`, a stubbed
//      `run` in place of `execSync` — 04-02). No build required.
//   2. Cross-surface cases — read the REAL `dist/client/version.json` and a REAL built article
//      `index.html`, not the source module twice. A test that re-read `src/lib/build-info.ts`
//      for "both" surfaces would pass even if the footer rendered nothing at all; reading the
//      two *emitted artifacts* is the only way to prove they actually agree (T-03-09's mitigation).
//      These cases skip with an explicit, named reason if `dist/` has not been built — never a
//      silent pass. `pnpm test:unit` runs `pnpm build` first (package.json) so this skip path is
//      not the normal one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { resolveBuildHash, resolveCommitDate, BUILD_TIMESTAMP, BUILD_HASH } from '../../src/lib/build-info.ts';
import { CATEGORIES } from '../../src/lib/categories.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const VERSION_JSON = path.join(DIST_CLIENT, 'version.json');
const HOME_HTML = path.join(DIST_CLIENT, 'index.html');
const DIST_BUILT = existsSync(VERSION_JSON);
const SKIP_REASON = 'dist/client/version.json not found — run `pnpm build` first (pnpm test:unit does this automatically)';

/** One built category index page (top-level `<slug>.html`, `build.format: 'file'`) — used only
 * to prove the footer stamp is absent there. Any category works; the first in CATEGORIES order
 * is arbitrary, not special. */
function findCategoryHtmlFile() {
  const file = path.join(DIST_CLIENT, `${CATEGORIES[0].slug}.html`);
  assert.ok(existsSync(file), `expected a built category page at ${file}`);
  return file;
}

/** One built tag page (`dist/client/tag/<slug>.html`) — used only to prove the footer stamp is
 * absent there. Picks the first tag file found; which one is arbitrary. */
function findTagHtmlFile() {
  const tagDir = path.join(DIST_CLIENT, 'tag');
  const files = existsSync(tagDir) ? readdirSync(tagDir).filter((f) => f.endsWith('.html')) : [];
  assert.ok(files.length > 0, `expected at least one built tag page under ${tagDir}`);
  return path.join(tagDir, files[0]);
}

/** Finds every built article page under `dist/client`. Updated 04-01 (Rule 1 — this test's
 * original walk looked for `index.html`, the `build.format: 'directory'` shape from before
 * `astro.config.mjs` set `build.format: 'file'`; that shape no longer exists, so this test was
 * failing with an out-of-bounds array read before this fix). Article pages now emit
 * `<slug>-<uuid>.html` one directory below `dist/client` — same shape and same regex
 * `tests/tracer/tracer.test.mjs` uses, which deliberately excludes non-article top-level output
 * (`_astro/`, `fonts/`, `version.json`, `wrangler.json`, `_headers`). */
const ARTICLE_FILE_RE =
  /^(.+)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;

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

// --- resolveBuildHash(env) unit cases — pure function, no build required ------------------

test('resolveBuildHash: WORKERS_CI_COMMIT_SHA present resolves to workers-ci with a 7-char hash', () => {
  const result = resolveBuildHash({ WORKERS_CI_COMMIT_SHA: 'abcdef1234567890' });
  assert.equal(result.source, 'workers-ci');
  assert.equal(result.hash, 'abcdef1');
});

test('resolveBuildHash: WORKERS_CI_COMMIT_SHA absent, CI present resolves to unknown — the shallow-checkout git fallback is refused', () => {
  const result = resolveBuildHash({ CI: 'true' });
  assert.equal(result.source, 'unknown');
  assert.equal(result.hash, 'unknown');
});

test('resolveBuildHash: WORKERS_CI_COMMIT_SHA absent, WORKERS_CI present (no CI var) also refuses the git fallback', () => {
  const result = resolveBuildHash({ WORKERS_CI: '1' });
  assert.equal(result.source, 'unknown');
  assert.equal(result.hash, 'unknown');
});

test('resolveBuildHash: no CI markers, no WORKERS_CI_COMMIT_SHA resolves to local-git with a valid 7-char hex hash', () => {
  const result = resolveBuildHash({});
  assert.equal(result.source, 'local-git');
  assert.match(result.hash, /^[0-9a-f]{7}$/i);
});

test('BUILD_TIMESTAMP is a valid, round-trippable ISO 8601 timestamp', () => {
  assert.match(BUILD_TIMESTAMP, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(BUILD_TIMESTAMP).toISOString(), BUILD_TIMESTAMP);
});

// --- resolveCommitDate(env, run) unit cases (04-02 / OPS-06) -------------------------------

test('resolveCommitDate: WORKERS_CI_COMMIT_SHA present shells out to `git show` for that sha', () => {
  let capturedCommand;
  const fakeRun = (cmd) => {
    capturedCommand = cmd;
    return '2026-09-16\n';
  };
  const result = resolveCommitDate({ WORKERS_CI_COMMIT_SHA: 'abcdef1234567890' }, fakeRun);
  assert.equal(result, '2026-09-16');
  assert.match(capturedCommand, /git show -s --format=%cs abcdef1234567890/);
});

test('resolveCommitDate: WORKERS_CI_COMMIT_SHA absent, CI present resolves to unknown (no git fallback)', () => {
  const fakeRun = () => {
    throw new Error('should never be called');
  };
  const result = resolveCommitDate({ CI: 'true' }, fakeRun);
  assert.equal(result, 'unknown');
});

test('resolveCommitDate: WORKERS_CI_COMMIT_SHA absent, WORKERS_CI present also refuses the git fallback', () => {
  const fakeRun = () => {
    throw new Error('should never be called');
  };
  const result = resolveCommitDate({ WORKERS_CI: '1' }, fakeRun);
  assert.equal(result, 'unknown');
});

test('resolveCommitDate: no CI markers, no sha — shells out to `git show` for HEAD', () => {
  let capturedCommand;
  const fakeRun = (cmd) => {
    capturedCommand = cmd;
    return '2026-09-26\n';
  };
  const result = resolveCommitDate({}, fakeRun);
  assert.equal(result, '2026-09-26');
  assert.match(capturedCommand, /git show -s --format=%cs HEAD/);
});

test('resolveCommitDate: garbage git output resolves to unknown, never a malformed date', () => {
  const fakeRun = () => 'not-a-date\n';
  assert.equal(resolveCommitDate({}, fakeRun), 'unknown');
});

test('resolveCommitDate: a WORKERS_CI_COMMIT_SHA that fails the hex-shape check resolves to unknown without shelling out', () => {
  const fakeRun = () => {
    throw new Error('should never be called');
  };
  const result = resolveCommitDate({ WORKERS_CI_COMMIT_SHA: '; rm -rf /' }, fakeRun);
  assert.equal(result, 'unknown');
});

test('resolveCommitDate: a real git invocation against this repo returns a YYYY-MM-DD string', () => {
  const result = resolveCommitDate({});
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});

// --- Cross-surface cases — real emitted artifacts, not the source module twice ------------

test(
  // 04-11a: the footer commit-hash stamp is now opt-in (Base.astro's `buildStamp` prop) and only
  // the homepage passes it — see docs/phase-04/build-measurements.md's "near-total asset
  // re-upload" finding. This case moved from asserting against an article page (pre-04-11a) to
  // the homepage, the one page that still carries the stamp.
  'cross-surface: dist/client/version.json and the built homepage report the exact same commit hash',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const version = JSON.parse(readFileSync(VERSION_JSON, 'utf8'));
    assert.ok(version.commit, 'version.json must have a commit field');
    assert.ok(existsSync(HOME_HTML), `expected a built homepage at ${HOME_HTML}`);
    const html = readFileSync(HOME_HTML, 'utf8');
    assert.ok(
      html.includes(version.commit),
      `built homepage HTML should contain the exact commit string "${version.commit}" that dist/client/version.json reports`
    );
  }
);

test(
  // 04-11a: the homepage renders the DEFAULT stamp mode (`stamp="build"`, not `"commit"` — it
  // passes no `stamp` prop) since it always regenerates in full every build; its footer date is
  // therefore `BUILD_TIMESTAMP`'s own date, matching version.json's `builtAt`, not `committedAt`.
  "cross-surface: the homepage carries data-stamp=\"build\" and its footer date matches version.json's builtAt",
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const version = JSON.parse(readFileSync(VERSION_JSON, 'utf8'));
    const html = readFileSync(HOME_HTML, 'utf8');
    assert.match(
      html,
      /<p data-build data-stamp="build">/,
      'the homepage should render data-stamp="build" (Base.astro\'s default), not "commit"'
    );
    const builtAtDate = version.builtAt.slice(0, 10);
    assert.ok(
      html.includes(`· ${builtAtDate}`),
      `homepage footer should render the date "${builtAtDate}" derived from version.json's builtAt`
    );
  }
);

test(
  'cross-surface: dist/client/version.json carries a committedAt field shaped YYYY-MM-DD',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const version = JSON.parse(readFileSync(VERSION_JSON, 'utf8'));
    assert.match(
      version.committedAt,
      /^(\d{4}-\d{2}-\d{2}|unknown)$/,
      'committedAt must be a YYYY-MM-DD date or the honest "unknown" fallback'
    );
  }
);

test(
  'cross-surface: exactly one data-build element exists in the built homepage',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const html = readFileSync(HOME_HTML, 'utf8');
    const matches = html.match(/data-build/g) ?? [];
    assert.equal(
      matches.length,
      1,
      'expected exactly one data-build occurrence — a duplicated footer would let the two instances diverge independently'
    );
  }
);

test(
  // 04-11a: proves the fix, not just the homepage's new behavior — an article, a category index,
  // and a tag page must ALL omit the footer stamp so their rendered bytes stay independent of
  // BUILD_HASH across commits (the whole point of the fix — see docs/phase-04/
  // build-measurements.md's "near-total asset re-upload" finding).
  'cross-surface: article, category, and tag pages carry NO data-build element (04-11a)',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const articleFiles = findArticleHtmlFiles(DIST_CLIENT);
    assert.ok(articleFiles.length > 0, 'expected at least one built article HTML file');
    const articleHtml = readFileSync(articleFiles[0], 'utf8');
    assert.doesNotMatch(articleHtml, /data-build/, `article page ${articleFiles[0]} must not carry a data-build element`);

    const categoryFile = findCategoryHtmlFile();
    const categoryHtml = readFileSync(categoryFile, 'utf8');
    assert.doesNotMatch(categoryHtml, /data-build/, `category page ${categoryFile} must not carry a data-build element`);

    const tagFile = findTagHtmlFile();
    const tagHtml = readFileSync(tagFile, 'utf8');
    assert.doesNotMatch(tagHtml, /data-build/, `tag page ${tagFile} must not carry a data-build element`);
  }
);

test(
  // 04-11a's actual claim under test: an article page's rendered bytes are independent of
  // BUILD_HASH — not merely that the footer element is absent (the prior test), but that THIS
  // real build's actual hash string does not leak into the article HTML anywhere at all. Direct
  // proof, no second build needed: if the real, current BUILD_HASH is nowhere in the page, a
  // different BUILD_HASH on the next commit cannot change these bytes either.
  // tests/regression/byte-identity.test.mjs separately proves this end-to-end via two real builds.
  "article page bytes do not vary with BUILD_HASH — this build's real commit hash is absent from a real built article page",
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    assert.notEqual(BUILD_HASH, 'unknown', 'test setup: expected a real resolved BUILD_HASH for this local build');
    const articleFiles = findArticleHtmlFiles(DIST_CLIENT);
    const html = readFileSync(articleFiles[0], 'utf8');
    assert.ok(
      !html.includes(BUILD_HASH),
      `article page ${articleFiles[0]} must not contain this build's commit hash "${BUILD_HASH}" anywhere`
    );
  }
);
