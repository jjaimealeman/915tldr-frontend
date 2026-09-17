#!/usr/bin/env node
// D-15: measures every design/fixtures/spanish-stress.json component's real
// Spanish translation in the real production fonts, then builds and
// calibrates a synthetic +25% floor per component. Everything is measured
// in a real browser against the real style.css token layer — never
// recomputed from a byte or character count, which the acceptance checks
// below deliberately show disagrees with the measured width ratio.
//
// Usage:
//   node design/scripts/calibrate-spanish.mjs

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { startServer } from './serve-mockups.mjs';
import { blockThirdParty } from '../tests/support/harness.ts';
import { assertWebfontsInUse } from '../tests/support/fonts-in-use.ts';

const FIXTURE_PATH = path.resolve('design/fixtures/spanish-stress.json');

// D-15 (01-15): after 01-14's type-system change, these seven ids render
// headlines in Source Serif 4 Bold (--font-headline, weight 700); the
// standfirst deck moved to the body face, italic. Applied unconditionally on
// every run (independent of --only) so the fixture's fontRole field is never
// stale even when a run recalibrates only one component.
const HEADLINE_ROLE_IDS = new Set([
  'card-headline',
  'lead-headline',
  'category-masthead-title',
  'category-lead-headline',
  'article-headline',
  'changelog-title',
  'worst-case',
]);
const BODY_ROLE_OVERRIDE_IDS = new Set(['article-standfirst']);

// Sorted longest-first so the padding loop's "first word that fits" is
// always the longest word from PAD_WORDS that fits — see calibrateComponent.
const PAD_WORDS = [
  'comunicación',
  'información',
  'tradición',
  'educación',
  'después',
  'también',
  'Juárez',
  'según',
  'niños',
  'año',
  'más',
  'aún',
  'así',
  'sí',
  'él',
  'y',
].sort((a, b) => b.length - a.length);

/**
 * Renders `text` in an offscreen, hidden span using the real token-layer
 * font-family (`var(--font-<role>)`), the component's font-style, and (for
 * role "headline") the real headline weight token (`var(--weight-headline)`,
 * 700) rather than a browser-default 400 — a headline component measured at
 * the wrong weight is not measuring what actually ships. Fixed at a 100px
 * font-size so ratios are comparable across components regardless of the
 * fluid --step-* clamp() tokens. Returns the rendered width in CSS pixels.
 */
async function measureWidth(page, text, fontRole, fontStyle) {
  return page.evaluate(
    ({ text, fontRole, fontStyle }) => {
      const span = document.createElement('span');
      span.style.position = 'absolute';
      span.style.visibility = 'hidden';
      span.style.whiteSpace = 'nowrap';
      span.style.fontFamily = `var(--font-${fontRole})`;
      span.style.fontWeight = fontRole === 'headline' ? 'var(--weight-headline)' : '400';
      span.style.fontStyle = fontStyle;
      span.style.fontSize = '100px';
      span.textContent = text;
      document.body.appendChild(span);
      const width = span.getBoundingClientRect().width;
      span.remove();
      return width;
    },
    { text, fontRole, fontStyle }
  );
}

/**
 * Returns the deduped (family, style, weight) faces exercised by `components`
 * — Instrument Serif normal 400 only when a display-role component is
 * present, Source Serif 4 normal 400 / normal 700 / italic 400 as the roles
 * and styles actually in `components` require. Passed straight into
 * assertWebfontsInUse so the guard proves exactly (and only) the faces this
 * run is about to measure.
 */
function facesForComponents(components) {
  const faces = new Map();
  for (const comp of components) {
    const style = comp.fontStyle ?? 'normal';
    let family;
    let weight;
    if (comp.fontRole === 'display') {
      family = 'Instrument Serif';
      weight = '400';
    } else if (comp.fontRole === 'headline') {
      family = 'Source Serif 4';
      weight = '700';
    } else {
      family = 'Source Serif 4';
      weight = '400';
    }
    const key = `${family}|${style}|${weight}`;
    if (!faces.has(key)) faces.set(key, { family, style, weight });
  }
  return [...faces.values()];
}

