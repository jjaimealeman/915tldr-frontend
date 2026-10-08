// Post-phase-06 closeout, task B: the T-04-48 stale-deploy guard, as a pure function over git.
//
// It compares CONTENT, not history. The previous guard required the deployed commit and local HEAD
// to be ancestors of one another; once `/version.json` started reporting a MERGE commit (develop /
// main) while local HEAD sits on a feature branch, neither is an ancestor of the other even though
// every guarded path is byte-identical — a false failure. What T-04-48 protects is "the live site
// runs the code these tests were written against", and that is exactly "no diff over the guarded
// paths between the two trees".
//
// Outcomes (never a silent pass):
//   trusted — equal, or zero guarded diff.
//   fail    — empty/invalid commit field; commit not present locally (message says how to fix it);
//             or a guarded-path diff (files named).
//   unknown — `/version.json` carries a non-hex ref (Cloudflare Workers Builds reports the literal
//             branch name, e.g. "main", for cron-triggered rebuilds). That means "unknown commit":
//             the content cannot be compared, so the caller must surface the reason visibly
//             (node:test `t.skip(message)`), not treat it as trusted.
import { execFileSync } from 'node:child_process';

const HEX_RE = /^[0-9a-f]{4,40}$/i;

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function evaluateDeployGuard({ reportedCommit, localHead, guardedPaths, cwd = process.cwd() }) {
  if (typeof reportedCommit !== 'string' || reportedCommit.trim() === '') {
    return {
      status: 'fail',
      message: `/version.json has no usable "commit" field (${JSON.stringify(reportedCommit)}) — every other check in this file trusts this deploy`,
    };
  }

  if (!HEX_RE.test(reportedCommit)) {
    return {
      status: 'unknown',
      message:
        `/version.json reports commit "${reportedCommit}", which is a ref, not a commit hash (a cron-triggered rebuild). ` +
        `This is an unknown commit: the deployed content cannot be compared with local HEAD, so the stale-deploy guard (T-04-48) is NOT satisfied for this run`,
    };
  }

  let deployed;
  try {
    deployed = git(cwd, ['rev-parse', '--verify', '--quiet', `${reportedCommit}^{commit}`]);
  } catch {
    return {
      status: 'fail',
      message:
        `deployed commit ${reportedCommit} (from /version.json) is not present in this local repository, so the guarded paths cannot be compared. ` +
        `Run \`git fetch\` (or fetch the branch that was deployed, e.g. origin/develop or origin/main) and re-run`,
    };
  }

  if (deployed === localHead) {
    return { status: 'trusted', message: `deployed commit ${deployed} equals local HEAD`, deployed };
  }

  const diff = git(cwd, ['diff', '--name-only', deployed, localHead, '--', ...guardedPaths]);
  if (diff !== '') {
    return {
      status: 'fail',
      message:
        `deployed commit ${deployed} and local HEAD ${localHead} differ under the guarded paths (${guardedPaths.join(', ')}), ` +
        `so the live site may not be running the code these tests were written against:\n${diff}`,
      deployed,
      diff: diff.split('\n'),
    };
  }

  return {
    status: 'trusted',
    message: `deployed commit ${deployed} and local HEAD ${localHead} have zero diff under the guarded paths (${guardedPaths.join(', ')}) — trusting this deploy`,
    deployed,
  };
}
