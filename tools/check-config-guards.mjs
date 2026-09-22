#!/usr/bin/env node
// ARCH-04 / ARCH-05 / T-03-01: guards the one class of drift the D1-import module-graph walk
// (tools/assert-no-d1.mjs) cannot see by construction — config, not code.
//
// ARCH-04: the removed `Astro.locals.runtime.env` accessor (removed in `@astrojs/cloudflare` v13
// / Astro 6) must appear nowhere in `src/**` or `astro.config.mjs`. Bindings must be read via
// `import { env } from 'cloudflare:workers'` instead.
//
// ARCH-05: the removed Astro v5 output keyword `'hybrid'` (merged into `'static'` as of Astro v5,
// not a deprecation — configuring it errors or is silently ignored depending on version) must
// never appear as an `output` config value in `src/**` or `astro.config.mjs`.
//
// T-03-01: a `d1_databases` binding must never appear in `wrangler.jsonc` at all. This is the
// gap the module-graph walk cannot see by construction — a Worker binding is not a graph edge —
// so config is the only place this class of reintroduction can be caught. Cheap and deterministic
// on purpose (03-RESEARCH.md "Known Threat Patterns for this Stack").
//
// T-03-05: the ARCH-04/ARCH-05 checks strip `//` and `/* */` comments before scanning. This
// repo's own planning docs quote both removed-API patterns verbatim, so a prose-sensitive guard
// would be permanently red or permanently ignored — a naive `grep -c` over an unfiltered file
// counts prose and is self-invalidating the moment someone documents the rule. The wrangler.jsonc
// check is the ONE deliberate exception: it does NOT strip comments, because a commented-out
// `d1_databases` block is one uncomment away from a live D1 path, and the point of T-03-01 is
// that no such block should exist in the file text at all, not even inert.

import fs from 'node:fs';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.astro', '.vue']);
const REMOVED_ENV_ACCESSOR = 'Astro.locals.runtime.env';
const REMOVED_OUTPUT_KEYWORD_RE = /output\s*:\s*['"]hybrid['"]/;
const D1_BINDING_KEY = 'd1_databases';

function parseArgs(argv) {
  const args = { src: 'src', config: 'astro.config.mjs', wrangler: 'wrangler.jsonc', json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--src') { args.src = argv[++i]; continue; }
    if (arg === '--config') { args.config = argv[++i]; continue; }
    if (arg === '--wrangler') { args.wrangler = argv[++i]; continue; }
    if (arg === '--json') { args.json = true; continue; }
    if (arg.startsWith('--src=')) { args.src = arg.slice('--src='.length); continue; }
    if (arg.startsWith('--config=')) { args.config = arg.slice('--config='.length); continue; }
    if (arg.startsWith('--wrangler=')) { args.wrangler = arg.slice('--wrangler='.length); continue; }
  }
  return args;
}

/**
 * Strips `//` line comments and `/* *\/` block comments, replacing removed characters with
 * spaces (not deleting them) so every remaining line keeps its original line number — a
 * violation reported after stripping still points at the real source line. Deliberately simple
 * (no string-literal awareness): good enough for this repo's own source, and a real tokenizer
 * here would be exactly the kind of hand-rolled complexity 03-RESEARCH.md's "Don't Hand-Roll"
 * table warns against introducing without a documented need.
 */
export function stripComments(text) {
  let stripped = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  stripped = stripped.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  return stripped;
}

function walkSourceFiles(root) {
  const results = [];
  if (!fs.existsSync(root)) return results;
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        results.push(full);
      }
    }
  }
  return results;
}

/** ARCH-04 / ARCH-05: comment-stripped scan of one source file. */
export function scanSourceFile(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const stripped = stripComments(raw);
  const lines = stripped.split('\n');
  const violations = [];
  lines.forEach((line, idx) => {
    if (line.includes(REMOVED_ENV_ACCESSOR)) {
      violations.push({
        file: absPath,
        line: idx + 1,
        rule: 'ARCH-04',
        message: `removed accessor "${REMOVED_ENV_ACCESSOR}" — use \`import { env } from 'cloudflare:workers'\` instead`,
      });
    }
    if (REMOVED_OUTPUT_KEYWORD_RE.test(line)) {
      violations.push({
        file: absPath,
        line: idx + 1,
        rule: 'ARCH-05',
        message: "removed output keyword \"hybrid\" (merged into 'static' as of Astro v5, not a deprecation)",
      });
    }
  });
  return violations;
}

/** T-03-01: raw (NOT comment-stripped) scan of wrangler.jsonc for a Worker database binding. */
export function scanWranglerForD1Binding(absPath) {
  if (!fs.existsSync(absPath)) return [];
  const raw = fs.readFileSync(absPath, 'utf8');
  const lines = raw.split('\n');
  const violations = [];
  lines.forEach((line, idx) => {
    if (line.includes(D1_BINDING_KEY)) {
      violations.push({
        file: absPath,
        line: idx + 1,
        rule: 'T-03-01',
        message: `Worker database binding "${D1_BINDING_KEY}" must not appear in wrangler.jsonc — not in live config, not in a comment`,
      });
    }
  });
  return violations;
}

export function collectViolations({ src, config, wrangler }) {
  const violations = [];
  const filesToScan = walkSourceFiles(src);
  if (fs.existsSync(config)) filesToScan.push(config);
  for (const file of filesToScan) {
    violations.push(...scanSourceFile(file));
  }
  violations.push(...scanWranglerForD1Binding(wrangler));
  return violations;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const violations = collectViolations(args);

  if (args.json) {
    console.log(JSON.stringify({ ok: violations.length === 0, violations }, null, 2));
  } else if (violations.length > 0) {
    console.error(`[check-config-guards] ${violations.length} violation(s) found:`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.message}`);
    }
  } else {
    console.log('[check-config-guards] no violations found (ARCH-04, ARCH-05, T-03-01)');
  }

  process.exitCode = violations.length === 0 ? 0 : 1;
}

// Only run as a CLI when invoked directly — tests/unit/astro-config.test.mjs imports the named
// exports above and drives them without spawning a process where possible.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
