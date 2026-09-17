#!/usr/bin/env node
// D-16: the single approval runner. One command runs the selected criteria
// across the selected pages and engines, and prints a criterion-by-criterion
// verdict table. A run narrowed by --pages/--criteria/--engines is a SCOPED
// run and is explicitly marked as not valid for approval.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { validateFeedPage } from './build-feed.mjs';

const ALL_PAGES = ['index', 'category', 'article', 'changelog', 'contact'];
const ALL_CRITERIA = [1, 2, 3, 4, 5];
const ALL_ENGINES = ['chromium', 'webkit'];
const MOCKUPS_DIR = path.resolve('design/mockups');

// Criterion 2 (D-13 contrast) is a Node-only gate — it has no browser
// component by design (see 01-CONTEXT.md D-13, "generated from the CSS
// tokens, not hand-written"). Engine columns are reported as n/a and do not
// gate its verdict. Every other criterion is expected to carry Playwright
// tags (@c1, @c3, @c4, @c5) once its owning plan lands.
const NODE_ONLY_CRITERIA = new Set([2]);

// DSGN-03 forbidden faces, copied verbatim from .planning/REQUIREMENTS.md.
// These names must never appear anywhere under design/mockups (not even in
// a comment) — this constant is the one place in the repo allowed to name
// them, since design/scripts is outside that exclusion zone.
const FORBIDDEN_FACES = ['Playfair Display', 'Merriweather'];

function parseArgs(argv) {
  const args = { pages: null, criteria: null, engines: null };
  for (const arg of argv) {
    if (arg.startsWith('--pages=')) args.pages = arg.slice('--pages='.length).split(',').filter(Boolean);
    if (arg.startsWith('--criteria=')) args.criteria = arg.slice('--criteria='.length).split(',').map(Number);
    if (arg.startsWith('--engines=')) args.engines = arg.slice('--engines='.length).split(',').filter(Boolean);
  }
  return args;
}

function collectSpecs(suite, acc = []) {
  for (const spec of suite.specs ?? []) {
    acc.push(spec);
  }
  for (const child of suite.suites ?? []) {
    collectSpecs(child, acc);
  }
  return acc;
}

function loadReport(jsonPath) {
  if (!existsSync(jsonPath)) return null;
  const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const specs = [];
  for (const suite of report.suites ?? []) {
    collectSpecs(suite, specs);
  }
  return specs;
}

/**
 * A criterion passes in an engine only if at least one tagged test ran and
 * none failed or skipped.
 */
function criterionVerdictFromSpecs(specs, tag) {
  const matching = specs.filter((spec) => (spec.tags ?? []).includes(tag));
  if (matching.length === 0) return 'FAIL';
  for (const spec of matching) {
    for (const t of spec.tests ?? []) {
      if (t.status !== 'expected') return 'FAIL';
    }
  }
  return 'PASS';
}

function runEngine(engine, criteria, pages) {
  const grepTags = criteria.map((c) => `@c${c}`).join('|');
  // Relative path — this is forwarded as PW_JSON_OUT into the webkit Docker
  // container too, where cwd is /work, not the host project root. An
  // absolute host path would resolve inside the container to a path under
  // /home/... that does not exist there and cannot be created (EACCES).
  const relativeJsonOut = `design/.cache/pw-report-${engine}.json`;
  mkdirSync(path.dirname(path.resolve(relativeJsonOut)), { recursive: true });

  const result = spawnSync(
    'node',
    ['design/scripts/pw.mjs', `--project=${engine}`, 'design/tests', '--grep', grepTags],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        MOCKUP_PAGES: pages.join(','),
        PW_JSON_OUT: relativeJsonOut,
      },
    }
  );

  return { exitCode: result.status ?? 1, specs: loadReport(path.resolve(relativeJsonOut)) ?? [] };
}

// ---- Node-side checks ----

function nodeCheckC1(pages, scoped) {
  const problems = [];

  for (const page of pages) {
    const file = path.join(MOCKUPS_DIR, `${page}.html`);
    if (!existsSync(file)) {
      problems.push(`missing design/mockups/${page}.html`);
    }
  }

  // 'feed': D-05 amendment (01-21) -- the mockups directory gains a static
  // feed/ directory for the homepage load-more pages.
  const allowed = new Set([...ALL_PAGES.map((p) => `${p}.html`), 'style.css', 'fonts', 'feed']);
  if (existsSync(MOCKUPS_DIR)) {
    for (const entry of readdirSync(MOCKUPS_DIR)) {
      if (!allowed.has(entry)) {
        problems.push(`unexpected entry in design/mockups: ${entry}`);
      }
    }
  }

  if (!scoped) {
    for (const name of allowed) {
      if (!existsSync(path.join(MOCKUPS_DIR, name))) {
        problems.push(`missing required design/mockups entry: ${name}`);
      }
    }
  }

  // Filesystem walk (skipping node_modules and .git) for stray .astro files.
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.astro')) {
        problems.push(`found forbidden .astro file: ${full}`);
      }
    }
  }
  walk(path.resolve('.'));

  nodeCheckFeed(problems);

  return { pass: problems.length === 0, problems };
}

