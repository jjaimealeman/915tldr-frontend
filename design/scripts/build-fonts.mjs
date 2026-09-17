#!/usr/bin/env node
// PERF-07 / D-08: crawls the finished mockups (+ any Spanish stress fixture)
// for the glyphs actually rendered, subsets the two type families to exactly
// that set with subset-font, generates capsize metric-compatible fallback
// faces, and (re)writes the fonts:start/fonts:end region of style.css plus
// design/mockups/fonts/*. Idempotent: a second run with no source changes
// leaves style.css byte-identical (no timestamp anywhere in its output).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import subsetFont from 'subset-font';
import { createFontStack } from '@capsizecss/core';

import instrumentSerifRegular from '@capsizecss/metrics/instrumentSerif';
import instrumentSerifItalic from '@capsizecss/metrics/instrumentSerif/italic';
import sourceSerif4Regular from '@capsizecss/metrics/sourceSerif4';
import sourceSerif4Italic from '@capsizecss/metrics/sourceSerif4/italic';
import sourceSerif4Bold from '@capsizecss/metrics/sourceSerif4/700';
import georgiaRegular from '@capsizecss/metrics/georgia';
import georgiaItalic from '@capsizecss/metrics/georgia/italic';
import georgiaBold from '@capsizecss/metrics/georgia/700';
import notoSerifRegular from '@capsizecss/metrics/notoSerif';
import notoSerifItalic from '@capsizecss/metrics/notoSerif/italic';
import notoSerifBold from '@capsizecss/metrics/notoSerif/700';
import timesNewRomanRegular from '@capsizecss/metrics/timesNewRoman';
import timesNewRomanItalic from '@capsizecss/metrics/timesNewRoman/italic';
import timesNewRomanBold from '@capsizecss/metrics/timesNewRoman/700';

import { chromium } from '@playwright/test';
import { startServer } from './serve-mockups.mjs';
import { FILES as FONT_SOURCE_FILES } from './fetch-fonts.mjs';
import { SPANISH_BASELINE, collectPageText, closeOverCase } from './lib/glyphs.mjs';

const FONTS_SRC_DIR = path.resolve('design/fonts-src');
const MOCKUPS_DIR = path.resolve('design/mockups');
const FONTS_OUT_DIR = path.join(MOCKUPS_DIR, 'fonts');
const STYLE_CSS_PATH = path.join(MOCKUPS_DIR, 'style.css');
const SPANISH_STRESS_PATH = path.resolve('design/fixtures/spanish-stress.json');
const MAX_BYTES = 150000;
const MAX_RATIO = 0.25;

// Owner decision D-GAP-A (2026-09-17, .planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md):
// PRD §6.5 reopened from font-display: swap to font-display: optional (preloads
// kept). Under optional, a page view either renders the webfont from first
// paint or keeps the fallback for the whole view -- no mid-render swap, and so
// no swap-triggered layout shift. Used for every primary @font-face block and
// for capsize's fallback-face fontDisplay so the whole fonts region is
// consistent.
const FONT_DISPLAY = 'optional';

// ---- Step 1-4: build the glyph set ----

function collectFixtureStrings(value, acc) {
  if (typeof value === 'string') {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectFixtureStrings(v, acc);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectFixtureStrings(v, acc);
  }
}

async function crawlGlyphSet() {
  const server = await startServer({ port: 0 });
  const browser = await chromium.launch();
  const collected = [];

  try {
    const page = await browser.newPage();
    const pageFiles = readdirSync(MOCKUPS_DIR).filter((f) => f.endsWith('.html'));
    for (const file of pageFiles) {
      const response = await page.goto(`${server.url}/mockups/${file}`);
      if (!response || response.status() !== 200) {
        throw new Error(`build-fonts: failed to load ${file} for glyph crawl (status ${response?.status()})`);
      }
      const text = await page.evaluate(collectPageText);
      collected.push(text);
    }
  } finally {
    await browser.close();
    await server.close();
  }

  if (existsSync(SPANISH_STRESS_PATH)) {
    const fixture = JSON.parse(readFileSync(SPANISH_STRESS_PATH, 'utf8'));
    for (const key of ['en', 'es_real', 'es_synthetic']) {
      if (key in fixture) collectFixtureStrings(fixture[key], collected);
    }
  }

  collected.push(SPANISH_BASELINE);

  const closed = closeOverCase(collected.join(''));
  const uniqueSorted = [...new Set([...closed])]
    // Crawled innerText/JSON fixture text can carry control characters
    // (newlines, tabs) that have no glyph and no place in a font subset.
    .filter((ch) => {
      const cp = ch.codePointAt(0);
      return cp >= 0x20 && cp !== 0x7f;
    })
    .sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  return uniqueSorted.join('');
}

