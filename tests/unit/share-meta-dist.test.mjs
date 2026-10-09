// 07-04 (SOC-01..05): proves the share metadata on REAL built pages under dist/client, including the
// article:* set on a real hot-tier article and its Spanish twin (D-15/D-16/D-18). Unlike
// tests/unit/head-harness.test.mjs (which renders Base.astro with fixture props and no loaders),
// this reads what `astro build` actually wrote from the two article templates.
//
// Why it is gated: a local full build runs the D1 loaders and bulk-writes production KV (06-15
// SUMMARY, deviation 2), so this repo does not build locally for routine work. `staleDistReason`
// turns "no fresh build" into a VISIBLE skip naming the newer source file (never a silent pass, never
// a false failure against an older dist). After a real `pnpm build` the dist is newer than every
// source and every test below runs in full.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { staleDistReason, builtPagesHaveShareMeta } from '../helpers/dist-fresh.mjs';
import { readBuiltPage } from '../helpers/built-page.mjs';
import { headOf, parseMetaTags, parseLinkTags, metaContent } from '../helpers/head-meta.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');

const SKIP = {
  skip:
    staleDistReason(
      [
        'src/layouts/Base.astro',
        'src/lib/share-meta.ts',
        'src/pages/[category]/[slug].astro',
        'src/pages/es/[category]/[slug].astro',
      ],
      builtPagesHaveShareMeta
    ) ?? false,
};

const ARTICLE_FILE_RE =
  /^(.+)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;

// Same discovery shape as tests/unit/chrome.test.mjs: `<category>/<slug>-<uuid>.html`, one level down.
function firstHotArticlePath() {
  for (const entry of readdirSync(DIST_CLIENT).sort()) {
    const full = path.join(DIST_CLIENT, entry);
    if (entry === 'es' || !statSync(full).isDirectory()) continue;
    for (const inner of readdirSync(full).sort()) {
      if (ARTICLE_FILE_RE.test(inner)) return `/${entry}/${inner.replace(/\.html$/, '')}`;
    }
  }
  return null;
}

function jsonLdNodes(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const parsed = JSON.parse(m[1]);
    const list = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
    nodes.push(...list);
  }
  return nodes;
}

function readDist(rel) {
  return readFileSync(path.join(DIST_CLIENT, rel), 'utf8');
}

function assertArticlePage(html, label, imageSuffix) {
  const head = headOf(html);
  const tags = parseMetaTags(head);
  assert.equal(metaContent(tags, 'og:type'), 'article', `${label}: og:type`);

  const bodyTime = html.slice(html.indexOf('<body')).match(/<time datetime="([^"]*)"/)?.[1];
  assert.ok(bodyTime, `${label}: body has a <time datetime>`);
  const news = jsonLdNodes(html).find((n) => n['@type'] === 'NewsArticle');
  assert.ok(news, `${label}: NewsArticle JSON-LD present`);

  assert.equal(metaContent(tags, 'article:published_time'), bodyTime, `${label}: published_time = <time datetime>`);
  assert.equal(metaContent(tags, 'article:published_time'), news.datePublished, `${label}: published_time = JSON-LD datePublished`);
  assert.equal(metaContent(tags, 'article:modified_time'), news.dateModified, `${label}: modified_time = JSON-LD dateModified`);
  assert.equal(metaContent(tags, 'article:section'), news.articleSection, `${label}: section = JSON-LD articleSection`);

  const canonical = parseLinkTags(head).find((l) => l.rel === 'canonical');
  assert.ok(canonical, `${label}: canonical link present`);
  assert.equal(metaContent(tags, 'og:url'), canonical.href, `${label}: og:url = canonical`);
  assert.ok(metaContent(tags, 'og:image').endsWith(imageSuffix), `${label}: og:image ends ${imageSuffix}`);
  return tags;
}

test('share-meta-dist: a real EN article carries og:type article and article:* equal to its byline and JSON-LD', SKIP, () => {
  const articlePath = firstHotArticlePath();
  assert.ok(articlePath, 'expected at least one hot article under dist/client');
  const html = readBuiltPage(articlePath);
  assert.ok(html, `${articlePath} built`);
  const tags = assertArticlePage(html, articlePath, '/og-image.png');
  assert.equal(metaContent(tags, 'article:author'), 'https://915tldr.com/about');
});

test('share-meta-dist: its ES twin carries the same checks with the Spanish card and author', SKIP, () => {
  const articlePath = firstHotArticlePath();
  assert.ok(articlePath, 'expected at least one hot article under dist/client');
  const html = readBuiltPage(`/es${articlePath}`);
  assert.ok(html, `/es${articlePath} built`);
  const tags = assertArticlePage(html, `/es${articlePath}`, '/og-image-es.png');
  assert.equal(metaContent(tags, 'article:author'), 'https://915tldr.com/es/about');
});

test('share-meta-dist: listing pages keep og:type website, carry no article: key, and have the right locale', SKIP, () => {
  for (const [file, locale] of [
    ['crime.html', 'en_US'],
    ['es/crime.html', 'es_US'],
  ]) {
    const tags = parseMetaTags(headOf(readDist(file)));
    assert.equal(metaContent(tags, 'og:type'), 'website', file);
    assert.ok(!tags.some((t) => t.key.startsWith('article:')), `${file}: no article: key`);
    assert.equal(metaContent(tags, 'og:locale'), locale, file);
  }
});

test('share-meta-dist: the 404 page has og:url ending /404 and no canonical link', SKIP, () => {
  const head = headOf(readDist('404.html'));
  assert.ok(metaContent(parseMetaTags(head), 'og:url').endsWith('/404'));
  assert.equal(parseLinkTags(head).find((l) => l.rel === 'canonical'), undefined);
});

test('share-meta-dist: a noindex source page still carries og:image and twitter:card (D-14)', SKIP, () => {
  const file = 'es/source/ktsm.html';
  assert.ok(existsSync(path.join(DIST_CLIENT, file)), `${file} built`);
  const head = headOf(readDist(file));
  const tags = parseMetaTags(head);
  if (metaContent(tags, 'robots') === 'noindex') {
    assert.ok(metaContent(tags, 'og:image'), 'og:image present on a noindex page');
    assert.equal(metaContent(tags, 'twitter:card'), 'summary_large_image');
  }
});
