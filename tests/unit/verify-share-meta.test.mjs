// 07-05 (SOC-07/SOC-08, D-14/D-17/D-20/D-22): unit tests for tools/verify-share-meta.mjs. Fixture
// pages are built in the test from the real share-meta module, then broken one way at a time. The
// network is never touched: runShareChecks takes an injected fetchImpl and discoverArticle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  checkSharePage,
  pngDimensions,
  robotsRulesFor,
  isPathAllowed,
  SCRAPER_USER_AGENTS,
  runShareChecks,
} from '../../tools/verify-share-meta.mjs';
import { ICON_LINKS, shareMetaTags } from '../../src/lib/share-meta.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const SITE = 'https://915tldr.com';
const ARTICLE_PATH = '/crime/fixture-story-00000000-0000-0000-0000-000000000002';
const PUBLISHED = '2026-09-20T08:15:00-06:00';

const escapeAttr = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

function iconHtml() {
  return ICON_LINKS.map((l) => {
    const type = l.type ? ` type="${l.type}"` : '';
    const sizes = l.sizes ? ` sizes="${l.sizes}"` : '';
    return `<link rel="${l.rel}" href="${l.href}"${type}${sizes}>`;
  }).join('');
}

/** A correct page: head from the real builder, body with a <time datetime>. */
function pageHtml({ lang = 'en', kind = 'page', mutate } = {}) {
  const url = kind === 'article'
    ? `${SITE}${lang === 'es' ? '/es' : ''}${ARTICLE_PATH}`
    : `${SITE}${lang === 'es' ? '/es' : ''}`;
  let tags = shareMetaTags({
    lang,
    title: 'Fixture story — 915 TLDR',
    description: 'A fixture description.',
    pageUrl: url,
    alternates: 'paired',
    siteOrigin: SITE,
    ...(kind === 'article' ? { article: { publishedIso: PUBLISHED, section: 'Crime', tags: ['El Paso Police', 'Arrest'] } } : {}),
  });
  if (mutate) tags = mutate(tags) ?? tags;
  const metas = tags.map((t) => `<meta ${t.attr}="${t.key}" content="${escapeAttr(t.content)}">`).join('');
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>Fixture story — 915 TLDR</title>` +
    `<meta name="description" content="A fixture description."><link rel="canonical" href="${url}">` +
    `${iconHtml()}${metas}</head><body><main><time datetime="${PUBLISHED}">Sep 20</time></main></body></html>`;
}

const failing = (results) => results.filter((r) => !r.ok).map((r) => r.check).sort();
const dropKey = (key) => (tags) => tags.filter((t) => t.key !== key);
const setKey = (key, content) => (tags) => tags.map((t) => (t.key === key ? { ...t, content } : t));

test('a correct EN article, EN page and ES page all pass every check', () => {
  assert.deepEqual(failing(checkSharePage(pageHtml({ kind: 'article' }), { lang: 'en', kind: 'article' })), []);
  assert.deepEqual(failing(checkSharePage(pageHtml({}), { lang: 'en', kind: 'page' })), []);
  assert.deepEqual(failing(checkSharePage(pageHtml({ lang: 'es' }), { lang: 'es', kind: 'page' })), []);
  assert.deepEqual(failing(checkSharePage(pageHtml({ lang: 'es', kind: 'article' }), { lang: 'es', kind: 'article' })), []);
});

test('missing og:image:alt fails exactly og:image:alt', () => {
  const html = pageHtml({ mutate: dropKey('og:image:alt') });
  assert.deepEqual(failing(checkSharePage(html, { lang: 'en', kind: 'page' })), ['og:image:alt']);
});

test('wrong og:url fails exactly og:url', () => {
  const html = pageHtml({ mutate: setKey('og:url', 'https://915tldr.com/somewhere-else') });
  assert.deepEqual(failing(checkSharePage(html, { lang: 'en', kind: 'page' })), ['og:url']);
});

test('a forbidden X tag fails exactly the forbidden-tag check', () => {
  const html = pageHtml({ mutate: (tags) => [...tags, { attr: 'name', key: 'twitter:site', content: '@nobody' }] });
  assert.deepEqual(failing(checkSharePage(html, { lang: 'en', kind: 'page' })), ['no forbidden X tags']);
});

test('an empty content value fails the empty-content check and the tag it belongs to', () => {
  const html = pageHtml({ mutate: setKey('og:description', '') });
  assert.deepEqual(failing(checkSharePage(html, { lang: 'en', kind: 'page' })), ['no empty meta content', 'og:description']);
});

test('an article:* tag on a page fails exactly the page check', () => {
  const html = pageHtml({ mutate: (tags) => [...tags, { attr: 'property', key: 'article:section', content: 'Crime' }] });
  assert.deepEqual(failing(checkSharePage(html, { lang: 'en', kind: 'page' })), ['no article:* tags on a page']);
});

test('a published_time that differs from the body <time> fails exactly published_time', () => {
  const html = pageHtml({ kind: 'article', mutate: setKey('article:published_time', '2026-09-21T08:15:00-06:00') });
  assert.deepEqual(failing(checkSharePage(html, { lang: 'en', kind: 'article' })), ['article:published_time']);
});

test('an English page with a self-only hreflang set but no og:locale:alternate fails that check (D-22)', () => {
  const selfOnly = pageHtml({ mutate: dropKey('og:locale:alternate') }).replace(
    '</head>',
    `<link rel="alternate" hreflang="en" href="${SITE}"><link rel="alternate" hreflang="x-default" href="${SITE}"></head>`
  );
  assert.deepEqual(failing(checkSharePage(selfOnly, { lang: 'en', kind: 'page' })), ['og:locale:alternate']);
});

test('wrong article:author and a missing section are each caught', () => {
  const wrongAuthor = pageHtml({ kind: 'article', mutate: setKey('article:author', 'https://915tldr.com/es/about') });
  assert.deepEqual(failing(checkSharePage(wrongAuthor, { lang: 'en', kind: 'article' })), ['article:author']);
  const noSection = pageHtml({ kind: 'article', mutate: dropKey('article:section') });
  assert.deepEqual(failing(checkSharePage(noSection, { lang: 'en', kind: 'article' })), ['article:section']);
});

test('a missing icon link fails the icon check', () => {
  const html = pageHtml({}).replace('<link rel="apple-touch-icon" href="/apple-touch-icon.png">', '');
  assert.deepEqual(failing(checkSharePage(html, { lang: 'en', kind: 'page' })), ['icon links']);
});

test('pngDimensions reads public/og-image.png as 1200x630 and rejects a non-PNG', () => {
  const d = pngDimensions(readFileSync(path.join(REPO_ROOT, 'public/og-image.png')));
  assert.equal(d.width, 1200);
  assert.equal(d.height, 630);
  assert.throws(() => pngDimensions(Buffer.from('not a png at all, just text bytes')), /PNG signature/);
});

// ---------------------------------------------------------------------------------------------
// runShareChecks with an injected fetch
// ---------------------------------------------------------------------------------------------

const png = (w, h) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  b[24] = 8;
  b[25] = 6;
  return b;
};

function fakeFetch(overrides = {}) {
  const calls = [];
  const noindexPage = pageHtml({ lang: 'es' }).replace('</head>', '<meta name="robots" content="noindex"></head>');
  const table = {
    '/version.json': { body: JSON.stringify({ commit: 'abc1234' }), type: 'application/json' },
    '/': { body: pageHtml({}), type: 'text/html' },
    '/es': { body: pageHtml({ lang: 'es' }), type: 'text/html' },
    [ARTICLE_PATH]: { body: pageHtml({ kind: 'article' }), type: 'text/html' },
    [`/es${ARTICLE_PATH}`]: { body: pageHtml({ lang: 'es', kind: 'article' }), type: 'text/html' },
    '/es/source/ktsm': { body: noindexPage, type: 'text/html' },
    '/og-image.png': { body: png(1200, 630), type: 'image/png' },
    '/og-image-es.png': { body: png(1200, 630), type: 'image/png' },
    '/favicon.ico': { body: Buffer.from('ico-bytes'), type: 'image/x-icon' },
    '/favicon.svg': { body: Buffer.from('<svg/>'), type: 'image/svg+xml' },
    '/apple-touch-icon.png': { body: png(180, 180), type: 'image/png' },
    '/robots.txt': { body: 'User-agent: *\nDisallow: /admin\n', type: 'text/plain' },
    ...overrides,
  };
  const impl = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ url: u.href, userAgent: init.headers?.['user-agent'] });
    const hit = table[u.pathname];
    if (!hit) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    if (hit.status) return new Response(hit.body, { status: hit.status, headers: { 'content-type': hit.type } });
    return new Response(hit.body, { status: 200, headers: { 'content-type': hit.type } });
  };
  impl.calls = calls;
  return impl;
}

const discover = async () => ({ path: ARTICLE_PATH });

test('runShareChecks passes against a fully correct fake host', async () => {
  const report = await runShareChecks({ host: 'dev.example', fetchImpl: fakeFetch(), discoverArticle: discover });
  assert.deepEqual(failing(report.results), []);
  assert.equal(report.versionCommit, 'abc1234');
});

test('runShareChecks FAILs a 404 icon and names it', async () => {
  const fetchImpl = fakeFetch({ '/favicon.ico': { body: 'nope', type: 'text/plain', status: 404 } });
  const report = await runShareChecks({ host: 'dev.example', fetchImpl, discoverArticle: discover });
  assert.deepEqual(failing(report.results), ['/favicon.ico status']);
});

test('runShareChecks FAILs a card with wrong dimensions and a noindex path that is not noindex', async () => {
  const fetchImpl = fakeFetch({
    '/og-image.png': { body: png(1200, 600), type: 'image/png' },
    '/es/source/ktsm': { body: pageHtml({ lang: 'es' }), type: 'text/html' },
  });
  const report = await runShareChecks({ host: 'dev.example', fetchImpl, discoverArticle: discover });
  const bad = failing(report.results);
  assert.ok(bad.includes('card en PNG dimensions'), bad.join(' | '));
  assert.ok(bad.some((c) => c.startsWith('noindex page')), bad.join(' | '));
});

test('runShareChecks reports a tagless host as FAIL (the checker can fail)', async () => {
  const bare = '<!DOCTYPE html><html><head><title>x</title></head><body></body></html>';
  const fetchImpl = fakeFetch({ '/': { body: bare, type: 'text/html' }, '/og-image.png': { body: 'x', type: 'text/plain', status: 404 } });
  const report = await runShareChecks({ host: 'dev.example', fetchImpl, discoverArticle: discover });
  const bad = failing(report.results);
  assert.ok(bad.some((c) => c.includes('EN home') && c.includes('og:image')), bad.join(' | '));
  assert.ok(bad.includes('card en status'));
});

test('--expect-stylesheet is compared with the homepage stylesheet', async () => {
  const withCss = pageHtml({}).replace('</head>', '<link rel="stylesheet" href="/_astro/a.css"></head>');
  const fetchImpl = fakeFetch({ '/': { body: withCss, type: 'text/html' } });
  const good = await runShareChecks({ host: 'dev.example', fetchImpl, discoverArticle: discover, expectStylesheet: '/_astro/a.css' });
  assert.equal(good.stylesheet, '/_astro/a.css');
  assert.ok(!failing(good.results).includes('homepage stylesheet'));
  const bad = await runShareChecks({ host: 'dev.example', fetchImpl, discoverArticle: discover, expectStylesheet: '/_astro/b.css' });
  assert.ok(failing(bad.results).includes('homepage stylesheet'));
});

// ---------------------------------------------------------------------------------------------
// Task 2 (D-20, edge half): crawler User-Agent probes and robots.txt group resolution
// ---------------------------------------------------------------------------------------------

const REAL_ROBOTS = readFileSync(path.join(REPO_ROOT, 'public/robots.txt'), 'utf8');

test('robotsRulesFor: facebookexternalhit falls under *, not the FacebookBot group', () => {
  const rules = robotsRulesFor(REAL_ROBOTS, 'facebookexternalhit');
  assert.equal(rules.group, '*');
  assert.deepEqual(rules.disallow, ['/admin', '/admin/', '/api/admin/']);
});

test('robotsRulesFor: FacebookBot matches its own group with Disallow /', () => {
  const rules = robotsRulesFor(REAL_ROBOTS, 'FacebookBot');
  assert.equal(rules.group, 'FacebookBot');
  assert.deepEqual(rules.disallow, ['/']);
});

test('robotsRulesFor: case-insensitive token, shared groups, no * group means no rules', () => {
  const text = 'User-agent: AlphaBot\nUser-agent: BetaBot\nDisallow: /x\n\nUser-agent: Other\nDisallow: /y\n';
  assert.deepEqual(robotsRulesFor(text, 'betabot').disallow, ['/x']);
  assert.deepEqual(robotsRulesFor(text, 'ALPHABOT').disallow, ['/x']);
  const none = robotsRulesFor(text, 'Twitterbot');
  assert.equal(none.group, null);
  assert.deepEqual(none.disallow, []);
});

test('isPathAllowed: * group allows /og-image.png, Disallow / blocks it, longest match wins', () => {
  assert.equal(isPathAllowed(robotsRulesFor(REAL_ROBOTS, 'Twitterbot'), '/og-image.png'), true);
  assert.equal(isPathAllowed(robotsRulesFor(REAL_ROBOTS, 'Twitterbot'), '/admin/x'), false);
  assert.equal(isPathAllowed(robotsRulesFor(REAL_ROBOTS, 'FacebookBot'), '/og-image.png'), false);
  const rules = robotsRulesFor('User-agent: *\nDisallow: /a\nAllow: /a/b\nDisallow:\n', 'x');
  assert.equal(isPathAllowed(rules, '/a/b/c'), true);
  assert.equal(isPathAllowed(rules, '/a/c'), false);
});

test('SCRAPER_USER_AGENTS names the four crawlers', () => {
  assert.deepEqual(Object.keys(SCRAPER_USER_AGENTS).sort(), ['facebook', 'slack', 'whatsapp', 'x']);
});

test('UA probes request the article page and the EN card with each crawler User-Agent', async () => {
  const fetchImpl = fakeFetch({ '/robots.txt': { body: REAL_ROBOTS, type: 'text/plain' } });
  const report = await runShareChecks({ host: 'dev.example', fetchImpl, discoverArticle: discover });
  for (const [name, ua] of Object.entries(SCRAPER_USER_AGENTS)) {
    const seen = fetchImpl.calls.filter((c) => c.userAgent === ua).map((c) => new URL(c.url).pathname);
    assert.ok(seen.includes(ARTICLE_PATH), `${name} did not request the article`);
    assert.ok(seen.includes('/og-image.png'), `${name} did not request the card`);
    assert.ok(report.results.some((r) => r.check === `UA probe ${name}: article page` && r.ok), name);
    assert.ok(report.results.some((r) => r.check === `UA probe ${name}: EN card` && r.ok), name);
  }
  const fb = report.results.find((r) => r.check === 'robots.txt facebookexternalhit');
  assert.ok(fb && fb.ok && /group \*/.test(fb.detail), fb?.detail);
});

test('a non-200 for one crawler is a FAIL naming the crawler and status', async () => {
  const base = fakeFetch();
  const fetchImpl = async (url, init = {}) => {
    if (init.headers?.['user-agent'] === SCRAPER_USER_AGENTS.slack && new URL(url).pathname === ARTICLE_PATH) {
      return new Response('forbidden', { status: 403 });
    }
    return base(url, init);
  };
  const report = await runShareChecks({ host: 'dev.example', fetchImpl, discoverArticle: discover });
  const bad = report.results.filter((r) => !r.ok);
  assert.equal(bad.length, 1, JSON.stringify(bad));
  assert.equal(bad[0].check, 'UA probe slack: article page');
  assert.match(bad[0].detail, /403/);
});