// ---- Step 5-8: subset + manifest ----

const SUBSET_JOBS = [
  {
    sourceFile: 'InstrumentSerif-Regular.ttf',
    outFile: 'InstrumentSerif-Regular.woff2',
    variationAxes: undefined,
  },
  {
    sourceFile: 'InstrumentSerif-Italic.ttf',
    outFile: 'InstrumentSerif-Italic.woff2',
    variationAxes: undefined,
  },
  {
    sourceFile: 'SourceSerif4%5Bopsz%2Cwght%5D.ttf',
    outFile: 'SourceSerif4-Roman.woff2',
    variationAxes: { wght: { min: 400, max: 700 } },
  },
  {
    sourceFile: 'SourceSerif4-Italic%5Bopsz%2Cwght%5D.ttf',
    outFile: 'SourceSerif4-Italic.woff2',
    variationAxes: { wght: { min: 400, max: 700 } },
  },
];

async function buildSubsets(subsetText) {
  mkdirSync(FONTS_OUT_DIR, { recursive: true });
  const faces = [];

  for (const job of SUBSET_JOBS) {
    const sourcePath = path.join(FONTS_SRC_DIR, job.sourceFile);
    const sourceBuffer = readFileSync(sourcePath);
    const subsetBuffer = await subsetFont(sourceBuffer, subsetText, {
      targetFormat: 'woff2',
      ...(job.variationAxes ? { variationAxes: job.variationAxes } : {}),
    });

    const bytes = subsetBuffer.length;
    const sourceBytes = sourceBuffer.length;
    const ratio = bytes / sourceBytes;

    writeFileSync(path.join(FONTS_OUT_DIR, job.outFile), subsetBuffer);
    faces.push({
      file: job.outFile,
      bytes,
      sourceBytes,
      ratio,
      axes: job.variationAxes ?? null,
    });
  }

  return faces;
}

function copyLicenses() {
  for (const name of ['OFL-InstrumentSerif.txt', 'OFL-SourceSerif4.txt']) {
    const src = path.join(FONTS_SRC_DIR, name);
    const dest = path.join(FONTS_OUT_DIR, name);
    writeFileSync(dest, readFileSync(src));
  }
}

