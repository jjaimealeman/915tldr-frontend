#!/usr/bin/env node
// D-02/C-01: samples one hue per category from a real, licence-recorded
// photograph. Downloads each photo-sources.json entry into the gitignored
// design/palette/reference/ (never committed), decodes it inside a real
// browser (never a hand-rolled Node image decoder — see threat model T-01-10),
// and reduces the declared region to a chroma-weighted circular mean hue plus
// its circular standard deviation, so a noisy or multi-hued region is caught
// rather than silently averaged into a plausible-looking number.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { converter } from 'culori';
import { startServer } from './serve-mockups.mjs';

const PHOTO_SOURCES_PATH = 'design/palette/photo-sources.json';
const HUE_SOURCES_PATH = 'design/palette/hue-sources.json';
const REFERENCE_DIR = 'design/palette/reference';

const ALLOWED_HOSTS = new Set(['upload.wikimedia.org', 'images.unsplash.com']);
const MAX_REDIRECTS = 3;
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_LONG_EDGE = 800;
const MIN_KEPT_PIXELS = 500;
const MAX_CIRCULAR_STD_DEV = 25;
const MIN_CHROMA = 0.08;
const MIN_LIGHTNESS = 0.25;
const MAX_LIGHTNESS = 0.9;

const toOklch = converter('oklch');

/**
 * Downloads `url` to `destPath`, enforcing: HTTPS only, host on the
 * two-host allowlist (checked on every hop, not just the first), at most
 * MAX_REDIRECTS redirects, a response content-type starting with "image/",
 * and a body no larger than MAX_BYTES. Returns the extension inferred from
 * the final URL's path.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wikimedia's edge occasionally answers a burst of same-second requests with
// a transient 429/5xx; this is rate-limiting, not a real fetch failure, so a
// short backoff-and-retry is a Rule 3 blocking-issue fix, not a relaxed
// content check (the allow-list/content-type/size gates below are untouched).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 4;

async function downloadImage(url, destPath) {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== 'https:') {
      throw new Error(`downloadImage: refusing non-HTTPS URL "${currentUrl}"`);
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      throw new Error(`downloadImage: host not on allow-list: "${parsed.hostname}"`);
    }

    let response;
    for (let attempt = 0; ; attempt++) {
      response = await fetch(currentUrl, { redirect: 'manual' });
      if (!RETRYABLE_STATUS.has(response.status) || attempt >= MAX_RETRIES) break;
      const backoffMs = 2000 * 2 ** attempt;
      console.log(
        `downloadImage: "${currentUrl}" returned HTTP ${response.status}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(backoffMs);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error(`downloadImage: redirect with no Location header from "${currentUrl}"`);
      }
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    if (!response.ok) {
      throw new Error(`downloadImage: "${currentUrl}" returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error(
        `downloadImage: "${currentUrl}" content-type "${contentType}" does not start with "image/"`
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      throw new Error(
        `downloadImage: "${currentUrl}" is ${buffer.length} bytes, exceeds ${MAX_BYTES}`
      );
    }
    if (buffer.length === 0) {
      throw new Error(`downloadImage: "${currentUrl}" returned an empty body`);
    }

    await writeFile(destPath, buffer);
    return;
  }

  throw new Error(`downloadImage: exceeded ${MAX_REDIRECTS} redirects fetching "${url}"`);
}

function extensionFor(imageUrl) {
  const pathname = new URL(imageUrl).pathname;
  const ext = path.extname(pathname).toLowerCase();
  return ext || '.jpg';
}

/**
 * Loads `relPath` (served same-origin from the static server) into an <img>,
 * draws it into a canvas downscaled to at most MAX_LONG_EDGE on the long
 * edge, and returns the declared region's raw RGBA bytes.
 */
async function sampleRegionPixels(page, baseUrl, relPath, region) {
  const fileUrl = `${baseUrl}/${relPath}`;
  const result = await page.evaluate(
    async ({ fileUrl, region, maxLongEdge }) => {
      const img = new Image();
      img.src = fileUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error(`image failed to load: ${fileUrl}`));
      });

      const scale = Math.min(1, maxLongEdge / Math.max(img.naturalWidth, img.naturalHeight));
      const canvasWidth = Math.max(1, Math.round(img.naturalWidth * scale));
      const canvasHeight = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      const rx = Math.round(region.x * canvasWidth);
      const ry = Math.round(region.y * canvasHeight);
      const rw = Math.max(1, Math.round(region.w * canvasWidth));
      const rh = Math.max(1, Math.round(region.h * canvasHeight));

      const imageData = ctx.getImageData(rx, ry, rw, rh);
      return Array.from(imageData.data);
    },
    { fileUrl, region, maxLongEdge: MAX_LONG_EDGE }
  );

  const pixels = [];
  for (let i = 0; i < result.length; i += 4) {
    pixels.push([result[i] / 255, result[i + 1] / 255, result[i + 2] / 255]);
  }
  return pixels;
}

