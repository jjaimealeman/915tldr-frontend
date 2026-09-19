#!/usr/bin/env node
// D-08/criterion-5: merges every design/.cache/font-cls-fragments/<engine>__
// <page>__<width>.json fragment (written by font-cls.spec.ts, one file per
// (page,width) test so parallel workers never race on a shared file) into
// the canonical design/.cache/font-cls-<engine>.json per engine, plus the
// separate <engine>__control.json positive-control fragment into
// design/.cache/font-cls-control.json, then writes design/evidence/font-cls.md
// — the full swap-matrix evidence table, the positive-control results, and
// the WebKit/Safari caveats T-01-29 requires. Exits non-zero if any matrix
// combination breaches the 0.005 threshold, carries a stale (pre-D-GAP-A)
// schema, or if the Chromium positive control fails to prove the instrument
// can still detect a real swap — so this script is itself an enforcement
// gate (same philosophy as check-contrast.mjs), not just a report generator.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = { fragments: null, outDir: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--fragments=')) args.fragments = arg.slice('--fragments='.length);
    else if (arg === '--fragments' && argv[i + 1]) args.fragments = argv[++i];
    else if (arg.startsWith('--out-dir=')) args.outDir = arg.slice('--out-dir='.length);
    else if (arg === '--out-dir' && argv[i + 1]) args.outDir = argv[++i];
  }
  return args;
}

const cliArgs = parseArgs(process.argv.slice(2));

const CACHE_DIR = cliArgs.outDir ? path.resolve(cliArgs.outDir) : path.resolve('design/.cache');
const FRAGMENTS_DIR = cliArgs.fragments ? path.resolve(cliArgs.fragments) : path.resolve('design/.cache/font-cls-fragments');
const EVIDENCE_DIR = cliArgs.outDir ? path.resolve(cliArgs.outDir) : path.resolve('design/evidence');
const WEBKIT_MODE_PATH = path.resolve('design/.webkit-mode.json');
const CANIUSE_URL = 'https://caniuse.com/mdn-css_at-rules_font-face_ascent-override';
const CANIUSE_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const THRESHOLD = 0.005;

/** Fallback faces this project's font pipeline can ever exercise (build-fonts.mjs/01-02). */
const ALL_KNOWN_FACES = ['Georgia', 'Noto Serif', 'Times New Roman'];

const REQUIRED_FIELDS = ['pathObserved', 'fontDisplay', 'referenceNativeCls'];
const VALID_PATHS = new Set(['fallback-kept', 'webfont-at-first-paint']);

