#!/usr/bin/env node
// D-01/D-02/D-03/D-04/D-13: builds the shared-stop OKLCH palette from the
// photo-sampled hues in hue-sources.json and the stop/offset choices in
// palette.json, writes the palette/palette-dark sub-regions of style.css,
// and reports every written value (plus every gamut reduction and the
// minimum pairwise perceptual distance per stop) to design/evidence/palette.md.
// Regenerating with no source changes must leave style.css byte-identical.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { clampChroma, differenceEuclidean, formatHex, parse } from 'culori';

const PALETTE_JSON_PATH = 'design/palette/palette.json';
const HUE_SOURCES_PATH = 'design/palette/hue-sources.json';
const CSS_PATH = 'design/mockups/style.css';
const EVIDENCE_PATH = 'design/evidence/palette.md';

const STOP_NAMES = ['vividLight', 'block', 'vividDark'];
const STOP_KEY = { vividLight: 'vivid-light', block: 'block', vividDark: 'vivid-dark' };
const MAX_HUE_OFFSET = 8;
const MIN_PAIRWISE_DISTANCE = 0.05;
const CHROMA_FLAG_RATIO = 0.6; // flag any written chroma below 60% of requested
const oklabDistance = differenceEuclidean('oklab');

function fmtL(value) {
  return value.toFixed(3);
}
// Floor-truncated (never rounded up) to 3 decimals: clampChroma finds the
// true gamut-boundary chroma via numeric search, and a plain round-to-nearest
// can round that value UP past the boundary, producing a written oklch()
// literal that culori's own displayable() then rejects as out-of-gamut (see
// 01-02's same finding, applied here to chroma instead of the earlier ramp).
function floorTo3(value) {
  return Math.floor(value * 1000) / 1000;
}
function fmtC(value) {
  return value.toFixed(3);
}
function fmtH(value) {
  const normalized = ((value % 360) + 360) % 360;
  return normalized.toFixed(1);
}

function normalizeHueDeg(value) {
  return ((value % 360) + 360) % 360;
}

/**
 * Replaces the content strictly between `/* <name>:start *\/` and
 * `/* <name>:end *\/` markers with `newContent`, leaving the markers
 * themselves untouched. Throws if either marker is missing.
 */
function replaceRegion(css, name, newContent) {
  const startMarker = `/* ${name}:start */`;
  const endMarker = `/* ${name}:end */`;
  const startIndex = css.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`replaceRegion: missing start marker "${startMarker}"`);
  }
  const contentStart = startIndex + startMarker.length;
  const endIndex = css.indexOf(endMarker, contentStart);
  if (endIndex === -1) {
    throw new Error(`replaceRegion: missing end marker "${endMarker}"`);
  }
  return css.slice(0, contentStart) + newContent + css.slice(endIndex);
}

function validatePalette(palette) {
  for (const category of palette.categories) {
    const offset = category.hueOffset ?? 0;
    if (Math.abs(offset) > MAX_HUE_OFFSET) {
      throw new Error(
        `validatePalette: ${category.slug} hueOffset ${offset} exceeds +-${MAX_HUE_OFFSET} degrees`
      );
    }
    if (offset !== 0 && !category.hueOffsetReason) {
      throw new Error(
        `validatePalette: ${category.slug} has a non-zero hueOffset (${offset}) but no hueOffsetReason`
      );
    }
  }
}

/**
 * Builds { vividLight, block, vividDark } gamut-clamped OKLCH colors for one
 * category's final hue (sampled hue + documented offset).
 */
function buildCategoryColors(finalHue, stops) {
  const colors = {};
  for (const stopName of STOP_NAMES) {
    const stop = stops[stopName];
    const requested = { mode: 'oklch', l: stop.l, c: stop.c, h: finalHue };
    const clamped = clampChroma(requested, 'oklch');
    // Floor the chroma to the same 3-decimal precision that gets written to
    // CSS *before* any downstream use (evidence, distance checks) so nothing
    // ever reports against a value more precise than what actually ships.
    colors[stopName] = { ...clamped, c: floorTo3(clamped.c) };
  }
  return colors;
}