/**
 * Proves every face in `faces` is actually rendering (not a fallback caught
 * mid font-display:optional block period) before any measurement runs —
 * delegates to fonts-in-use.ts's assertWebfontsInUse, the same guard the
 * spanish-overflow.spec.ts in-page widthRatio check uses, so a calibration
 * run and the test that consumes its numbers can never disagree about
 * whether the primary webfont was actually in use.
 */
async function assertPrimaryFontsLoaded(page, faces) {
  await assertWebfontsInUse(page, faces);
  console.log('calibrate-spanish: primary faces in use ->', JSON.stringify(faces));
}

function tokenize(text) {
  // Alternating [word, whitespace, word, whitespace, ...] — splitting with a
  // capturing group keeps whitespace (including embedded newlines/bullet
  // formatting in the longer summary components) as its own array element,
  // so trimming/padding only ever touches the trailing word, never the
  // interior formatting.
  return text.split(/(\s+)/);
}

function wordCount(tokens) {
  return tokens.filter((t) => t.trim().length > 0).length;
}

function popTrailingWord(tokens) {
  const next = [...tokens];
  while (next.length && next[next.length - 1].trim() === '') next.pop();
  next.pop();
  return next;
}

function pushWord(tokens, word) {
  return [...tokens, ' ', word];
}

function render(tokens) {
  return tokens.join('');
}

function graphemeCount(text) {
  const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' });
  return [...segmenter.segment(text.normalize('NFC'))].length;
}

function byteLength(text) {
  return Buffer.byteLength(text, 'utf8');
}

async function calibrateComponent(page, comp) {
  const fontRole = comp.fontRole;
  const fontStyle = comp.fontStyle ?? 'normal';
  const { en, es_real: esReal } = comp;

  if (!en.trim() || !esReal.trim()) {
    console.error(`calibrate-spanish: component "${comp.id}" has an empty en or es_real`);
    process.exit(1);
  }

  const enWidth = await measureWidth(page, en, fontRole, fontStyle);
  const aeiouWidth = await measureWidth(page, 'aeiou', fontRole, fontStyle);
  const g = aeiouWidth / 5 / enWidth;
  const hi = Math.max(1.3, 1.25 + 1.5 * g);

  let tokens = tokenize(esReal);
  let synthetic = render(tokens);
  let widthRatio = (await measureWidth(page, synthetic, fontRole, fontStyle)) / enWidth;

  // Trim from the end (never below one word) while over hi.
  while (widthRatio > hi && wordCount(tokens) > 1) {
    tokens = popTrailingWord(tokens);
    synthetic = render(tokens);
    widthRatio = (await measureWidth(page, synthetic, fontRole, fontStyle)) / enWidth;
  }

  // Pad greedily — the longest PAD_WORDS entry that keeps the ratio <= hi —
  // while under the 1.25 floor.
  while (widthRatio < 1.25) {
    let fitted = false;
    for (const word of PAD_WORDS) {
      const candidateTokens = pushWord(tokens, word);
      const candidateText = render(candidateTokens);
      const candidateRatio = (await measureWidth(page, candidateText, fontRole, fontStyle)) / enWidth;
      if (candidateRatio <= hi) {
        tokens = candidateTokens;
        synthetic = candidateText;
        widthRatio = candidateRatio;
        fitted = true;
        break;
      }
    }
    if (!fitted) {
      console.error(
        `calibrate-spanish: component "${comp.id}" — no PAD_WORDS entry fits within hi=${hi.toFixed(4)} (stuck at widthRatio=${widthRatio.toFixed(4)})`
      );
      process.exit(1);
    }
  }

  if (widthRatio < 1.25 || widthRatio > hi) {
    console.error(
      `calibrate-spanish: component "${comp.id}" — final widthRatio ${widthRatio.toFixed(4)} outside [1.25, ${hi.toFixed(4)}]`
    );
    process.exit(1);
  }

  // The length-driven pad loop above only runs while widthRatio < 1.25 — a
  // real Spanish translation that is already >= 1.25 without any padding
  // (e.g. a short, accent-free phrase like "Saltar al contenido") would
  // otherwise never touch PAD_WORDS at all, and PERF-07's Spanish-diacritic
  // subset would go unexercised for that component. Force one pad word in
  // that case too — still gated by the same hi ceiling and the same
  // "longest word that fits" rule — rather than silently accepting an
  // all-ASCII synthetic string.
  if (!/[^\x00-\x7F]/.test(synthetic)) {
    let fitted = false;
    for (const word of PAD_WORDS) {
      const candidateTokens = pushWord(tokens, word);
      const candidateText = render(candidateTokens);
      const candidateRatio = (await measureWidth(page, candidateText, fontRole, fontStyle)) / enWidth;
      if (candidateRatio <= hi) {
        tokens = candidateTokens;
        synthetic = candidateText;
        widthRatio = candidateRatio;
        fitted = true;
        break;
      }
    }
    if (!fitted) {
      console.error(
        `calibrate-spanish: component "${comp.id}" — es_real has no diacritics and no PAD_WORDS entry fits within hi=${hi.toFixed(4)} without a diacritic-bearing word`
      );
      process.exit(1);
    }
  }

  if (!/[^\x00-\x7F]/.test(synthetic)) {
    console.error(
      `calibrate-spanish: component "${comp.id}" — es_synthetic has no character outside ASCII (no real diacritics exercised)`
    );
    process.exit(1);
  }

  return {
    ...comp,
    es_synthetic: synthetic,
    calibration: {
      widthRatio,
      hi,
      graphemeRatio: graphemeCount(synthetic) / graphemeCount(en),
      utf8ByteRatio: byteLength(synthetic) / byteLength(en),
    },
  };
}

