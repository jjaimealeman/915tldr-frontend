// Post-phase-06 polish, task A (owner decision 2026-10-08): the owner's Umami dashboard host must
// not appear as visible text or a link on any public page. The Privacy pages used to name it as a
// linked host; they now say only "self-hosted by 915website.com". The tracker <script src> in
// Base.astro is deliberately unchanged (owner confirmed that is fine) — this test pins the
// PRIVACY PAGES, not the tracker.
//
// Source-based (no build needed): the template body — everything after the frontmatter fence — is
// what renders. Frontmatter code comments and HTML comments may keep the host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { staleDistReason } from '../helpers/dist-fresh.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const HOST = 'stats.915websites.com';

/** The rendered template: strip the `---` frontmatter block and any HTML comments. */
function templateBody(rel) {
  const src = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
  const match = src.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  assert.ok(match, `${rel}: expected an Astro frontmatter fence`);
  return match[1].replace(/<!--[\s\S]*?-->/g, '');
}

/** Collapse whitespace so a sentence wrapped across source lines still matches. */
const flat = (s) => s.replace(/\s+/g, ' ');

const PAGES = [
  {
    rel: 'src/pages/privacy.astro',
    built: 'privacy.html',
    sentence:
      'We run our own analytics, Umami, self-hosted by 915website.com — your visits are never sent to a third party.',
  },
  {
    rel: 'src/pages/es/privacy.astro',
    built: 'es/privacy.html',
    sentence:
      'Usamos nuestra propia herramienta de análisis, Umami, alojada por 915website.com — sus visitas nunca se envían a un tercero.',
  },
];

for (const page of PAGES) {
  test(`${page.rel}: the rendered template never names the analytics dashboard host`, () => {
    const body = templateBody(page.rel);
    assert.ok(!body.includes(HOST), `${page.rel} must not show ${HOST} as text or an href`);
    assert.ok(!/stats\.915websites/.test(body), `${page.rel} must not contain any form of the dashboard host`);
  });

  test(`${page.rel}: the Umami paragraph carries the new self-hosted-by-915website.com sentence`, () => {
    assert.ok(flat(templateBody(page.rel)).includes(page.sentence), `${page.rel} is missing: ${page.sentence}`);
  });

  test(`${page.rel}: the docs.umami.is citation is untouched and still opens in a new tab`, () => {
    const body = flat(templateBody(page.rel));
    assert.match(body, /<a href="https:\/\/docs\.umami\.is\/docs\/metric-definitions" rel="noopener external" target="_blank" ?>/);
  });
}

test('the Umami paragraph no longer has a new-tab link to the dashboard (no anchor, no rel/target) — only the docs citation remains in it', () => {
  for (const page of PAGES) {
    const body = templateBody(page.rel);
    const start = body.indexOf('<h3>Umami Analytics</h3>');
    assert.ok(start >= 0, `${page.rel}: Umami Analytics heading not found`);
    const end = body.indexOf('</p>', start);
    const paragraph = body.slice(start, end);
    const anchors = [...paragraph.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    const external = anchors.filter((h) => /^https?:/.test(h));
    assert.deepEqual(external, ['https://docs.umami.is/docs/metric-definitions'], `${page.rel}: unexpected external links ${external}`);
  }
});

test('Base.astro still loads the tracker from its configured host (tracker unchanged; only the visible mention was removed)', () => {
  const base = readFileSync(path.join(REPO_ROOT, 'src/layouts/Base.astro'), 'utf8');
  assert.match(base, /<script is:inline defer src="https:\/\/stats\.915websites\.com\/script\.js" data-website-id="[^"]+"><\/script>/);
});

// Built output: runs when the local dist is fresh; a visible skip against a dist that predates the edit.
const builtLacksHost = () => {
  const f = path.join(REPO_ROOT, 'dist', 'client', 'privacy.html');
  return existsSync(f) && !readFileSync(f, 'utf8').includes(HOST);
};
const STALE = staleDistReason(['src/pages/privacy.astro', 'src/pages/es/privacy.astro'], builtLacksHost);

test('built privacy pages: neither /privacy nor /es/privacy mentions the dashboard host', { skip: STALE ?? false }, () => {
  for (const page of PAGES) {
    const html = readFileSync(path.join(REPO_ROOT, 'dist', 'client', page.built), 'utf8');
    // The tracker script lives in <head> of Base.astro; strip it, the page BODY must be clean.
    const withoutTracker = html.replace(/<script[^>]*src="https:\/\/stats\.915websites\.com\/script\.js"[^>]*><\/script>/g, '');
    assert.ok(!withoutTracker.includes(HOST), `${page.built} still mentions ${HOST} outside the tracker tag`);
  }
});
