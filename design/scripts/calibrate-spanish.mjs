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

const FIXTURE_PATH = path.resolve('design/fixtures/spanish-stress.json');

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

const PRIMARY_FAMILIES = ['Instrument Serif', 'Source Serif 4'];

/**
 * Renders `text` in an offscreen, hidden span using the real token-layer
 * font-family (`var(--font-<role>)`) and the component's font-style, at a
 * fixed 100px font-size so ratios are comparable across components
 * regardless of the fluid --step-* clamp() tokens. Returns the rendered
 * width in CSS pixels.
 */
async function measureWidth(page, text, fontRole, fontStyle) {
  return page.evaluate(
    ({ text, fontRole, fontStyle }) => {
      const span = document.createElement('span');
      span.style.position = 'absolute';
      span.style.visibility = 'hidden';
      span.style.whiteSpace = 'nowrap';
      span.style.fontFamily = `var(--font-${fontRole})`;
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
 * Asserts every primary face (normal + italic, both families) reaches
 * 'loaded' — never merely relying on document.fonts.ready, since an unused
 * variant correctly stays 'unloaded' until `load()` is called for it
 * (01-02's geometry.ts establishes this pattern).
 */
async function assertPrimaryFontsLoaded(page) {
  const result = await page.evaluate(async (families) => {
    const statusByFace = {};
    for (const family of families) {
      for (const style of ['normal', 'italic']) {
        const key = `${family} ${style}`;
        try {
          await document.fonts.load(`${style} 1em "${family}"`);
        } catch {
          // status check below reports the outcome either way
        }
        const faces = [...document.fonts].filter(
          (f) => f.family === family && f.style === style
        );
        statusByFace[key] = faces.map((f) => f.status);
      }
    }
    return statusByFace;
  }, PRIMARY_FAMILIES);

  for (const [key, statuses] of Object.entries(result)) {
    const anyLoaded = statuses.some((s) => s === 'loaded');
    if (!anyLoaded) {
      throw new Error(
        `calibrate-spanish: primary face "${key}" never reached "loaded" (saw: ${JSON.stringify(statuses)}) — only fallback faces would be measured`
      );
    }
  }
  console.log('calibrate-spanish: primary faces loaded ->', JSON.stringify(result));
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

async function main() {
  const raw = await readFile(FIXTURE_PATH, 'utf8');
  const fixture = JSON.parse(raw);

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
    await assertPrimaryFontsLoaded(page);

    const calibratedComponents = [];
    for (const comp of fixture.components) {
      const result = await calibrateComponent(page, comp);
      calibratedComponents.push(result);
      console.log(
        `calibrate-spanish: ${comp.id} widthRatio=${result.calibration.widthRatio.toFixed(4)} hi=${result.calibration.hi.toFixed(4)}`
      );
    }

    fixture.components = calibratedComponents;

    await writeFile(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
    console.log(`calibrate-spanish: wrote ${calibratedComponents.length} calibrated component(s) to ${FIXTURE_PATH}`);
  } finally {
    await browser.close();
    await close();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