/**
 * In-place extraction of every `<article ...>` tag's (data-uuid, data-stress)
 * pair, in document order, from an HTML slice.
 */
function extractCardIdentities(htmlSlice) {
  const identities = [];
  const articleTagRe = /<article\s+([^>]*)>/g;
  let match;
  while ((match = articleTagRe.exec(htmlSlice))) {
    const attrs = match[1];
    const uuidMatch = attrs.match(/data-uuid="([^"]*)"/);
    const stressMatch = attrs.match(/data-stress="([^"]*)"/);
    identities.push({ uuid: uuidMatch ? uuidMatch[1] : null, stress: stressMatch ? stressMatch[1] : null });
  }
  return identities;
}

/**
 * 01-21 D-05 amendment: when design/mockups/feed exists, validates every
 * page file's schema/shape (validateFeedPage, imported from build-feed.mjs),
 * that the chain starting at index.html's load-more `data-next` visits every
 * file exactly once and ends at null, that the cards between index.html's
 * feed markers plus every feed page's cards equal home-feed.json's cards in
 * order (compared by uuid/stress), and that the shared head script contains
 * exactly one `fetch(` call. Pushes problem strings onto `problems` in place.
 */
function nodeCheckFeed(problems) {
  const FEED_DIR = path.join(MOCKUPS_DIR, 'feed');
  if (!existsSync(FEED_DIR)) return;

  const pageRe = /^page-(\d+)\.json$/;
  const pagesByNumber = new Map();

  for (const entry of readdirSync(FEED_DIR)) {
    const m = entry.match(pageRe);
    if (!m) {
      problems.push(`design/mockups/feed/${entry} does not match page-<n>.json`);
      continue;
    }
    const pageNumber = Number(m[1]);
    let json;
    try {
      json = JSON.parse(readFileSync(path.join(FEED_DIR, entry), 'utf8'));
    } catch (err) {
      problems.push(`design/mockups/feed/${entry} failed to parse: ${err.message}`);
      continue;
    }
    for (const p of validateFeedPage(json, pageNumber)) {
      problems.push(`design/mockups/feed/${entry}: ${p}`);
    }
    pagesByNumber.set(pageNumber, json);
  }

  const indexPath = path.join(MOCKUPS_DIR, 'index.html');
  if (!existsSync(indexPath)) return;
  const indexHtml = readFileSync(indexPath, 'utf8');

  // Chain: starts at the button's data-next, walks each page's own `next`.
  const buttonMatch = indexHtml.match(/<button[^>]*\bdata-load-more\b[^>]*\bdata-next="([^"]*)"[^>]*>/);
  let current = buttonMatch ? buttonMatch[1] : null;
  const visited = new Set();
  let chainOk = true;
  while (current !== null) {
    const chainMatch = typeof current === 'string' ? current.match(/^feed\/page-(\d+)\.json$/) : null;
    if (!chainMatch) {
      problems.push(`feed chain: unexpected next reference ${JSON.stringify(current)}`);
      chainOk = false;
      break;
    }
    const num = Number(chainMatch[1]);
    if (visited.has(num)) {
      problems.push(`feed chain: page ${num} visited more than once`);
      chainOk = false;
      break;
    }
    if (!pagesByNumber.has(num)) {
      problems.push(`feed chain: page ${num} referenced but the file is missing`);
      chainOk = false;
      break;
    }
    visited.add(num);
    current = pagesByNumber.get(num).next;
  }
  if (chainOk) {
    for (const num of pagesByNumber.keys()) {
      if (!visited.has(num)) {
        problems.push(`feed chain: page ${num} exists on disk but is never reached from index.html's data-next chain`);
      }
    }
  }

  // Card parity: feed:start..feed:end region + every feed page's cards, in
  // order, must equal home-feed.json's cards (compared by uuid/stress).
  const startIdx = indexHtml.indexOf('<!-- feed:start -->');
  const endIdx = indexHtml.indexOf('<!-- feed:end -->');
  if (startIdx === -1 || endIdx === -1) {
    problems.push('index.html is missing the feed:start/feed:end markers');
  } else {
    const region = indexHtml.slice(startIdx, endIdx);
    const initialIdentities = extractCardIdentities(region);

    const feedIdentities = [];
    for (const num of [...pagesByNumber.keys()].sort((a, b) => a - b)) {
      for (const card of pagesByNumber.get(num).cards ?? []) {
        feedIdentities.push({ uuid: card.uuid, stress: card.stress ?? null });
      }
    }

    const fixturePath = path.resolve('design/fixtures/home-feed.json');
    if (existsSync(fixturePath)) {
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
      const expected = (fixture.cards ?? []).map((c) => ({ uuid: c.uuid, stress: c.stress ?? null }));
      const actual = [...initialIdentities, ...feedIdentities];
      const same =
        expected.length === actual.length &&
        expected.every((e, i) => e.uuid === actual[i].uuid && e.stress === actual[i].stress);
      if (!same) {
        problems.push(
          `feed card parity: index.html's feed region + feed pages (${actual.length} cards) do not match design/fixtures/home-feed.json's ${expected.length} cards, in order`
        );
      }
    }
  }

  // Single-fetch guard on the shared head script.
  const scriptMatch = indexHtml.match(/<script\b[^>]*>[\s\S]*?<\/script>/i);
  if (!scriptMatch) {
    problems.push('index.html has no <script> block to check for a single fetch(');
  } else {
    const fetchCount = (scriptMatch[0].match(/fetch\(/g) || []).length;
    if (fetchCount !== 1) {
      problems.push(`index.html's head script contains ${fetchCount} fetch( occurrence(s), expected exactly 1`);
    }
  }
}

