// 07-03 (SOC-01 / SOC-02 / SOC-04; D-14, D-17, D-22): pure unit tests of the share-meta builders.
// No build, no filesystem: `shareMetaTags` is a plain function over plain strings, so the full
// ordered og/twitter set, its validation and its (non-)escaping are pinned here. The built-HTML half
// (escaping at render time, determinism, icon links) lives in tests/unit/head-harness.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareMetaTags, shareImageUrl, fallbackPageUrl } from '../../src/lib/share-meta.ts';

const BASE = {
  lang: 'en',
  title: 'Crime — 915 TLDR',
  description: 'D',
  pageUrl: 'https://915tldr.com/crime',
  alternates: 'paired',
  siteOrigin: 'https://915tldr.com',
};

const ORDER = [
  'og:title',
  'og:description',
  'og:url',
  'og:site_name',
  'og:type',
  'og:locale',
  'og:locale:alternate',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:type',
  'og:image:alt',
  'twitter:card',
  'twitter:image:alt',
];

const byKey = (tags, key) => tags.find((t) => t.key === key);

test('shareMetaTags: returns exactly the fixed ordered key list (UI-SPEC Head Metadata Contract)', () => {
  assert.deepEqual(
    shareMetaTags(BASE).map((t) => t.key),
    ORDER
  );
});

test('shareMetaTags: og:* use attr "property", twitter:* use attr "name"', () => {
  for (const tag of shareMetaTags(BASE)) {
    assert.equal(tag.attr, tag.key.startsWith('twitter:') ? 'name' : 'property', tag.key);
  }
});

test('shareMetaTags: English values are the literal expected strings', () => {
  const tags = shareMetaTags(BASE);
  const expected = {
    'og:title': 'Crime — 915 TLDR',
    'og:description': 'D',
    'og:url': 'https://915tldr.com/crime',
    'og:site_name': '915 TLDR',
    'og:type': 'website',
    'og:locale': 'en_US',
    'og:locale:alternate': 'es_US',
    'og:image': 'https://dev.915tldr.com/og-image.png',
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:image:type': 'image/png',
    'og:image:alt': '915 TLDR — El Paso news, in brief.',
    'twitter:card': 'summary_large_image',
    'twitter:image:alt': '915 TLDR — El Paso news, in brief.',
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(byKey(tags, key)?.content, value, key);
  }
  assert.equal(byKey(tags, 'twitter:image:alt').content, byKey(tags, 'og:image:alt').content);
});

test('shareMetaTags: Spanish page gets es_US, alternate en_US, the ES card and the ES alt', () => {
  const tags = shareMetaTags({ ...BASE, lang: 'es', pageUrl: 'https://915tldr.com/es/crime' });
  assert.equal(byKey(tags, 'og:locale').content, 'es_US');
  assert.equal(byKey(tags, 'og:locale:alternate').content, 'en_US');
  assert.ok(byKey(tags, 'og:image').content.endsWith('/og-image-es.png'));
  assert.equal(byKey(tags, 'og:image:alt').content, '915 TLDR — Noticias de El Paso, en breve.');
  assert.equal(byKey(tags, 'twitter:image:alt').content, '915 TLDR — Noticias de El Paso, en breve.');
});

test('shareMetaTags (D-22): og:locale:alternate is present with the other locale for paired, self and none alike', () => {
  const keyLists = [];
  for (const alternates of ['paired', 'self', 'none']) {
    const tags = shareMetaTags({ ...BASE, alternates });
    keyLists.push(tags.map((t) => t.key));
    assert.equal(byKey(tags, 'og:locale:alternate')?.content, 'es_US', alternates);
    const es = shareMetaTags({ ...BASE, lang: 'es', alternates });
    assert.equal(byKey(es, 'og:locale:alternate')?.content, 'en_US', `es ${alternates}`);
  }
  assert.deepEqual(keyLists[1], keyLists[0]);
  assert.deepEqual(keyLists[2], keyLists[0]);
});

test('shareMetaTags (D-17): never emits twitter:site, twitter:title, twitter:description or twitter:image', () => {
  const keys = shareMetaTags(BASE).map((t) => t.key);
  for (const banned of ['twitter:site', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert.ok(!keys.includes(banned), banned);
  }
});

test('shareMetaTags: hostile text is returned verbatim (escaping is the renderer\'s job, never pre-applied)', () => {
  const title = 'Quote " & <script>alert(1)</script> — 915 TLDR';
  const description = '<b>bold</b> & "quoted"';
  const tags = shareMetaTags({ ...BASE, title, description });
  assert.equal(byKey(tags, 'og:title').content, title);
  assert.equal(byKey(tags, 'og:description').content, description);
});

test('shareMetaTags: every returned content is a non-empty string', () => {
  for (const tag of shareMetaTags(BASE)) {
    assert.equal(typeof tag.content, 'string', tag.key);
    assert.ok(tag.content.length > 0, tag.key);
  }
});

test('shareMetaTags: throws share-meta: errors naming the bad field', () => {
  const bad = [
    [{ lang: 'fr' }, /lang/i],
    [{ alternates: 'bogus' }, /^share-meta:.*alternates/],
    [{ title: '' }, /^share-meta:.*title/],
    [{ title: '   ' }, /^share-meta:.*title/],
    [{ description: '' }, /^share-meta:.*description/],
    [{ description: ' \n\t ' }, /^share-meta:.*description/],
    [{ pageUrl: '/crime' }, /^share-meta:.*pageUrl/],
    [{ pageUrl: 'http://915tldr.com/crime' }, /^share-meta:.*pageUrl/],
    [{ pageUrl: 'not a url' }, /^share-meta:.*pageUrl/],
    [{ siteOrigin: '915tldr.com' }, /^share-meta:.*siteOrigin/],
    [{ siteOrigin: 'http://915tldr.com' }, /^share-meta:.*siteOrigin/],
  ];
  for (const [patch, message] of bad) {
    assert.throws(() => shareMetaTags({ ...BASE, ...patch }), (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, message, JSON.stringify(patch));
      return true;
    });
  }
});

test('fallbackPageUrl: trailing slash removed except at the root', () => {
  assert.equal(fallbackPageUrl('/404', 'https://915tldr.com'), 'https://915tldr.com/404');
  assert.equal(fallbackPageUrl('/crime/', 'https://915tldr.com'), 'https://915tldr.com/crime');
  assert.equal(fallbackPageUrl('/', 'https://915tldr.com'), 'https://915tldr.com/');
});

test('fallbackPageUrl: a build.format "file" pathname loses its .html (measured: Astro.url.pathname is /404.html in a static build)', () => {
  assert.equal(fallbackPageUrl('/404.html', 'https://915tldr.com'), 'https://915tldr.com/404');
  assert.equal(fallbackPageUrl('/es/404.html', 'https://915tldr.com'), 'https://915tldr.com/es/404');
  assert.equal(fallbackPageUrl('/index.html', 'https://915tldr.com'), 'https://915tldr.com/');
  assert.equal(fallbackPageUrl('/es/index.html', 'https://915tldr.com'), 'https://915tldr.com/es');
});

test('shareImageUrl: absolute card URL for the language on the given origin', () => {
  assert.equal(shareImageUrl('en', 'https://915tldr.com'), 'https://915tldr.com/og-image.png');
  assert.equal(shareImageUrl('es', 'https://915tldr.com'), 'https://915tldr.com/og-image-es.png');
});