function buildPaletteRegionText(palette, hueBySlug) {
  const stops = palette.stops;
  const lines = [];
  lines.push('/* palette stops (D-02/D-03) — shared by all eight hues; hue alone carries identity */');
  lines.push(`--stop-vivid-light-l: ${fmtL(stops.vividLight.l)};`);
  lines.push(`--stop-vivid-light-c: ${fmtC(stops.vividLight.c)};`);
  lines.push(`--stop-block-l: ${fmtL(stops.block.l)};`);
  lines.push(`--stop-block-c: ${fmtC(stops.block.c)};`);
  lines.push(`--stop-vivid-dark-l: ${fmtL(stops.vividDark.l)};`);
  lines.push(`--stop-vivid-dark-c: ${fmtC(stops.vividDark.c)};`);
  lines.push('');

  palette.categories.forEach((category, index) => {
    const sampledHue = hueBySlug.get(category.hueSource);
    if (sampledHue === undefined) {
      throw new Error(`buildPaletteRegionText: no hue-sources entry for "${category.hueSource}"`);
    }
    const finalHue = normalizeHueDeg(sampledHue + (category.hueOffset ?? 0));
    const colors = buildCategoryColors(finalHue, stops);
    const hueStr = fmtH(finalHue);

    lines.push(`--hue-${category.slug}: ${hueStr};`);
    for (const stopName of STOP_NAMES) {
      const c = colors[stopName];
      lines.push(
        `--cat-${category.slug}-${STOP_KEY[stopName]}: oklch(${fmtL(c.l)} ${fmtC(c.c)} ${hueStr});`
      );
    }
    lines.push(`--cat-${category.slug}: var(--cat-${category.slug}-vivid-light);`);
    if (index < palette.categories.length - 1) lines.push('');
  });

  const indented = lines.map((line) => (line === '' ? '' : `  ${line}`)).join('\n');
  return `\n${indented}\n  `;
}

function buildPaletteDarkRegionText(palette) {
  const lines = palette.categories.map(
    (category) => `--cat-${category.slug}: var(--cat-${category.slug}-vivid-dark);`
  );
  const indented = lines.map((line) => `  ${line}`).join('\n');
  return `\n${indented}\n  `;
}

/**
 * Recomputes every category's colors (for the evidence report) alongside
 * the requested (pre-clamp) chroma, so the report can flag any hue whose
 * gamut reduced it below CHROMA_FLAG_RATIO of what was asked for.
 */
function buildEvidenceModel(palette, hueSources, hueBySlug) {
  const hueSourceBySlug = new Map(hueSources.map((h) => [h.slug, h]));
  const perCategory = palette.categories.map((category) => {
    const sampledHue = hueBySlug.get(category.hueSource);
    const finalHue = normalizeHueDeg(sampledHue + (category.hueOffset ?? 0));
    const colors = buildCategoryColors(finalHue, palette.stops);
    const source = hueSourceBySlug.get(category.hueSource);
    const stopDetails = {};
    for (const stopName of STOP_NAMES) {
      const requestedC = palette.stops[stopName].c;
      const writtenC = colors[stopName].c;
      stopDetails[stopName] = {
        requestedC,
        writtenC,
        hex: formatHex(colors[stopName]),
        below60: writtenC < requestedC * CHROMA_FLAG_RATIO,
      };
    }
    return { category, source, finalHue, colors, stopDetails };
  });
  return perCategory;
}

function minPairwiseDistance(perCategory, stopName) {
  let minDist = Infinity;
  let closestPair = null;
  for (let i = 0; i < perCategory.length; i++) {
    for (let j = i + 1; j < perCategory.length; j++) {
      const a = perCategory[i].colors[stopName];
      const b = perCategory[j].colors[stopName];
      const dist = oklabDistance(a, b);
      if (dist < minDist) {
        minDist = dist;
        closestPair = [perCategory[i].category.slug, perCategory[j].category.slug];
      }
    }
  }
  return { minDist, closestPair };
}