function nodeCheckC2() {
  const result = spawnSync('node', ['design/scripts/check-contrast.mjs'], { stdio: 'pipe' });
  return { pass: result.status === 0, problems: result.status === 0 ? [] : ['check-contrast.mjs exited non-zero'] };
}

function nodeCheckC5() {
  const problems = [];

  if (existsSync(path.join(MOCKUPS_DIR, 'fonts'))) {
    const allowedFontEntries = /^(.*\.woff2|OFL-.*\.txt|subset-manifest\.json)$/;
    for (const entry of readdirSync(path.join(MOCKUPS_DIR, 'fonts'))) {
      if (!allowedFontEntries.test(entry)) {
        problems.push(`unexpected entry in design/mockups/fonts: ${entry}`);
      }
    }
  }

  const styleCssPath = path.join(MOCKUPS_DIR, 'style.css');
  if (existsSync(styleCssPath)) {
    const css = readFileSync(styleCssPath, 'utf8');
    const fontFaceBlocks = css.match(/@font-face\s*{[^}]*}/g) ?? [];
    for (const block of fontFaceBlocks) {
      // D-GAP-A: every @font-face rule must carry font-display: optional —
      // the generator (build-fonts.mjs's FONT_DISPLAY constant) applies this
      // uniformly; a stray/mis-served block would silently reopen the
      // swap-triggered CLS this owner decision closed.
      if (!/font-display:\s*optional;/.test(block)) {
        problems.push(`@font-face without font-display: optional (D-GAP-A): ${block.slice(0, 80)}...`);
      }
      const srcMatch = block.match(/src:\s*([^;]+);/);
      if (!srcMatch) continue;
      const srcValue = srcMatch[1];
      const parts = srcValue.split(',').map((p) => p.trim());
      for (const part of parts) {
        if (!/^url\([^)]*\)\s*format\("woff2"\)$/.test(part) && !/^local\([^)]*\)$/.test(part)) {
          problems.push(`@font-face src uses a disallowed form: ${part}`);
        }
      }
    }
  }

  if (existsSync(MOCKUPS_DIR)) {
    function walk(dir) {
      for (const entry of readFileEntries(dir)) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const content = readFileSync(full, 'utf8').toLowerCase();
          for (const forbidden of FORBIDDEN_FACES) {
            if (content.includes(forbidden.toLowerCase())) {
              problems.push(`forbidden face name found in ${full}`);
            }
          }
        }
      }
    }
    function readFileEntries(dir) {
      return readdirSync(dir, { withFileTypes: true }).filter(
        (e) => e.isDirectory() || /\.(html|css|json|txt)$/i.test(e.name)
      );
    }
    walk(MOCKUPS_DIR);
  }

  // D-08: after the criterion-5 Playwright runs above have written their
  // per-(engine,page,width) swap-matrix fragments, merge them into the
  // canonical per-engine cache files and regenerate the evidence report. A
  // non-zero exit here (any measured combination at or above the 0.005
  // threshold) fails C5 — report-font-cls.mjs is itself an enforcement
  // gate, not just a report generator (same philosophy as check-contrast.mjs).
  const reportResult = spawnSync('node', ['design/scripts/report-font-cls.mjs'], { stdio: 'pipe' });
  if (reportResult.status !== 0) {
    problems.push('report-font-cls.mjs exited non-zero — see design/evidence/font-cls.md');
  }

  return { pass: problems.length === 0, problems };
}

