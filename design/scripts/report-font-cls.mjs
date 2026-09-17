#!/usr/bin/env node
// D-08/criterion-5: merges every design/.cache/font-cls-fragments/<engine>__
// <page>__<width>.json fragment (written by font-cls.spec.ts, one file per
// (page,width) test so parallel workers never race on a shared file) into
// the canonical design/.cache/font-cls-<engine>.json per engine, then writes
// design/evidence/font-cls.md — the full swap-matrix evidence table plus
// the WebKit/Safari caveats T-01-29 requires. Exits non-zero if any
// measured combination breaches the 0.005 threshold, so this script is
// itself an enforcement gate (same philosophy as check-contrast.mjs), not
// just a report generator.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CACHE_DIR = path.resolve('design/.cache');
const FRAGMENTS_DIR = path.join(CACHE_DIR, 'font-cls-fragments');
const EVIDENCE_DIR = path.resolve('design/evidence');
const WEBKIT_MODE_PATH = path.resolve('design/.webkit-mode.json');
const CANIUSE_URL = 'https://caniuse.com/mdn-css_at-rules_font-face_ascent-override';
const CANIUSE_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const THRESHOLD = 0.005;

/** Fallback faces this project's font pipeline can ever exercise (build-fonts.mjs/01-02). */
const ALL_KNOWN_FACES = ['Georgia', 'Noto Serif', 'Times New Roman'];

function mergeFragments() {
  mkdirSync(FRAGMENTS_DIR, { recursive: true });
  const byEngine = {};
  for (const entry of readdirSync(FRAGMENTS_DIR)) {
    if (!entry.endsWith('.json')) continue;
    const [engine] = entry.split('__');
    if (!engine) continue;
    const rows = JSON.parse(readFileSync(path.join(FRAGMENTS_DIR, entry), 'utf8'));
    byEngine[engine] = byEngine[engine] ?? [];
    byEngine[engine].push(...rows);
  }

  for (const [engine, rows] of Object.entries(byEngine)) {
    rows.sort((a, b) =>
      a.page === b.page
        ? a.width === b.width
          ? a.scroll === b.scroll
            ? a.variant === b.variant
              ? String(a.fallbackFamily).localeCompare(String(b.fallbackFamily))
              : a.variant.localeCompare(b.variant)
            : a.scroll.localeCompare(b.scroll)
          : a.width - b.width
        : a.page.localeCompare(b.page)
    );
    writeFileSync(path.join(CACHE_DIR, `font-cls-${engine}.json`), JSON.stringify(rows, null, 2) + '\n', 'utf8');
  }

  return byEngine;
}

function webkitInfo() {
  if (!existsSync(WEBKIT_MODE_PATH)) return { version: 'unknown', mode: 'unknown' };
  const mode = JSON.parse(readFileSync(WEBKIT_MODE_PATH, 'utf8'));
  return { version: mode.webkitVersion ?? 'unknown', mode: mode.mode ?? 'unknown' };
}