function buildEvidenceMarkdown(perCategory) {
  const lines = [];
  lines.push('# Palette evidence (D-02, D-03, C-01)');
  lines.push('');
  lines.push(
    'Generated from `design/palette/photo-sources.json`, `design/palette/hue-sources.json` and ' +
      '`design/palette/palette.json` by `npm run palette:build` — re-run after any hue, offset or ' +
      'stop change.'
  );
  lines.push('');
  lines.push('## Per-category values');
  lines.push('');
  lines.push(
    '| Category | Subject | Photo | Licence | Sampled hue | Offset | Reason | Stop | Requested C | Written C | Hex |'
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const entry of perCategory) {
    const { category, source, stopDetails } = entry;
    const offset = category.hueOffset ?? 0;
    for (const stopName of STOP_NAMES) {
      const d = stopDetails[stopName];
      const flag = d.below60 ? ' ⚠' : '';
      lines.push(
        `| ${category.name} | ${source.subject} | [link](${source.pageUrl}) | ${source.license} | ` +
          `${source.hue}° | ${offset > 0 ? '+' : ''}${offset}° | ${category.hueOffsetReason ?? '—'} | ` +
          `${STOP_KEY[stopName]} | ${d.requestedC.toFixed(3)} | ${d.writtenC.toFixed(3)}${flag} | ${d.hex} |`
      );
    }
  }
  lines.push('');
  lines.push(
    '⚠ = written chroma is below 60% of the requested value for that stop (that hue is duller than its siblings; a real gamut limit, not a bug).'
  );
  lines.push('');

  lines.push('## Minimum pairwise distance (OKLab, per stop)');
  lines.push('');
  lines.push('| Stop | Minimum distance | Closest pair | Verdict (>= 0.05) |');
  lines.push('|---|---|---|---|');
  let anyDistanceFailure = false;
  for (const stopName of STOP_NAMES) {
    const { minDist, closestPair } = minPairwiseDistance(perCategory, stopName);
    const pass = minDist >= MIN_PAIRWISE_DISTANCE;
    if (!pass) anyDistanceFailure = true;
    lines.push(
      `| ${STOP_KEY[stopName]} | ${minDist.toFixed(4)} | ${closestPair.join(' / ')} | ${pass ? 'PASS' : 'FAIL'} |`
    );
  }
  lines.push('');

  lines.push('## C-01 review');
  lines.push('');
  lines.push(
    'Block stops whose final hue lies in 40-100° turn dark amber or olive at block lightness, which ' +
      'can read as brown — the owner should judge these directly against C-01 rather than the script ' +
      'silently excluding them (D-01 applies to all eight categories).'
  );
  lines.push('');
  const c01Rows = perCategory.filter((entry) => entry.finalHue >= 40 && entry.finalHue <= 100);
  if (c01Rows.length === 0) {
    lines.push('No category currently falls in the 40-100° block band.');
  } else {
    lines.push('| Category | Final hue | Block hex | Note |');
    lines.push('|---|---|---|---|');
    for (const entry of c01Rows) {
      lines.push(
        `| ${entry.category.name} | ${entry.finalHue.toFixed(1)}° | ${entry.stopDetails.block.hex} | ` +
          'dark amber or olive at block lightness — may read as brown; owner to judge at approval |'
      );
    }
  }
  lines.push('');
  lines.push(`**Overall distance check: ${anyDistanceFailure ? 'FAIL' : 'PASS'}**`);
  lines.push('');

  return { markdown: lines.join('\n'), anyDistanceFailure };
}

async function main() {
  const palette = JSON.parse(await readFile(PALETTE_JSON_PATH, 'utf8'));
  const hueSources = JSON.parse(await readFile(HUE_SOURCES_PATH, 'utf8'));

  validatePalette(palette);

  const hueBySlug = new Map(hueSources.map((h) => [h.slug, h.hue]));

  let css = await readFile(CSS_PATH, 'utf8');
  css = replaceRegion(css, 'palette', buildPaletteRegionText(palette, hueBySlug));
  css = replaceRegion(css, 'palette-dark', buildPaletteDarkRegionText(palette));
  await writeFile(CSS_PATH, css, 'utf8');
  console.log(`build-palette: wrote ${CSS_PATH}`);

  const perCategory = buildEvidenceModel(palette, hueSources, hueBySlug);
  const { markdown, anyDistanceFailure } = buildEvidenceMarkdown(perCategory);
  await mkdir(path.dirname(path.resolve(EVIDENCE_PATH)), { recursive: true });
  await writeFile(EVIDENCE_PATH, markdown, 'utf8');
  console.log(`build-palette: wrote ${EVIDENCE_PATH}`);

  if (anyDistanceFailure) {
    console.error(
      'build-palette: minimum pairwise OKLab distance fell below 0.05 for at least one stop. ' +
        'Apply a documented hueOffset (<=8deg) or resample a different photo region.'
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
