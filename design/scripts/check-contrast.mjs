#!/usr/bin/env node
// D-13: the contrast table is generated from the CSS tokens, not hand-written.
// Reads design/mockups/style.css (or --css), computes every WCAG ratio that
// matters, writes design/evidence/contrast.md (or --out), and exits non-zero
// on any failure. This script becomes the Phase 3 CI guard (01-CONTEXT.md).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { wcagContrast } from 'culori';
import { extractRegion, parseTokenRules, resolveTheme, toSrgb } from './lib/css-tokens.mjs';

function parseArgs(argv) {
  const args = { css: 'design/mockups/style.css', out: 'design/evidence/contrast.md', json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--css') { args.css = argv[++i]; continue; }
    if (arg === '--out') { args.out = argv[++i]; continue; }
    if (arg === '--json') { args.json = true; continue; }
    if (arg.startsWith('--css=')) { args.css = arg.slice('--css='.length); continue; }
    if (arg.startsWith('--out=')) { args.out = arg.slice('--out='.length); continue; }
  }
  return args;
}

/** Category slugs, in canonical sort order, discovered from the palette sub-region. */
function findCategorySlugs(css) {
  const paletteRegion = extractRegion(extractRegion(css, 'tokens'), 'palette');
  const slugs = [];
  const re = /--hue-([\w-]+):/g;
  let match;
  while ((match = re.exec(paletteRegion))) {
    slugs.push(match[1]);
  }
  return slugs;
}

function ratioFor(a, b) {
  return wcagContrast(toSrgb(a), toSrgb(b));
}

async function main() {
  const { css: cssPath, out: outPath } = parseArgs(process.argv.slice(2));
  const css = await readFile(path.resolve(cssPath), 'utf8');

  const tokensRegion = extractRegion(css, 'tokens');
  const rules = parseTokenRules(tokensRegion);
  const light = resolveTheme(rules, 'light');
  const dark = resolveTheme(rules, 'dark');

  const slugs = findCategorySlugs(css);

  let anyFailure = false;
  const neutralRows = [];
  const NEUTRAL_PAIRS = [
    { name: 'ink / paper', fg: '--ink', bg: '--paper', threshold: 4.5 },
    { name: 'ink-muted / paper', fg: '--ink-muted', bg: '--paper', threshold: 4.5 },
    { name: 'link / paper', fg: '--link', bg: '--paper', threshold: 4.5 },
    { name: 'focus-ring / paper', fg: '--focus-ring', bg: '--paper', threshold: 3 },
    { name: 'cat-none / paper', fg: '--cat-none', bg: '--paper', threshold: 3 },
  ];

  for (const themeName of ['light', 'dark']) {
    const theme = themeName === 'light' ? light : dark;
    for (const { name, fg, bg, threshold } of NEUTRAL_PAIRS) {
      const ratio = ratioFor(theme.get(fg), theme.get(bg));
      const pass = ratio >= threshold;
      if (!pass) anyFailure = true;
      neutralRows.push({ theme: themeName, name, threshold, ratio, pass });
    }
  }

  // Ramp rows: lightness is held constant across each ramp, so all eight
  // hues inherit the result in principle — but the equal-lightness
  // construction is not assumed to give equal contrast (OKLab L is not a
  // pure function of relative luminance), so every hue is actually checked
  // and the worst one is reported (D-13).
  const rampRows = [];

  // vivid-light vs light paper >= 3
  {
    let worst = { slug: null, ratio: Infinity };
    for (const slug of slugs) {
      const ratio = ratioFor(light.get(`--cat-${slug}-vivid-light`), light.get('--paper'));
      if (ratio < worst.ratio) worst = { slug, ratio };
    }
    const pass = worst.ratio >= 3;
    if (!pass) anyFailure = true;
    rampRows.push({ ramp: 'vivid-light', pairing: 'vs light paper', threshold: 3, ...worst, pass });
  }

  // vivid-dark vs dark paper >= 3
  {
    let worst = { slug: null, ratio: Infinity };
    for (const slug of slugs) {
      const ratio = ratioFor(dark.get(`--cat-${slug}-vivid-dark`), dark.get('--paper'));
      if (ratio < worst.ratio) worst = { slug, ratio };
    }
    const pass = worst.ratio >= 3;
    if (!pass) anyFailure = true;
    rampRows.push({ ramp: 'vivid-dark', pairing: 'vs dark paper', threshold: 3, ...worst, pass });
  }

  // block vs block-ink (both themes) >= 4.5, and focus-ring-on-block vs
  // block >= 3 in both themes (focus-ring-on-block === block-ink, so this
  // is the same comparison at a lower threshold and is covered by the same
  // worst-case search).
  {
    let worst = { slug: null, ratio: Infinity, which: null };
    for (const slug of slugs) {
      const blockColor = light.get(`--cat-${slug}-block`); // theme-invariant
      for (const [which, theme] of [['light', light], ['dark', dark]]) {
        const ratio = ratioFor(theme.get('--block-ink'), blockColor);
        if (ratio < worst.ratio) worst = { slug, ratio, which };
      }
    }
    const pass = worst.ratio >= 4.5;
    if (!pass) anyFailure = true;
    rampRows.push({
      ramp: 'block',
      pairing: `vs --block-ink (worst theme: ${worst.which})`,
      threshold: 4.5,
      slug: worst.slug,
      ratio: worst.ratio,
      pass,
    });
  }

  const fmt = (n) => n.toFixed(2);

  const lines = [];
  lines.push('# Contrast evidence (D-13)');
  lines.push('');
  lines.push(`Generated from \`${cssPath}\` — re-run \`npm run check:contrast\` after any token edit.`);
  lines.push('');
  lines.push('## Neutral pairs');
  lines.push('');
  lines.push('| Theme | Pair | Threshold | Ratio | Verdict |');
  lines.push('|---|---|---|---|---|');
  for (const row of neutralRows) {
    lines.push(
      `| ${row.theme} | ${row.name} | ${row.threshold}:1 | ${fmt(row.ratio)}:1 | ${row.pass ? 'PASS' : 'FAIL'} |`
    );
  }
  lines.push('');
  lines.push('## Category ramps');
  lines.push('');
  lines.push(
    'Lightness is held constant across each ramp (D-02/D-03); every hue is checked and the worst one is reported — equal OKLCH lightness does not guarantee equal WCAG contrast.'
  );
  lines.push('');
  lines.push('| Ramp | Pairing | Threshold | Worst hue | Ratio | Verdict |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of rampRows) {
    lines.push(
      `| ${row.ramp} | ${row.pairing} | ${row.threshold}:1 | ${row.slug} | ${fmt(row.ratio)}:1 | ${row.pass ? 'PASS' : 'FAIL'} |`
    );
  }
  lines.push('');
  lines.push(`**Overall: ${anyFailure ? 'FAIL' : 'PASS'}**`);
  lines.push('');

  const output = lines.join('\n');
  console.log(output);

  await mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
  await writeFile(path.resolve(outPath), output, 'utf8');

  process.exit(anyFailure ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
