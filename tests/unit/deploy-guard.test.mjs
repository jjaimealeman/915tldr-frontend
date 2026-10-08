// Post-phase-06 closeout, task B: the T-04-48 stale-deploy guard compares CONTENT, not ancestry.
// Real repo shape that broke the old guard: the deployed commit (`/version.json`) is a merge commit
// on `develop`/`main` that local HEAD (a feature branch) neither descends from nor is an ancestor
// of, even though the guarded paths are byte-identical. Every scenario below runs against a
// throwaway temp git repository (no network, no touching this checkout's history).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evaluateDeployGuard } from '../helpers/deploy-guard.mjs';

const GUARDED = ['src', 'tools', 'package.json'];
let repo;

function git(...args) {
  return execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function write(rel, text) {
  mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  writeFileSync(path.join(repo, rel), text);
}
function commit(msg) {
  git('add', '-A');
  git('commit', '-q', '-m', msg);
  return git('rev-parse', 'HEAD');
}

const shas = {};

before(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'deploy-guard-'));
  git('init', '-q', '-b', 'develop');
  write('src/a.txt', 'one');
  write('package.json', '{}');
  shas.base = commit('base');

  // develop side: a docs-only commit, then a feature branch off base with its own docs commit,
  // then a MERGE of the feature into develop — the merge is the "deployed" commit.
  git('checkout', '-q', '-b', 'feature');
  write('docs/x.md', 'feature docs');
  shas.featureDocs = commit('feature docs');
  git('checkout', '-q', 'develop');
  write('docs/y.md', 'develop docs');
  shas.developDocs = commit('develop docs');
  git('merge', '-q', '--no-ff', '-m', 'merge feature', 'feature');
  shas.merge = git('rev-parse', 'HEAD');

  // A second feature line off the ORIGINAL base: neither ancestor nor descendant of `merge`.
  git('checkout', '-q', '-b', 'closeout', shas.base);
  write('docs/z.md', 'closeout docs');
  shas.closeoutDocs = commit('closeout docs');

  // A branch that changes a guarded path.
  git('checkout', '-q', '-b', 'srcchange', shas.base);
  write('src/a.txt', 'two');
  shas.srcChange = commit('src change');
});

after(() => rmSync(repo, { recursive: true, force: true }));

const run = (reported, localHead) =>
  evaluateDeployGuard({ reportedCommit: reported, localHead, guardedPaths: GUARDED, cwd: repo });

test('deploy-guard: the real failing shape — merge commit vs a sibling line, neither an ancestor of the other, zero guarded diff -> trusted', () => {
  const ancestorEitherWay = (() => {
    for (const [a, b] of [[shas.merge, shas.closeoutDocs], [shas.closeoutDocs, shas.merge]]) {
      try { git('merge-base', '--is-ancestor', a, b); return true; } catch { /* not an ancestor */ }
    }
    return false;
  })();
  assert.equal(ancestorEitherWay, false, 'fixture must reproduce the no-ancestry shape');
  const r = run(shas.merge, shas.closeoutDocs);
  assert.equal(r.status, 'trusted', r.message);
  assert.match(r.message, /zero diff/i);
});

test('deploy-guard: an exact match (full or short hash) is trusted', () => {
  assert.equal(run(shas.merge, shas.merge).status, 'trusted');
  assert.equal(run(shas.merge.slice(0, 7), shas.merge).status, 'trusted');
});

test('deploy-guard: related commits with zero guarded diff are trusted', () => {
  assert.equal(run(shas.base, shas.featureDocs).status, 'trusted');
});

test('deploy-guard: a diff under a guarded path fails and names the file', () => {
  const r = run(shas.merge, shas.srcChange);
  assert.equal(r.status, 'fail');
  assert.match(r.message, /src\/a\.txt/);
});

test('deploy-guard: a deployed commit that is not present locally fails with an actionable message (never a silent pass)', () => {
  const r = run('deadbeefdeadbeef', shas.merge);
  assert.equal(r.status, 'fail');
  assert.match(r.message, /not present/i);
  assert.match(r.message, /git fetch/);
});

test('deploy-guard: commit "main" (cron build, unknown commit) is reported as unknown with a visible reason — not trusted, not a failure', () => {
  const r = run('main', shas.merge);
  assert.equal(r.status, 'unknown');
  assert.match(r.message, /"main"/);
  assert.match(r.message, /unknown commit/i);
});

test('deploy-guard: any other non-hex ref is also unknown, and a missing/empty commit field fails', () => {
  assert.equal(run('refs/heads/develop', shas.merge).status, 'unknown');
  assert.equal(run('', shas.merge).status, 'fail');
  assert.equal(run(undefined, shas.merge).status, 'fail');
});