const NODE_CHECKS = { 1: nodeCheckC1, 2: nodeCheckC2, 5: nodeCheckC5 };

function webkitInfo() {
  const modeFile = path.resolve('design/.webkit-mode.json');
  if (!existsSync(modeFile)) return { version: 'unknown', mode: 'unknown' };
  const mode = JSON.parse(readFileSync(modeFile, 'utf8'));
  return { version: mode.webkitVersion ?? 'unknown', mode: mode.mode ?? 'unknown' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pages = args.pages ?? ALL_PAGES;
  const criteria = args.criteria ?? ALL_CRITERIA;
  const engines = args.engines ?? ALL_ENGINES;

  const scoped = Boolean(args.pages || args.criteria || args.engines);

  const engineResults = {};
  for (const engine of engines) {
    engineResults[engine] = runEngine(engine, criteria, pages);
  }

  const nodeResults = {};
  for (const criterion of criteria) {
    const checkFn = NODE_CHECKS[criterion];
    nodeResults[criterion] = checkFn ? checkFn(pages, scoped) : null;
  }

  const results = {};
  let anyFailure = false;

  for (const criterion of criteria) {
    const isNodeOnly = NODE_ONLY_CRITERIA.has(criterion);
    const perEngine = {};
    for (const engine of engines) {
      perEngine[engine] = isNodeOnly
        ? 'n/a'
        : criterionVerdictFromSpecs(engineResults[engine].specs, `c${criterion}`);
    }
    const nodeResult = nodeResults[criterion];
    const nodeVerdict = nodeResult ? (nodeResult.pass ? 'PASS' : 'FAIL') : null;

    const enginesPass = isNodeOnly || engines.every((e) => perEngine[e] === 'PASS');
    const nodePass = nodeVerdict === null ? true : nodeVerdict === 'PASS';
    const verdict = enginesPass && nodePass ? 'PASS' : 'FAIL';
    if (verdict === 'FAIL') anyFailure = true;

    results[criterion] = {
      ...perEngine,
      node: nodeVerdict,
      verdict,
      nodeProblems: nodeResult?.problems ?? [],
    };
  }

  const wk = webkitInfo();
  const lines = [];
  if (scoped) {
    lines.push(
      `SCOPED RUN — pages: ${pages.join(',')}; criteria: ${criteria.join(',')} — NOT VALID FOR APPROVAL`
    );
    lines.push('');
  }

  const header = `| Criterion | ${engines.includes('chromium') ? 'Chromium' : ''} | ${
    engines.includes('webkit') ? `WebKit (Playwright ${wk.version}, ${wk.mode})` : ''
  } | Node checks | Verdict |`;
  lines.push(header);
  lines.push('|---|---|---|---|---|');
  for (const criterion of criteria) {
    const r = results[criterion];
    lines.push(
      `| ${criterion} | ${r.chromium ?? '—'} | ${r.webkit ?? '—'} | ${r.node ?? '—'} | ${r.verdict} |`
    );
    for (const problem of r.nodeProblems) {
      lines.push(`|  |  |  | ${problem} |  |`);
    }
  }

  const output = lines.join('\n');
  console.log(output);

  const jsonResult = {
    scope: scoped ? 'scoped' : 'full',
    pages,
    criteria,
    engines,
    results,
    generatedAt: new Date().toISOString(),
  };

  const outDir = scoped ? 'design/.cache' : 'design/evidence';
  mkdirSync(path.resolve(outDir), { recursive: true });
  writeFileSync(path.resolve(outDir, 'verify-phase-1.txt'), output + '\n', 'utf8');
  writeFileSync(path.resolve(outDir, 'verify-phase-1.json'), JSON.stringify(jsonResult, null, 2) + '\n', 'utf8');

  process.exit(anyFailure ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
