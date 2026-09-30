#!/usr/bin/env node
// D-13 hardened gate: the contrast table is generated from the CSS tokens,
// not hand-written, and fails loudly on every way the palette can silently
// go wrong (missing token, unresolved var, out-of-gamut colour, uncovered
// colour, colliding hues, broken D-02 structure, a warm neutral, low
// contrast in either theme, a colour literal outside the tokens region).
// This script becomes the Phase 3 CI guard (01-CONTEXT.md).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { wcagContrast, parse, differenceEuclidean, converter } from 'culori';

const toOklchConverter = converter('oklch');
import {
  extractRegion,
  parseTokenRules,
  parseFontsRootVars,
  resolveTheme,
  toSrgb,
  isColorValue,
  CANONICAL_SLUGS,
} from './lib/css-tokens.mjs';

const oklabDistance = differenceEuclidean('oklab');

/** Two entries only, each with a written reason (D-13 coverage rule). */
const EXEMPT = {
  '--rule': 'decorative divider; carries no information',
  '--link-underline': "currentColor; inherits the link colour already checked",
};

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

/** Category slugs, in file order, discovered from the palette sub-region. */
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

/** Concatenates everything in `css` outside the fonts and tokens regions. */
function extractOutsideRegions(css) {
  const ranges = [];
  for (const name of ['fonts', 'tokens']) {
    const startMarker = `/* ${name}:start */`;
    const endMarker = `/* ${name}:end */`;
    const s = css.indexOf(startMarker);
    if (s === -1) continue;
    const e = css.indexOf(endMarker, s);
    if (e === -1) continue;
    ranges.push([s, e + endMarker.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  let result = '';
  let cursor = 0;
  for (const [s, e] of ranges) {
    result += css.slice(cursor, s);
    cursor = e;
  }
  result += css.slice(cursor);
  return result;
}

const LITERAL_COLOR_RE =
  /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\boklab\(|\blab\(|\blch\(|\bcolor-mix\(|\bcolor\(/;

/** Finds colour literals in declaration *values* outside fonts/tokens regions. */
function findLiteralColorsOutsideTokens(css) {
  const outside = extractOutsideRegions(css).replace(/\/\*[\s\S]*?\*\//g, '');
  const found = [];
  const declRe = /([\w-]+)\s*:\s*([^;{}]+);/g;
  let match;
  while ((match = declRe.exec(outside))) {
    const [, prop, value] = match;
    if (LITERAL_COLOR_RE.test(value)) {
      found.push({ prop, value: value.trim() });
    }
  }
  return found;
}

function main() {
  return run();
}

async function run() {
  const { css: cssPath, out: outPath, json: jsonMode } = parseArgs(process.argv.slice(2));
  const css = await readFile(path.resolve(cssPath), 'utf8');

  const failures = [];
  const warnings = [];
  const rows = [];

  const fail = (rule, subject, detail) => {
    failures.push({ rule, subject, detail });
  };

  const tokensRegion = extractRegion(css, 'tokens');
  const rules = parseTokenRules(tokensRegion);
  // D-GAP-B: --font-headline (tokens region) aliases --font-body, which is
  // owned by the fonts region — merge it in so resolveTheme's eager
  // resolution doesn't report it as a missing reference. Non-colour values,
  // so no effect on any gamut/contrast check below.
  for (const [key, value] of parseFontsRootVars(css)) {
    if (!rules.light.has(key)) rules.light.set(key, value);
  }

  let light;
  let dark;
  try {
    light = resolveTheme(rules, 'light');
  } catch (err) {
    return finish({ fatal: err, failures, warnings, rows }, outPath, jsonMode, cssPath);
  }
  try {
    dark = resolveTheme(rules, 'dark');
  } catch (err) {
    return finish({ fatal: err, failures, warnings, rows }, outPath, jsonMode, cssPath);
  }

  const slugs = findCategorySlugs(css);

  // ---- Structure: category discovery vs CANONICAL_SLUGS, exact order ----
  const slugsMatch =
    slugs.length === CANONICAL_SLUGS.length && slugs.every((s, i) => s === CANONICAL_SLUGS[i]);
  if (!slugsMatch) {
    fail(
      'structure',
      'categories',
      `found [${slugs.join(', ')}], expected [${CANONICAL_SLUGS.join(', ')}] in order`
    );
  }

  // ---- Required manifest ----
  const NEUTRAL_KEYS = ['--paper', '--ink', '--ink-muted', '--rule', '--rule-strong'];
  const STOP_KEYS = [
    '--stop-vivid-light-l',
    '--stop-vivid-light-c',
    '--stop-block-l',
    '--stop-block-c',
    '--stop-vivid-dark-l',
    '--stop-vivid-dark-c',
  ];
  const BASE_MANIFEST = [
    ...NEUTRAL_KEYS,
    '--link',
    '--link-underline',
    '--focus-ring',
    '--focus-ring-width',
    '--focus-ring-offset',
    '--block-ink',
    '--focus-ring-on-block',
    '--cat-none',
    ...STOP_KEYS,
  ];
  const perSlugKeys = (slug) => [
    `--hue-${slug}`,
    `--cat-${slug}-vivid-light`,
    `--cat-${slug}-block`,
    `--cat-${slug}-vivid-dark`,
    `--cat-${slug}`,
  ];
  const REQUIRED_MANIFEST = [...BASE_MANIFEST, ...CANONICAL_SLUGS.flatMap(perSlugKeys)];

  for (const [themeName, theme] of [['light', light], ['dark', dark]]) {
    for (const key of REQUIRED_MANIFEST) {
      if (!theme.has(key)) {
        fail('manifest', key, `missing from the ${themeName} theme`);
      }
    }
  }

  const get = (theme, key) => (theme.has(key) ? theme.get(key) : undefined);

  // ---- Gamut: every colour-valued resolved token must be sRGB-displayable ----
  const srgbCache = new Map(); // "themeName:key" -> srgb triple | null
  for (const [themeName, theme] of [['light', light], ['dark', dark]]) {
    for (const [key, value] of theme) {
      if (!isColorValue(value)) continue;
      try {
        srgbCache.set(`${themeName}:${key}`, toSrgb(value));
      } catch (err) {
        fail('gamut', key, `${themeName} theme — ${err.message}`);
        srgbCache.set(`${themeName}:${key}`, null);
      }
    }
  }

  const srgbFor = (themeName, key) => {
    if (srgbCache.has(`${themeName}:${key}`)) return srgbCache.get(`${themeName}:${key}`);
    return null;
  };

  const ratioFor = (themeName, fgKey, bgKey) => {
    const fg = srgbFor(themeName, fgKey);
    const bg = srgbFor(themeName, bgKey);
    if (!fg || !bg) return null;
    return wcagContrast(fg, bg);
  };

  // ---- Neutrals ----
  const neutralRows = [];
  const NEUTRAL_PAIRS = [
    { name: 'ink / paper', fg: '--ink', bg: '--paper', threshold: 4.5 },
    { name: 'ink-muted / paper', fg: '--ink-muted', bg: '--paper', threshold: 4.5 },
    { name: 'link / paper', fg: '--link', bg: '--paper', threshold: 4.5 },
    { name: 'cat-none / paper', fg: '--cat-none', bg: '--paper', threshold: 3 },
  ];
  for (const themeName of ['light', 'dark']) {
    for (const { name, fg, bg, threshold } of NEUTRAL_PAIRS) {
      const ratio = ratioFor(themeName, fg, bg);
      if (ratio == null) continue; // already flagged by manifest/gamut
      const pass = ratio >= threshold;
      if (!pass) fail('neutral', `${fg} / ${bg}`, `${themeName}: ${ratio.toFixed(2)}:1 < ${threshold}:1`);
      neutralRows.push({ theme: themeName, name, threshold, ratio, pass });
      rows.push({ group: 'neutral', theme: themeName, name, threshold, ratio, pass });
    }
  }

  // ---- Focus ----
  const focusRows = [];
  for (const themeName of ['light', 'dark']) {
    const ratio = ratioFor(themeName, '--focus-ring', '--paper');
    if (ratio != null) {
      const pass = ratio >= 3;
      if (!pass) fail('focus', 'focus-ring / paper', `${themeName}: ${ratio.toFixed(2)}:1 < 3:1`);
      focusRows.push({ theme: themeName, name: 'focus-ring / paper', threshold: 3, ratio, pass });
      rows.push({ group: 'focus', theme: themeName, name: 'focus-ring / paper', threshold: 3, ratio, pass });
    }
  }
  {
    let worst = { slug: null, ratio: Infinity, theme: null };
    for (const themeName of ['light', 'dark']) {
      for (const slug of slugs) {
        const ratio = ratioFor(themeName, '--focus-ring-on-block', `--cat-${slug}-block`);
        if (ratio == null) continue;
        if (ratio < worst.ratio) worst = { slug, ratio, theme: themeName };
      }
    }
    if (worst.slug != null) {
      const pass = worst.ratio >= 3;
      if (!pass) fail('focus', 'focus-ring-on-block', `worst ${worst.slug} (${worst.theme}): ${worst.ratio.toFixed(2)}:1 < 3:1`);
      focusRows.push({ theme: worst.theme, name: `focus-ring-on-block vs block (worst: ${worst.slug})`, threshold: 3, ratio: worst.ratio, pass });
      rows.push({ group: 'focus', theme: worst.theme, name: 'focus-ring-on-block', threshold: 3, ratio: worst.ratio, pass, slug: worst.slug });
    }
  }

  // ---- Ramps: 3 rows, worst hue reported ----
  const rampRows = [];
  {
    let worst = { slug: null, ratio: Infinity };
    for (const slug of slugs) {
      const ratio = ratioFor('light', `--cat-${slug}-vivid-light`, '--paper');
      if (ratio == null) continue;
      if (ratio < worst.ratio) worst = { slug, ratio };
    }
    if (worst.slug != null) {
      const pass = worst.ratio >= 3;
      if (!pass) fail('ramp', 'vivid-light', `worst hue ${worst.slug}: ${worst.ratio.toFixed(2)}:1 < 3:1`);
      rampRows.push({ ramp: 'vivid-light', pairing: 'vs light paper', threshold: 3, ...worst, pass });
      rows.push({ group: 'ramp', ramp: 'vivid-light', pairing: 'vs light paper', threshold: 3, slug: worst.slug, ratio: worst.ratio, pass });
    }
  }
  {
    let worst = { slug: null, ratio: Infinity, which: null };
    for (const slug of slugs) {
      for (const which of ['light', 'dark']) {
        const ratio = ratioFor(which, '--block-ink', `--cat-${slug}-block`);
        if (ratio == null) continue;
        if (ratio < worst.ratio) worst = { slug, ratio, which };
      }
    }
    if (worst.slug != null) {
      const pass = worst.ratio >= 4.5;
      if (!pass) fail('ramp', 'block', `worst ${worst.slug} (${worst.which}): ${worst.ratio.toFixed(2)}:1 < 4.5:1`);
      rampRows.push({
        ramp: 'block',
        pairing: `vs --block-ink (worst theme: ${worst.which})`,
        threshold: 4.5,
        slug: worst.slug,
        ratio: worst.ratio,
        pass,
      });
      rows.push({ group: 'ramp', ramp: 'block', pairing: `vs --block-ink (worst theme: ${worst.which})`, threshold: 4.5, slug: worst.slug, ratio: worst.ratio, pass });
    }
  }
  {
    let worst = { slug: null, ratio: Infinity };
    for (const slug of slugs) {
      const ratio = ratioFor('dark', `--cat-${slug}-vivid-dark`, '--paper');
      if (ratio == null) continue;
      if (ratio < worst.ratio) worst = { slug, ratio };
    }
    if (worst.slug != null) {
      const pass = worst.ratio >= 3;
      if (!pass) fail('ramp', 'vivid-dark', `worst hue ${worst.slug}: ${worst.ratio.toFixed(2)}:1 < 3:1`);
      rampRows.push({ ramp: 'vivid-dark', pairing: 'vs dark paper', threshold: 3, ...worst, pass });
      rows.push({ group: 'ramp', ramp: 'vivid-dark', pairing: 'vs dark paper', threshold: 3, slug: worst.slug, ratio: worst.ratio, pass });
    }
  }

  // ---- D-02 structure: stop literal L/C/H vs the shared stop numbers ----
  const structureRows = [];
  const STOPS = [
    { name: 'vivid-light', lKey: '--stop-vivid-light-l', cKey: '--stop-vivid-light-c' },
    { name: 'block', lKey: '--stop-block-l', cKey: '--stop-block-c' },
    { name: 'vivid-dark', lKey: '--stop-vivid-dark-l', cKey: '--stop-vivid-dark-c' },
  ];
  for (const stop of STOPS) {
    const stopL = get(light, stop.lKey) != null ? parseFloat(get(light, stop.lKey)) : null;
    const stopC = get(light, stop.cKey) != null ? parseFloat(get(light, stop.cKey)) : null;
    if (stopL == null || stopC == null) continue; // already flagged by manifest
    for (const slug of slugs) {
      const tokenName = `--cat-${slug}-${stop.name}`;
      const raw = get(light, tokenName);
      if (raw == null) continue; // already flagged by manifest
      const parsed = parse(raw);
      if (!parsed || parsed.mode !== 'oklch') {
        fail('structure', tokenName, `expected an oklch() literal, got "${raw}"`);
        continue;
      }
      const hueKey = `--hue-${slug}`;
      const hueRaw = get(light, hueKey);
      const hue = hueRaw != null ? parseFloat(hueRaw) : null;
      const lOk = Math.abs(parsed.l - stopL) <= 0.0005;
      const cOk = parsed.c <= stopC + 0.0005;
      const hOk = hue != null && Math.abs((parsed.h ?? 0) - hue) <= 0.05;
      const pass = lOk && cOk && hOk;
      if (!pass) {
        const details = [];
        if (!lOk) details.push(`L ${parsed.l.toFixed(4)} != stop ${stopL.toFixed(4)}`);
        if (!cOk) details.push(`C ${parsed.c.toFixed(4)} > stop ${stopC.toFixed(4)}`);
        if (!hOk) details.push(`H ${(parsed.h ?? 0).toFixed(2)} != --hue-${slug} ${hue}`);
        fail('structure', tokenName, details.join('; '));
      }
      structureRows.push({ stop: stop.name, slug, pass });
      rows.push({ group: 'structure', stop: stop.name, slug, pass });
    }
  }

  // ---- Distinctness: min pairwise OKLab distance per stop >= 0.05 ----
  const distinctnessRows = [];
  for (const stop of STOPS) {
    const points = [];
    for (const slug of slugs) {
      const raw = get(light, `--cat-${slug}-${stop.name}`);
      if (raw == null) continue;
      const parsed = parse(raw);
      if (!parsed) continue;
      points.push({ slug, parsed });
    }
    let worst = { a: null, b: null, distance: Infinity };
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = oklabDistance(points[i].parsed, points[j].parsed);
        if (d < worst.distance) worst = { a: points[i].slug, b: points[j].slug, distance: d };
      }
    }
    if (worst.a != null) {
      const pass = worst.distance >= 0.05;
      if (!pass) {
        fail(
          'distinctness',
          `${worst.a} / ${worst.b}`,
          `${stop.name}: distance ${worst.distance.toFixed(4)} < 0.05`
        );
      }
      distinctnessRows.push({ stop: stop.name, a: worst.a, b: worst.b, distance: worst.distance, pass });
      rows.push({ group: 'distinctness', stop: stop.name, a: worst.a, b: worst.b, distance: worst.distance, pass });
    }
  }

  // ---- C-01 neutrals: warm hue (35-110deg) requires low chroma ----
  const c01Rows = [];
  const C01_NEUTRAL_KEYS = ['--paper', '--ink', '--ink-muted', '--rule', '--rule-strong', '--block-ink'];
  for (const [themeName, theme] of [['light', light], ['dark', dark]]) {
    for (const key of C01_NEUTRAL_KEYS) {
      const raw = get(theme, key);
      if (raw == null) continue;
      const srgb = srgbFor(themeName, key);
      if (!srgb) continue; // already flagged by gamut
      const parsedRaw = parse(raw);
      const oklchValue = parsedRaw ? toOklchConverter(parsedRaw) : null;
      if (!oklchValue) continue;
      const { h = 0, c } = oklchValue;
      const isWarmBand = h >= 35 && h <= 110;
      const pass = !isWarmBand || c <= 0.006;
      if (!pass) {
        fail('C-01', key, `${themeName}: hue ${h.toFixed(1)}deg (35-110 band), C ${c.toFixed(4)} > 0.006`);
      }
      c01Rows.push({ theme: themeName, key, hue: h, chroma: c, pass });
      rows.push({ group: 'c01', theme: themeName, key, hue: h, chroma: c, pass });
    }
  }

  // ---- C-01 review: block stop hue in 40-100deg -> warning only ----
  for (const slug of slugs) {
    const raw = get(light, `--cat-${slug}-block`);
    if (raw == null) continue;
    const parsed = parse(raw);
    if (!parsed || parsed.mode !== 'oklch') continue;
    const hue = parsed.h ?? 0;
    if (hue >= 40 && hue <= 100) {
      warnings.push(`C-01 review: ${slug} block stop hue ${hue.toFixed(1)}deg falls in the 40-100deg amber/olive band — may read as brown; owner to judge`);
    }
  }

  // ---- Coverage: every colour-valued declaration is covered or exempt ----
  const declaredNames = new Set([...rules.light.keys(), ...rules.dark.keys()]);
  const directlyUsed = new Set([
    '--ink',
    '--ink-muted',
    '--link',
    '--paper',
    '--focus-ring',
    '--cat-none',
    '--block-ink',
    '--focus-ring-on-block',
    ...slugs.flatMap((slug) => [
      `--cat-${slug}-vivid-light`,
      `--cat-${slug}-block`,
      `--cat-${slug}-vivid-dark`,
    ]),
  ]);

  // Undirected union of pure var() alias edges, gathered from both regions.
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const PURE_ALIAS_RE = /^var\(\s*(--[\w-]+)\s*\)$/;
  for (const name of declaredNames) find(name);
  for (const ruleMap of [rules.light, rules.dark]) {
    for (const [name, raw] of ruleMap) {
      const m = PURE_ALIAS_RE.exec(raw.trim());
      if (m) union(name, m[1]);
    }
  }
  const coveredRoots = new Set([...directlyUsed].map((n) => find(n)));

  for (const name of declaredNames) {
    if (name in EXEMPT) continue;
    const resolvedValue = light.has(name) ? light.get(name) : dark.get(name);
    if (resolvedValue == null || !isColorValue(resolvedValue)) continue;
    if (!coveredRoots.has(find(name))) {
      fail('coverage', name, 'not covered by any checked pair');
    }
  }

  // ---- Literals: no colour literal outside the fonts/tokens regions ----
  const stray = findLiteralColorsOutsideTokens(css);
  for (const { prop, value } of stray) {
    fail('literal', prop, `colour literal outside tokens region: "${value}"`);
  }

  return finish({ failures, warnings, rows, neutralRows, focusRows, rampRows, structureRows, distinctnessRows, c01Rows }, outPath, jsonMode, cssPath);
}

async function finish(state, outPath, jsonMode, cssPath) {
  const { fatal, failures, warnings, rows } = state;

  if (fatal) {
    console.error(`FAIL resolve: ${fatal.message}`);
    if (jsonMode) {
      console.log(JSON.stringify({ ok: false, failures: [{ rule: 'resolve', detail: fatal.message }], warnings: [], rows: [] }));
    }
    process.exitCode = 1;
    return;
  }

  const anyFailure = failures.length > 0;

  for (const f of failures) {
    console.error(`FAIL ${f.rule}: ${f.subject} — ${f.detail}`);
  }

  const fmt = (n) => n.toFixed(2);
  const lines = [];
  lines.push('# Contrast evidence (D-13)');
  lines.push('');
  lines.push(`Generated from \`${cssPath}\` — re-run \`pnpm run check:contrast\` after any token edit.`);
  lines.push('');

  lines.push('## Neutrals');
  lines.push('');
  lines.push('| Theme | Pair | Threshold | Ratio | Verdict |');
  lines.push('|---|---|---|---|---|');
  for (const row of state.neutralRows ?? []) {
    lines.push(`| ${row.theme} | ${row.name} | ${row.threshold}:1 | ${fmt(row.ratio)}:1 | ${row.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');

  lines.push('## Ramps');
  lines.push('');
  lines.push('Lightness is held constant across each ramp (D-02/D-03); every hue is checked and the worst one is reported.');
  lines.push('');
  lines.push('| Ramp | Pairing | Threshold | Worst hue | Ratio | Verdict |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of state.rampRows ?? []) {
    lines.push(`| ${row.ramp} | ${row.pairing} | ${row.threshold}:1 | ${row.slug} | ${fmt(row.ratio)}:1 | ${row.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');

  lines.push('## Focus');
  lines.push('');
  lines.push('| Theme | Pair | Threshold | Ratio | Verdict |');
  lines.push('|---|---|---|---|---|');
  for (const row of state.focusRows ?? []) {
    lines.push(`| ${row.theme} | ${row.name} | ${row.threshold}:1 | ${fmt(row.ratio)}:1 | ${row.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');

  lines.push('## Distinctness');
  lines.push('');
  lines.push('Minimum pairwise OKLab distance per stop (>= 0.05 required).');
  lines.push('');
  lines.push('| Closest pair | Stop | Distance | Verdict |');
  lines.push('|---|---|---|---|');
  for (const row of state.distinctnessRows ?? []) {
    lines.push(`| ${row.a} / ${row.b} | ${row.stop} | ${row.distance.toFixed(4)} | ${row.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');

  lines.push('## D-02 structure');
  lines.push('');
  lines.push(`${(state.structureRows ?? []).every((r) => r.pass) ? 'All stop literals match their shared stop L/C and per-category hue.' : 'One or more stop literals do not match D-02 structure — see failures above.'}`);
  lines.push('');

  lines.push('## C-01 guards');
  lines.push('');
  lines.push('| Theme | Token | Hue | Chroma | Verdict |');
  lines.push('|---|---|---|---|---|');
  for (const row of state.c01Rows ?? []) {
    lines.push(`| ${row.theme} | ${row.key} | ${row.hue.toFixed(1)}deg | ${row.chroma.toFixed(4)} | ${row.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('');

  lines.push('## Warnings');
  lines.push('');
  if (warnings.length === 0) {
    lines.push('None.');
  } else {
    for (const w of warnings) lines.push(`- ${w}`);
  }
  lines.push('');

  lines.push(`**Overall: ${anyFailure ? 'FAIL' : 'PASS'}**`);
  lines.push('');

  const output = lines.join('\n');

  await mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
  await writeFile(path.resolve(outPath), output, 'utf8');

  if (jsonMode) {
    console.log(
      JSON.stringify({
        ok: !anyFailure,
        failures: failures.map((f) => `${f.rule}: ${f.subject} — ${f.detail}`),
        warnings,
        rows,
      })
    );
  } else {
    console.log(output);
  }

  process.exitCode = anyFailure ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