/**
 * Reduces RGB pixels to the chroma-weighted circular mean hue (one decimal),
 * the circular standard deviation in degrees, and the median L/C of the
 * pixels kept after the C/L thresholds (D-02's "real photo, not typed-in hue"
 * contract — see 01-03-PLAN.md Task 1).
 */
function reduceToHueStats(pixels) {
  const kept = [];
  for (const [r, g, b] of pixels) {
    const color = toOklch({ mode: 'rgb', r, g, b });
    if (!color || Number.isNaN(color.h)) continue;
    if (color.c >= MIN_CHROMA && color.l >= MIN_LIGHTNESS && color.l <= MAX_LIGHTNESS) {
      kept.push(color);
    }
  }

  if (kept.length === 0) {
    return { keptPixels: 0, hue: 0, circularStdDev: 999, medianL: 0, medianC: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  let sumWeight = 0;
  for (const color of kept) {
    const hueRad = (color.h * Math.PI) / 180;
    sumX += Math.cos(hueRad) * color.c;
    sumY += Math.sin(hueRad) * color.c;
    sumWeight += color.c;
  }
  const meanX = sumX / sumWeight;
  const meanY = sumY / sumWeight;
  const meanHueDeg = ((Math.atan2(meanY, meanX) * 180) / Math.PI + 360) % 360;

  const resultantLength = Math.sqrt(meanX * meanX + meanY * meanY);
  const circularStdDevRad = Math.sqrt(-2 * Math.log(Math.min(1, Math.max(1e-9, resultantLength))));
  const circularStdDevDeg = (circularStdDevRad * 180) / Math.PI;

  const sortedL = kept.map((c) => c.l).sort((a, b) => a - b);
  const sortedC = kept.map((c) => c.c).sort((a, b) => a - b);
  const mid = Math.floor(kept.length / 2);

  return {
    keptPixels: kept.length,
    hue: Math.round(meanHueDeg * 10) / 10,
    circularStdDev: Math.round(circularStdDevDeg * 10) / 10,
    medianL: Math.round(sortedL[mid] * 1000) / 1000,
    medianC: Math.round(sortedC[mid] * 1000) / 1000,
  };
}

async function main() {
  const photoSources = JSON.parse(await readFile(PHOTO_SOURCES_PATH, 'utf8'));

  await mkdir(REFERENCE_DIR, { recursive: true });

  console.log(`sample-hues: downloading ${photoSources.length} photos...`);
  const downloaded = [];
  for (const entry of photoSources) {
    const ext = extensionFor(entry.imageUrl);
    const relPath = `palette/reference/${entry.slug}${ext}`;
    const destPath = path.join('design', relPath);
    await downloadImage(entry.imageUrl, destPath);
    console.log(`sample-hues: downloaded ${entry.slug} -> ${destPath}`);
    downloaded.push({ ...entry, relPath });
    // A small courtesy delay between requests to the same host — this is a
    // handful of one-off research downloads, not a crawl, and Wikimedia's
    // edge answers rapid same-second bursts with 429s (see downloadImage's
    // retry loop above, which this reduces the odds of ever needing).
    await sleep(1200);
  }

  const { url, close } = await startServer({ port: 0 });
  const browser = await chromium.launch();
  let anyFailure = false;
  const hueSources = [];

  try {
    const page = await browser.newPage();
    await page.goto(`${url}/mockups/`);

    for (const entry of downloaded) {
      const pixels = await sampleRegionPixels(page, url, entry.relPath, entry.region);
      const stats = reduceToHueStats(pixels);

      const { relPath: _relPath, ...photoFields } = entry;
      const record = { ...photoFields, ...stats };
      hueSources.push(record);

      const failed = stats.keptPixels < MIN_KEPT_PIXELS || stats.circularStdDev > MAX_CIRCULAR_STD_DEV;
      if (failed) anyFailure = true;

      console.log(
        `sample-hues: ${entry.slug} -> hue=${stats.hue} circularStdDev=${stats.circularStdDev} ` +
          `keptPixels=${stats.keptPixels} medianL=${stats.medianL} medianC=${stats.medianC}` +
          (failed ? '  *** FAILS THRESHOLD ***' : '')
      );
    }
  } finally {
    await browser.close();
    await close();
  }

  await writeFile(HUE_SOURCES_PATH, JSON.stringify(hueSources, null, 2) + '\n', 'utf8');
  console.log(`sample-hues: wrote ${HUE_SOURCES_PATH}`);

  if (anyFailure) {
    console.error(
      'sample-hues: one or more categories failed keptPixels>=500 / circularStdDev<=25. ' +
        'Fix is a tighter region or a better photo — never a relaxed threshold.'
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
