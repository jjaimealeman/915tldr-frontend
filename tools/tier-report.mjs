#!/usr/bin/env node
// 05-01 Task 1: classifies the last build's tier facts (`.astro/tier-facts-articles.json`,
// `.astro/tier-facts-tags.json`) under the current hot window (or a `--days N` candidate
// projection), and prints a summary. `--json` prints the machine-readable shape downstream
// plans/tests consume: `{ hotWindow, cutoffEpoch, articles: { hot, archive }, tags: { hot,
// archive } }`. Exits 1 with the thrown message on any error — same fail-loud discipline as
// `tools/assert-no-d1.mjs`.
import { readTierFacts } from '../src/lib/archive/tier-facts.ts';
import { loadHotWindow, describeHotWindow } from '../src/lib/archive/hot-window.ts';
import { hotCutoffEpoch, classifyArticles, classifyTags } from '../src/lib/archive/tiering.ts';

function parseArgs(argv) {
  const args = { json: false, days: null, now: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--days') args.days = Number(argv[++i]);
    else if (arg === '--now') args.now = Number(argv[++i]);
  }
  return args;
}

/** Builds the report object. A `days` override projects a candidate window instead of loading
 * `hot-window.json` — used by future plans (e.g. 05-05's file-budget cap) to try a candidate
 * window before committing it. */
export function buildReport({ days, now } = {}) {
  const facts = readTierFacts();
  const nowEpoch = typeof now === 'number' && Number.isFinite(now) ? now : Math.floor(Date.now() / 1000);

  let hotWindow;
  let windowDays;
  if (typeof days === 'number' && Number.isFinite(days)) {
    windowDays = days;
    hotWindow = {
      status: 'candidate',
      provisional: true,
      days,
      basis: 'candidate-projection',
      decision: 'cli --days flag',
    };
  } else {
    hotWindow = loadHotWindow();
    windowDays = hotWindow.days;
  }

  const cutoffEpoch = hotCutoffEpoch(nowEpoch, windowDays);
  const articleSplit = classifyArticles(facts.articles, cutoffEpoch);
  const tagSplit = classifyTags(facts.tags);

  return {
    hotWindow,
    cutoffEpoch,
    articles: { hot: articleSplit.hot.length, archive: articleSplit.archive.length },
    tags: { hot: tagSplit.hot.length, archive: tagSplit.archive.length },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let report;
  try {
    report = buildReport(args);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  if (args.json) {
    console.log(JSON.stringify(report));
    return;
  }

  console.log(describeHotWindow(report.hotWindow));
  console.log(`cutoff epoch: ${report.cutoffEpoch}`);
  console.log(`articles: hot=${report.articles.hot} archive=${report.articles.archive}`);
  console.log(`tags: hot=${report.tags.hot} archive=${report.tags.archive}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