async function fetchCaniuseSafariStatus() {
  try {
    const response = await fetch(CANIUSE_URL, { headers: { 'User-Agent': CANIUSE_UA } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    // The support data is embedded as an escaped JSON string inside a
    // <script> tag (\"safari\":{\"version_added\":\"preview\"), not as
    // literal unescaped JSON — the backslash before each quote is optional
    // here specifically to tolerate either form.
    const match = html.match(/\\?"safari\\?":\{\\?"version_added\\?":\\?"([^"\\]*)\\?"/);
    if (!match) throw new Error('safari version_added not found in response');
    return match[1] === 'false' ? 'not supported' : match[1];
  } catch {
    return 'status not re-checked (fetch failed)';
  }
}

function verdictRow(row) {
  const nativeOverThreshold = row.nativeSupported && row.nativeCls !== null && row.nativeCls >= THRESHOLD;
  const geometryOverThreshold = row.geometryScore >= THRESHOLD;
  return geometryOverThreshold || nativeOverThreshold ? 'FAIL' : 'pass';
}

function buildTable(byEngine) {
  const chromiumRows = byEngine.chromium ?? [];
  const webkitRows = byEngine.webkit ?? [];

  const keyOf = (r) => `${r.page}|${r.width}|${r.scroll}|${r.variant}|${r.fallbackFamily}`;
  const webkitByKey = new Map(webkitRows.map((r) => [keyOf(r), r]));
  const chromiumByKey = new Map(chromiumRows.map((r) => [keyOf(r), r]));
  const allKeys = new Set([...chromiumByKey.keys(), ...webkitByKey.keys()]);

  const lines = [
    '| page | width | scroll | variant | fallback face | Chromium native CLS | Chromium geometry | WebKit geometry | verdict |',
    '|---|---|---|---|---|---|---|---|---|',
  ];

  const sortedKeys = [...allKeys].sort();
  let anyOverThreshold = false;

  for (const key of sortedKeys) {
    const c = chromiumByKey.get(key);
    const w = webkitByKey.get(key);
    const sample = c ?? w;
    const [page, width, scroll, variant, fallbackFamily] = key.split('|');

    const cNative = c ? (c.nativeSupported ? c.nativeCls.toFixed(4) : 'unsupported') : '—';
    const cGeo = c ? c.geometryScore.toFixed(4) : '—';
    const wGeo = w ? w.geometryScore.toFixed(4) : '—';

    const verdict = [c, w].filter(Boolean).some((r) => verdictRow(r) === 'FAIL') ? 'FAIL' : 'pass';
    if (verdict === 'FAIL') anyOverThreshold = true;

    lines.push(`| ${page} | ${width} | ${scroll} | ${variant} | ${fallbackFamily} | ${cNative} | ${cGeo} | ${wGeo} | ${verdict} |`);
    void sample;
  }

  return { table: lines.join('\n'), anyOverThreshold };
}

function facesExercised(rows) {
  return [...new Set(rows.map((r) => r.fallbackFamily).filter(Boolean))].sort();
}

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const byEngine = mergeFragments();
  const wk = webkitInfo();
  const chromiumVersion = (byEngine.chromium ?? [])[0]?.engineVersion ?? 'unknown';
  const webkitVersion = (byEngine.webkit ?? [])[0]?.engineVersion ?? wk.version;

  const caniuseDate = new Date().toISOString().slice(0, 10);
  const caniuseStatus = await fetchCaniuseSafariStatus();

  const { table, anyOverThreshold } = buildTable(byEngine);

  const chromiumFaces = facesExercised(byEngine.chromium ?? []);
  const webkitFaces = facesExercised(byEngine.webkit ?? []);
  const exercised = [...new Set([...chromiumFaces, ...webkitFaces])].sort();
  const notExercised = ALL_KNOWN_FACES.filter((f) => !exercised.includes(f));

  const maxScore = (rows) => (rows.length ? Math.max(...rows.map((r) => r.geometryScore)) : null);
  const chromiumMax = maxScore(byEngine.chromium ?? []);
  const webkitMax = maxScore(byEngine.webkit ?? []);

  const lines = [];
  lines.push(`# Font-Swap CLS Evidence (D-08, criterion 5)`);
  lines.push('');
  lines.push(`Chromium ${chromiumVersion}, WebKit (Playwright) ${webkitVersion}, ${wk.mode}.`);
  lines.push('');
  lines.push(
    'WebKit (Playwright) tracks WebKit trunk on Linux. It is not Safari on macOS or iOS. These results are not Safari verification.'
  );
  lines.push('');
  lines.push(
    `size-adjust is supported in Safari 17+. ascent-override, descent-override and line-gap-override are not in any shipped Safari (caniuse, checked ${caniuseDate}: ${caniuseStatus}). The size-adjust-only rows are the proxy for today's Safari readers.`
  );
  lines.push('');
  lines.push('## Swap matrix');
  lines.push('');
  lines.push(table);
  lines.push('');
  lines.push('## Fallback faces exercised');
  lines.push('');
  lines.push(`- Chromium: ${chromiumFaces.length ? chromiumFaces.join(', ') : 'none'}`);
  lines.push(`- WebKit (Playwright): ${webkitFaces.length ? webkitFaces.join(', ') : 'none'}`);
  lines.push('');
  lines.push('## Not exercised');
  lines.push('');
  if (notExercised.includes('Georgia')) {
    lines.push(
      '- Georgia — not installed on this Linux machine or in the Playwright image; covered only by capsize metric arithmetic. macOS, iOS and Windows readers get this face. A real-Safari / Georgia pass on a macOS or iOS device remains an open item.'
    );
  }
  for (const face of notExercised.filter((f) => f !== 'Georgia')) {
    lines.push(`- ${face} — not loadable via local() in either measured engine on this host.`);
  }
  if (notExercised.length === 0) {
    lines.push('- None — every known fallback face was exercised in at least one engine.');
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Chromium: max geometryScore = ${chromiumMax === null ? 'n/a' : chromiumMax.toFixed(4)}`);
  lines.push(`- WebKit (Playwright): max geometryScore = ${webkitMax === null ? 'n/a' : webkitMax.toFixed(4)}`);
  lines.push('');

  writeFileSync(path.join(EVIDENCE_DIR, 'font-cls.md'), lines.join('\n') + '\n', 'utf8');

  if (anyOverThreshold) {
    console.error('report-font-cls: at least one measured combination is at or above the 0.005 threshold — see design/evidence/font-cls.md');
    process.exit(1);
  }
  console.log('report-font-cls: all measured combinations under threshold; design/evidence/font-cls.md written');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
