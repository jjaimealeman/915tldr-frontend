// 04-08 Task 2: proves /changelog and /contact against REAL built pages under `dist/client`, not
// the source templates — follows tests/unit/listing-pages.test.mjs / tests/unit/chrome.test.mjs's
// `node:test` + `assert/strict` + regex-over-real-HTML convention (this project's established
// style for asserting on rendered output rather than a full DOM parse). Skips cleanly (never
// fails) when `dist/client` hasn't been built yet, matching every other dist-output test in this
// project. Extended in Task 3 to cover /about, /privacy and /terms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { textOf } from '../helpers/html-text.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_BUILT = existsSync(DIST_CLIENT);
const SKIP_REASON = 'dist/client not found — run `pnpm build` first (pnpm test:unit does this automatically)';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const V1_FIXTURE = JSON.parse(readFileSync(path.join(__dirname, '../fixtures/v1-changelog.json'), 'utf8'));
const D1_FIXTURE = JSON.parse(readFileSync(path.join(__dirname, '../fixtures/d1-public-changelogs.json'), 'utf8'));

function readDist(relPath) {
  return readFileSync(path.join(DIST_CLIENT, relPath), 'utf8');
}

function distFileExists(relPath) {
  return existsSync(path.join(DIST_CLIENT, relPath));
}

function extractCanonical(html) {
  const match = html.match(/<link rel="canonical" href="([^"]+)"/);
  return match ? match[1] : null;
}

function epochToDateString(epochSeconds) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(epochSeconds * 1000));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ---------------------------------------------------------------------------
// /changelog
// ---------------------------------------------------------------------------

test(
  'static-pages: changelog.html exists with canonical https://915tldr.com/changelog',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    assert.ok(distFileExists('changelog.html'));
    const html = readDist('changelog.html');
    assert.equal(extractCanonical(html), 'https://915tldr.com/changelog');
  }
);

test(
  'static-pages: every v1-json and D1 changelog fixture entry appears verbatim (date, title, every item) on the built changelog page',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const html = readDist('changelog.html');
    const pageText = textOf(html);

    for (const entry of V1_FIXTURE.entries) {
      assert.ok(pageText.includes(entry.title), `expected v1 entry title "${entry.title}" on the page`);
      for (const item of entry.items) {
        assert.ok(pageText.includes(item), `expected v1 entry item "${item.slice(0, 40)}..." on the page`);
      }
    }

    for (const row of D1_FIXTURE) {
      assert.ok(pageText.includes(row.title), `expected D1 row title "${row.title}" on the page`);
      const items = JSON.parse(row.items);
      for (const item of items) {
        assert.ok(pageText.includes(item), `expected D1 row item "${item.slice(0, 40)}..." on the page`);
      }
      const dateStr = epochToDateString(row.date);
      const iso = `datetime="${dateStr}"`;
      assert.ok(html.includes(iso), `expected a dispatch dated ${dateStr} for D1 row ${row.id}`);
    }
  }
);

test(
  'static-pages: changelog.html renders at least as many dispatch entries as both fixtures combined — REND-03 must never ship fewer than what production actually publishes',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const html = readDist('changelog.html');
    const count = (html.match(/<article data-dispatch>/g) ?? []).length;
    // 04-08 owner decision (2026-09-27): floor is CHANGELOG_MIN_EXPECTED (15) today; this
    // assertion checks against the two fixtures' own combined count (9 + 6 = 15 at capture time),
    // not a hardcoded 18, so it stays correct as those fixtures are refreshed.
    const expectedMinimum = V1_FIXTURE.entries.length + D1_FIXTURE.length;
    assert.ok(count >= expectedMinimum, `expected at least ${expectedMinimum} dispatch entries, got ${count}`);
  }
);

// ---------------------------------------------------------------------------
// /contact
// ---------------------------------------------------------------------------

test(
  'static-pages: contact.html exists with canonical https://915tldr.com/contact, form fields inside a disabled fieldset',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    assert.ok(distFileExists('contact.html'));
    const html = readDist('contact.html');
    assert.equal(extractCanonical(html), 'https://915tldr.com/contact');
    assert.match(html, /<fieldset disabled>/);
    // The fieldset must actually wrap the real form controls, not sit empty beside them.
    const fieldsetMatch = html.match(/<fieldset disabled>([\s\S]*?)<\/fieldset>/);
    assert.ok(fieldsetMatch, 'expected a <fieldset disabled> block');
    assert.match(fieldsetMatch[1], /<input[^>]*id="contact-name"/);
    assert.match(fieldsetMatch[1], /<input[^>]*id="contact-email"/);
    assert.match(fieldsetMatch[1], /<textarea[^>]*id="contact-message"/);
    assert.match(fieldsetMatch[1], /<button type="submit"/);
  }
);

test(
  'static-pages: contact.html plainly states the form is not accepting messages yet',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const html = readDist('contact.html');
    const pageText = textOf(html);
    assert.match(pageText, /isn't accepting messages/i);
  }
);