function mergeFragments() {
  mkdirSync(FRAGMENTS_DIR, { recursive: true });
  const byEngineMatrix = {};
  const byEngineControl = {};
  const staleRows = [];

  for (const entry of readdirSync(FRAGMENTS_DIR)) {
    if (!entry.endsWith('.json')) continue;
    const parts = entry.replace(/\.json$/, '').split('__');
    const engine = parts[0];
    if (!engine) continue;
    const isControl = parts[1] === 'control';
    const rows = JSON.parse(readFileSync(path.join(FRAGMENTS_DIR, entry), 'utf8'));

    if (isControl) {
      byEngineControl[engine] = byEngineControl[engine] ?? [];
      byEngineControl[engine].push(...rows);
      continue;
    }

    for (const row of rows) {
      for (const field of REQUIRED_FIELDS) {
        if (!(field in row)) {
          staleRows.push({ file: entry, missing: field, row });
        }
      }
    }

    byEngineMatrix[engine] = byEngineMatrix[engine] ?? [];
    byEngineMatrix[engine].push(...rows);
  }

  // Stale rows are never silently ignored, and never partially written --
  // main() exits before touching any output when staleRows is non-empty, so
  // check first and skip every write below in that case.
  if (staleRows.length === 0) {
    for (const [engine, rows] of Object.entries(byEngineMatrix)) {
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
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(path.join(CACHE_DIR, `font-cls-${engine}.json`), JSON.stringify(rows, null, 2) + '\n', 'utf8');
    }
  }

  const controlRows = Object.entries(byEngineControl).flatMap(([engine, rows]) =>
    rows.map((r) => ({ ...r, engine: r.engine ?? engine }))
  );
  if (staleRows.length === 0 && controlRows.length > 0) {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(path.join(CACHE_DIR, 'font-cls-control.json'), JSON.stringify(controlRows, null, 2) + '\n', 'utf8');
  }

  return { byEngineMatrix, byEngineControl, staleRows };
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

/** A matrix row is a THRESHOLD/schema breach — gates the run. */
function rowBreach(row) {
  const reasons = [];
  if (row.geometryScore >= THRESHOLD) reasons.push(`geometryScore ${row.geometryScore.toFixed(4)} >= ${THRESHOLD}`);
  if (row.nativeSupported && row.nativeCls !== null && row.nativeCls >= THRESHOLD) {
    reasons.push(`nativeCls ${row.nativeCls.toFixed(4)} >= ${THRESHOLD}`);
  }
  if (row.referenceNativeCls !== null && row.referenceNativeCls !== undefined && row.referenceNativeCls >= THRESHOLD) {
    reasons.push(`referenceNativeCls ${row.referenceNativeCls.toFixed(4)} >= ${THRESHOLD}`);
  }
  if (!VALID_PATHS.has(row.pathObserved)) reasons.push(`pathObserved "${row.pathObserved}" not in {fallback-kept, webfont-at-first-paint}`);
  if (row.fontDisplay !== 'optional') reasons.push(`fontDisplay "${row.fontDisplay}" !== optional`);
  return reasons;
}

function verdictRow(row) {
  return rowBreach(row).length > 0 ? 'FAIL' : 'pass';
}

function buildTable(byEngine) {
  const chromiumRows = byEngine.chromium ?? [];
  const webkitRows = byEngine.webkit ?? [];

  const keyOf = (r) => `${r.page}|${r.width}|${r.scroll}|${r.variant}|${r.fallbackFamily}`;
  const webkitByKey = new Map(webkitRows.map((r) => [keyOf(r), r]));
  const chromiumByKey = new Map(chromiumRows.map((r) => [keyOf(r), r]));
  const allKeys = new Set([...chromiumByKey.keys(), ...webkitByKey.keys()]);

  const lines = [
    '| page | width | scroll | variant | fallback face | font-display | path | Chromium native CLS | Chromium geometry | Chromium ref. native CLS | WebKit geometry | WebKit ref. native CLS | verdict |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];

  const sortedKeys = [...allKeys].sort();
  const breachedRows = [];

  for (const key of sortedKeys) {
    const c = chromiumByKey.get(key);
    const w = webkitByKey.get(key);
    const [page, width, scroll, variant, fallbackFamily] = key.split('|');

    const cNative = c ? (c.nativeSupported ? c.nativeCls.toFixed(4) : 'unsupported') : '—';
    const cGeo = c ? c.geometryScore.toFixed(4) : '—';
    const cRefCls = c && c.referenceNativeCls !== null && c.referenceNativeCls !== undefined ? c.referenceNativeCls.toFixed(4) : c ? 'unsupported' : '—';
    const wGeo = w ? w.geometryScore.toFixed(4) : '—';
    const wRefCls = w && w.referenceNativeCls !== null && w.referenceNativeCls !== undefined ? w.referenceNativeCls.toFixed(4) : w ? 'unsupported' : '—';
    const fontDisplay = (c ?? w)?.fontDisplay ?? '—';
    const pathObserved = (c ?? w)?.pathObserved ?? '—';

    const cBreach = c ? rowBreach(c) : [];
    const wBreach = w ? rowBreach(w) : [];
    const verdict = cBreach.length || wBreach.length ? 'FAIL' : 'pass';
    if (cBreach.length) breachedRows.push({ engine: 'chromium', key, reasons: cBreach });
    if (wBreach.length) breachedRows.push({ engine: 'webkit', key, reasons: wBreach });

    lines.push(
      `| ${page} | ${width} | ${scroll} | ${variant} | ${fallbackFamily} | ${fontDisplay} | ${pathObserved} | ${cNative} | ${cGeo} | ${cRefCls} | ${wGeo} | ${wRefCls} | ${verdict} |`
    );
  }

  return { table: lines.join('\n'), breachedRows };
}

function buildControlTable(byEngineControl) {
  const lines = ['| engine | prePaintObserved | pathObserved | geometryScore | verdict |', '|---|---|---|---|---|'];
  const notes = [];
  let chromiumOk = false;
  let sawChromiumControl = false;

  for (const engine of ['chromium', 'webkit']) {
    const rows = byEngineControl[engine] ?? [];
    if (rows.length === 0) {
      lines.push(`| ${engine} | — | — | — | missing |`);
      continue;
    }
    const row = rows[0];
    if (engine === 'chromium') sawChromiumControl = true;

    if (!row.prePaintObserved) {
      lines.push(`| ${engine} | false | ${row.pathObserved} | ${row.geometryScore.toFixed(4)} | not observable |`);
      notes.push(`${engine}: control not observable in this engine (no pre-release paint).`);
      continue;
    }

    const ok = row.pathObserved === 'swapped' && row.geometryScore >= THRESHOLD;
    if (engine === 'chromium') chromiumOk = ok;
    lines.push(`| ${engine} | true | ${row.pathObserved} | ${row.geometryScore.toFixed(4)} | ${ok ? 'detected' : 'BLIND'} |`);
  }

  return { table: lines.join('\n'), notes, chromiumOk, sawChromiumControl };
}

function facesExercised(rows) {
  return [...new Set(rows.map((r) => r.fallbackFamily).filter(Boolean))].sort();
}

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const { byEngineMatrix, byEngineControl, staleRows } = mergeFragments();
  const wk = webkitInfo();
  const chromiumVersion = (byEngineMatrix.chromium ?? [])[0]?.engineVersion ?? 'unknown';
  const webkitVersion = (byEngineMatrix.webkit ?? [])[0]?.engineVersion ?? wk.version;

  if (staleRows.length > 0) {
    for (const s of staleRows) {
      console.error(
        `report-font-cls: stale-schema fragment ${s.file} is missing "${s.missing}" — a full re-run is needed (this row predates D-GAP-A's pathObserved/fontDisplay/referenceNativeCls fields).`
      );
    }
    process.exit(1);
  }

  const caniuseDate = new Date().toISOString().slice(0, 10);
  const caniuseStatus = await fetchCaniuseSafariStatus();

  const { table, breachedRows } = buildTable(byEngineMatrix);
  const { table: controlTable, notes: controlNotes, chromiumOk, sawChromiumControl } = buildControlTable(byEngineControl);

  const chromiumFaces = facesExercised(byEngineMatrix.chromium ?? []);
  const webkitFaces = facesExercised(byEngineMatrix.webkit ?? []);
  const exercised = [...new Set([...chromiumFaces, ...webkitFaces])].sort();
  const notExercised = ALL_KNOWN_FACES.filter((f) => !exercised.includes(f));

  const maxScore = (rows) => (rows.length ? Math.max(...rows.map((r) => r.geometryScore)) : null);
  const chromiumMax = maxScore(byEngineMatrix.chromium ?? []);
  const webkitMax = maxScore(byEngineMatrix.webkit ?? []);

  const prePaintNotes = [];
  for (const engine of ['chromium', 'webkit']) {
    const rows = byEngineMatrix[engine] ?? [];
    if (rows.length === 0) continue;
    const values = [...new Set(rows.map((r) => r.prePaintObserved))];
    prePaintNotes.push(
      `- ${engine === 'chromium' ? 'Chromium' : 'WebKit (Playwright)'}: prePaintObserved was ${values.length === 1 ? String(values[0]) : 'mixed (' + values.join(', ') + ')'} across the matrix.`
    );
  }

  const lines = [];
  lines.push(`# Font-Swap CLS Evidence (D-08, criterion 5)`);
  lines.push('');
  lines.push(`Chromium ${chromiumVersion}, WebKit (Playwright) ${webkitVersion}, ${wk.mode}.`);
  lines.push('');
  lines.push(
    'Strategy: `font-display: optional` with `<link rel="preload">` for the above-the-fold primary faces (owner decision D-GAP-A, 2026-09-17, PRD §6.5 amended). Each page view renders either the primary webfont from first paint (the face was ready before the block period elapsed) or the metric-compatible fallback throughout the rest of that view — there is no mid-render swap, so no swap-triggered layout shift.'
  );
  lines.push('');
  lines.push(
    'The two user-visible paths this matrix classifies (`pathObserved`) are `fallback-kept` (the webfont missed the block period; the fallback face renders for the whole view) and `webfont-at-first-paint` (the webfont was ready in time; it renders from the very first frame). Neither path involves a visible transition. Each load is classified by comparing its own before/after layout snapshots against a REFERENCE load of the same page/width/theme/scroll/variant/fallback combination with no artificial network hold — a plain load whose primary webfont is proven in use (`assertWebfontsInUse`) before its snapshot and native CLS (`referenceNativeCls`) are trusted as the "what does a correctly-rendered webfont-first view of this exact combination look like" baseline.'
  );
  lines.push('');
  lines.push(
    'WebKit (Playwright) tracks WebKit trunk on Linux. It is not Safari on macOS or iOS. These results are not Safari verification.'
  );
  lines.push('');
  lines.push(
    `size-adjust is supported in Safari 17+. ascent-override, descent-override and line-gap-override are not in any shipped Safari (caniuse, checked ${caniuseDate}: ${caniuseStatus}). The size-adjust-only rows are the proxy for today's Safari readers.`
  );
  lines.push('');
  lines.push(
    "Georgia is not installed on this Linux development host (nor in the pinned WebKit Docker image), so it is not exercised by either engine below — covered only by capsize's metric arithmetic. A real macOS/iOS/Windows/Safari pass remains an open item (WINDOWS.md entry 1)."
  );
  lines.push('');
  lines.push('## Swap matrix');
  lines.push('');
  lines.push(table);
  lines.push('');
  lines.push('## Positive control');
  lines.push('');
  lines.push(
    'Proves the instrument is not blind: the same index@320px/scroll=mid load, measured with every `font-display` descriptor in the fonts region rewritten to `swap` for this one load only (the `swap-control` variant), must show a REAL swap when the engine has a pre-release paint to diff against.'
  );
  lines.push('');
  lines.push(controlTable);
  if (controlNotes.length > 0) {
    lines.push('');
    for (const note of controlNotes) lines.push(`- ${note}`);
  }
  lines.push('');
  lines.push('## Per-engine prePaintObserved');
  lines.push('');
  for (const note of prePaintNotes) lines.push(note);
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
  lines.push(
    'Under font-display: swap (01-09) the same matrix measured geometry scores up to 1.19 (WebKit) and 0.70 (Chromium); superseded by D-GAP-A.'
  );
  lines.push('');

  writeFileSync(path.join(EVIDENCE_DIR, 'font-cls.md'), lines.join('\n') + '\n', 'utf8');

  let failed = false;

  if (breachedRows.length > 0) {
    for (const b of breachedRows) {
      console.error(`report-font-cls: ${b.engine} ${b.key} breach: ${b.reasons.join('; ')}`);
    }
    failed = true;
  }

  if (!sawChromiumControl || !chromiumOk) {
    console.error(
      'report-font-cls: instrument blind — cannot certify zero shift (no Chromium positive control row, or the Chromium control did not detect a swap >= threshold)'
    );
    failed = true;
  }

  if (failed) {
    console.error('report-font-cls: gate FAILED — see design/evidence/font-cls.md');
    process.exit(1);
  }

  console.log('report-font-cls: all measured combinations under threshold, positive control verified; design/evidence/font-cls.md written');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