function writeManifest(subsetText, faces) {
  const codepoints = [...subsetText].map((ch) => ch.codePointAt(0).toString(16).toUpperCase());
  const glyphSetSha256 = createHash('sha256').update(subsetText, 'utf8').digest('hex');

  const sources = FONT_SOURCE_FILES.filter((f) => f.repoPath.endsWith('.ttf')).map((f) => ({
    file: f.outName,
    gitBlobSha: f.sha1,
    commit: f.commit,
  }));

  const manifest = {
    sources,
    glyphSetSha256,
    codepoints,
    chars: subsetText,
    faces,
  };

  writeFileSync(
    path.join(FONTS_OUT_DIR, 'subset-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8'
  );

  return manifest;
}

// ---- Fallback faces (capsize) ----

const KEBAB_ORDER = [
  'fontFamily',
  'src',
  'fontStyle',
  'fontWeight',
  'fontDisplay',
  'ascentOverride',
  'descentOverride',
  'lineGapOverride',
  'sizeAdjust',
];

function toKebab(key) {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function serializeFontFace(props) {
  const lines = ['@font-face {'];
  for (const key of KEBAB_ORDER) {
    if (!(key in props)) continue;
    lines.push(`  ${toKebab(key)}: ${props[key]};`);
  }
  lines.push('}');
  return lines.join('\n');
}

// For each style/weight combination that needs the Times-metric fallback,
// the local() list of real installed full names covering Times New Roman
// (Windows), Liberation Serif and Tinos (this project's Linux dev/CI hosts;
// Liberation Serif 2.x derives from Tinos, and both share timesNewRoman's
// capsize metrics — see 01-RESEARCH.md correction 4).
const TIMES_LOCAL_NAMES = {
  regular: ["local('Times New Roman')", "local('Liberation Serif')", "local('Tinos')"],
  italic: [
    "local('Times New Roman Italic')",
    "local('Liberation Serif Italic')",
    "local('Tinos Italic')",
  ],
  bold: [
    "local('Times New Roman Bold')",
    "local('Liberation Serif Bold')",
    "local('Tinos Bold')",
  ],
};

function timesVariantFor(style, weight) {
  if (style === 'italic') return 'italic';
  if (weight === 700) return 'bold';
  return 'regular';
}

/**
 * Builds one primary type role's fallback stack: [primary, georgia, notoSerif,
 * timesNewRoman] metrics through capsize, with the Times-metric face's `src`
 * replaced by the real local() names above. Returns { fontFamily, fontFaces }
 * where fontFaces is an array of already-serialised @font-face CSS blocks.
 */
function buildFallbackStack(primaryMetrics, fallbackMetrics, style, fontWeight) {
  const { fontFamily, fontFaces } = createFontStack(
    [primaryMetrics, fallbackMetrics.georgia, fallbackMetrics.notoSerif, fallbackMetrics.timesNewRoman],
    {
      fontFaceFormat: 'styleObject',
      fontFaceProperties: { fontStyle: style, fontWeight, fontDisplay: FONT_DISPLAY },
    }
  );

  const variant = timesVariantFor(style, fontWeight);
  const blocks = fontFaces.map((face, index) => {
    const props = { ...face['@font-face'] };
    const isTimesFace = index === fontFaces.length - 1; // timesNewRoman passed last
    if (isTimesFace) {
      props.src = TIMES_LOCAL_NAMES[variant].join(', ');
    }
    return serializeFontFace(props);
  });

  return { fontFamily, blocks };
}

function buildFallbacksAndRoot() {
  const georgiaByWeight = { 400: { s: georgiaRegular, i: georgiaItalic }, 700: { s: georgiaBold } };
  const notoByWeight = { 400: { s: notoSerifRegular, i: notoSerifItalic }, 700: { s: notoSerifBold } };
  const timesByWeight = {
    400: { s: timesNewRomanRegular, i: timesNewRomanItalic },
    700: { s: timesNewRomanBold },
  };

  const primaryFaces = [
    { metrics: instrumentSerifRegular, style: 'normal', weight: 400, role: 'display' },
    { metrics: instrumentSerifItalic, style: 'italic', weight: 400, role: 'display' },
    { metrics: sourceSerif4Regular, style: 'normal', weight: 400, role: 'body' },
    { metrics: sourceSerif4Italic, style: 'italic', weight: 400, role: 'body' },
    { metrics: sourceSerif4Bold, style: 'normal', weight: 700, role: 'body' },
  ];

  const allBlocks = [];
  let displayFamily = null;
  let bodyFamily = null;

  for (const face of primaryFaces) {
    const fallbackMetrics = {
      georgia: face.style === 'italic' ? georgiaByWeight[face.weight].i : georgiaByWeight[face.weight].s,
      notoSerif: face.style === 'italic' ? notoByWeight[face.weight].i : notoByWeight[face.weight].s,
      timesNewRoman: face.style === 'italic' ? timesByWeight[face.weight].i : timesByWeight[face.weight].s,
    };
    const { fontFamily, blocks } = buildFallbackStack(face.metrics, fallbackMetrics, face.style, face.weight);
    allBlocks.push(...blocks);

    // The primary (400, normal) pass of each role fixes --font-display /
    // --font-body: identical fontFamily string is returned for every
    // style/weight pass of the same role since createFontStack derives it
    // from familyName only, but we only need to capture it once.
    if (face.role === 'display' && displayFamily === null) displayFamily = fontFamily;
    if (face.role === 'body' && bodyFamily === null) bodyFamily = fontFamily;
  }

  return { fallbackBlocks: allBlocks, displayFamily, bodyFamily };
}

// ---- Primary @font-face rules + region assembly ----

function primaryFontFaceBlocks() {
  return [
    serializeFontFace({
      fontFamily: '"Instrument Serif"',
      src: 'url("fonts/InstrumentSerif-Regular.woff2") format("woff2")',
      fontWeight: '400',
      fontStyle: 'normal',
      fontDisplay: FONT_DISPLAY,
    }),
    serializeFontFace({
      fontFamily: '"Instrument Serif"',
      src: 'url("fonts/InstrumentSerif-Italic.woff2") format("woff2")',
      fontWeight: '400',
      fontStyle: 'italic',
      fontDisplay: FONT_DISPLAY,
    }),
    serializeFontFace({
      fontFamily: '"Source Serif 4"',
      src: 'url("fonts/SourceSerif4-Roman.woff2") format("woff2")',
      fontWeight: '400 700',
      fontStyle: 'normal',
      fontDisplay: FONT_DISPLAY,
    }),
    serializeFontFace({
      fontFamily: '"Source Serif 4"',
      src: 'url("fonts/SourceSerif4-Italic.woff2") format("woff2")',
      fontWeight: '400 700',
      fontStyle: 'italic',
      fontDisplay: FONT_DISPLAY,
    }),
  ];
}

function buildFontsRegionText() {
  const primaryBlocks = primaryFontFaceBlocks();
  const { fallbackBlocks, displayFamily, bodyFamily } = buildFallbacksAndRoot();

  const rootRule = [
    ':root {',
    `  --font-display: ${displayFamily}, serif;`,
    `  --font-body: ${bodyFamily}, serif;`,
    '}',
  ].join('\n');

  return [...primaryBlocks, ...fallbackBlocks, rootRule].join('\n\n');
}

function replaceFontsRegion(css, regionText) {
  const startMarker = '/* fonts:start */';
  const endMarker = '/* fonts:end */';
  const startIndex = css.indexOf(startMarker);
  const endIndex = css.indexOf(endMarker);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error('build-fonts: style.css is missing the fonts:start/fonts:end markers');
  }
  const before = css.slice(0, startIndex + startMarker.length);
  const after = css.slice(endIndex);
  return `${before}\n${regionText}\n${after}`;
}

function addPreloadLinks(html) {
  const preloads = [
    '<link rel="preload" as="font" type="font/woff2" href="fonts/InstrumentSerif-Regular.woff2" crossorigin>',
    '<link rel="preload" as="font" type="font/woff2" href="fonts/SourceSerif4-Roman.woff2" crossorigin>',
  ];
  if (html.includes(preloads[0])) return html; // already idempotent
  const marker = '<link rel="stylesheet" href="style.css">';
  const idx = html.indexOf(marker);
  if (idx === -1) {
    throw new Error('build-fonts: index.html is missing the stylesheet link to preload before');
  }
  return html.slice(0, idx) + preloads.join('\n') + '\n' + html.slice(idx);
}

async function main() {
  const subsetText = await crawlGlyphSet();
  const faces = await buildSubsets(subsetText);
  copyLicenses();
  const manifest = writeManifest(subsetText, faces);

  const oversized = manifest.faces.filter((f) => f.bytes > MAX_BYTES || f.ratio > MAX_RATIO);
  if (oversized.length > 0) {
    console.error('build-fonts: subset size gate failed:');
    for (const f of oversized) {
      console.error(
        `  ${f.file}: ${f.bytes} bytes (max ${MAX_BYTES}), ratio ${f.ratio.toFixed(3)} of source (max ${MAX_RATIO})`
      );
    }
    process.exit(1);
  }

  const regionText = buildFontsRegionText();
  const css = readFileSync(STYLE_CSS_PATH, 'utf8');
  writeFileSync(STYLE_CSS_PATH, replaceFontsRegion(css, regionText), 'utf8');

  const indexPath = path.join(MOCKUPS_DIR, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  writeFileSync(indexPath, addPreloadLinks(html), 'utf8');

  console.log('build-fonts: subsets, fallback faces and manifest written.');
  for (const f of manifest.faces) {
    console.log(`  ${f.file}: ${f.bytes} bytes (${(f.ratio * 100).toFixed(1)}% of source)`);
  }
}

main().catch((err) => {
  console.error(err.stack ?? err);
  process.exit(1);
});