/**
 * Parses `--only=<id>[,<id>...]` from argv. Returns null when the flag is
 * absent (meaning "recalibrate every component").
 */
function parseOnlyArg(argv) {
  const arg = argv.find((a) => a.startsWith('--only='));
  if (!arg) return null;
  return arg
    .slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const onlyIds = parseOnlyArg(process.argv.slice(2));

  const raw = await readFile(FIXTURE_PATH, 'utf8');
  const fixture = JSON.parse(raw);

  const allIds = new Set(fixture.components.map((c) => c.id));
  if (onlyIds) {
    const unknown = onlyIds.filter((id) => !allIds.has(id));
    if (unknown.length > 0) {
      console.error(`calibrate-spanish: unknown component id(s) in --only: ${unknown.join(', ')}`);
      process.exit(1);
    }
  }
  const targetIds = onlyIds ? new Set(onlyIds) : allIds;

  // Role overrides are unconditional — applied every run, regardless of
  // --only, so the fixture's fontRole field is never left stale just because
  // a run only recalibrated one component's widthRatio/es_synthetic.
  for (const comp of fixture.components) {
    if (HEADLINE_ROLE_IDS.has(comp.id)) {
      comp.fontRole = 'headline';
    } else if (BODY_ROLE_OVERRIDE_IDS.has(comp.id)) {
      comp.fontRole = 'body';
    }
  }

  const { url, close } = await startServer({ port: 0 });
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    // No third-party network access is needed for measurement — route
    // everything except 127.0.0.1 to abort, same guard used by the D-08
    // font-swap harness (01-02), satisfying this task's own no-network
    // acceptance criterion.
    blockThirdParty(page);

    await page.goto(`${url}/mockups/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);

    const targetComponents = fixture.components.filter((c) => targetIds.has(c.id));
    await assertPrimaryFontsLoaded(page, facesForComponents(targetComponents));

    const calibratedComponents = [];
    let recalibratedCount = 0;
    for (const comp of fixture.components) {
      if (!targetIds.has(comp.id)) {
        calibratedComponents.push(comp);
        continue;
      }
      const result = await calibrateComponent(page, comp);
      calibratedComponents.push(result);
      recalibratedCount += 1;
      console.log(
        `calibrate-spanish: ${comp.id} widthRatio=${result.calibration.widthRatio.toFixed(4)} hi=${result.calibration.hi.toFixed(4)}`
      );
    }

    fixture.components = calibratedComponents;

    await writeFile(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
    console.log(`calibrate-spanish: wrote ${fixture.components.length} component(s) (${recalibratedCount} recalibrated) to ${FIXTURE_PATH}`);
  } finally {
    await browser.close();
    await close();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
