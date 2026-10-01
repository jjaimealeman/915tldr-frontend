// 04-02 (Task 1, RED-first) / T-04-05: pins injection-safe JSON-LD serialisation and the
// schema.org node builders every page's `<head>` and article page will render. Follows this
// repo's `node:test` + `assert/strict` convention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toSafeJsonLd,
  organizationNode,
  websiteNode,
  newsArticleNode,
  breadcrumbNode,
  SITE_NAME,
} from '../../src/lib/structured-data.ts';

const ORIGIN = 'https://915tldr.com';

test('SITE_NAME is "915 TLDR"', () => {
  assert.equal(SITE_NAME, '915 TLDR');
});

test('toSafeJsonLd: a headline containing a literal </script><script> cannot close the script element and round-trips via JSON.parse', () => {
  const input = { headline: 'a </script><script>x' };
  const safe = toSafeJsonLd(input);
  assert.ok(!safe.includes('</script'), `expected no literal "</script" substring, got: ${safe}`);
  assert.deepEqual(JSON.parse(safe), input);
});

test('toSafeJsonLd: escapes <, >, &, the line separator and the paragraph separator', () => {
  // Built via String.fromCharCode rather than a typed escape sequence in this file's own source
  // text — see src/lib/structured-data.ts's identical convention and its comment explaining why.
  const lineSeparator = String.fromCharCode(0x2028);
  const paragraphSeparator = String.fromCharCode(0x2029);
  const input = { text: `<a>&${lineSeparator}${paragraphSeparator}` };
  const safe = toSafeJsonLd(input);
  assert.ok(!safe.includes('<'));
  assert.ok(!safe.includes('>'));
  assert.ok(!safe.includes('&'));
  assert.ok(!safe.includes(lineSeparator));
  assert.ok(!safe.includes(paragraphSeparator));
  assert.deepEqual(JSON.parse(safe), input);
});

test('organizationNode: stable @id, @type Organization', () => {
  const node = organizationNode(ORIGIN);
  assert.equal(node['@id'], 'https://915tldr.com/#organization');
  assert.equal(node['@type'], 'Organization');
  assert.equal(node.name, SITE_NAME);
});

test('websiteNode: stable @id, @type WebSite, publisher references the Organization @id', () => {
  const node = websiteNode(ORIGIN);
  assert.equal(node['@id'], 'https://915tldr.com/#website');
  assert.equal(node['@type'], 'WebSite');
  assert.deepEqual(node.publisher, { '@id': 'https://915tldr.com/#organization' });
  assert.equal(node.inLanguage, 'en');
});

function baseArticleInput(overrides = {}) {
  return {
    origin: ORIGIN,
    canonicalPath: '/community/usps-launches-operation-santa-a90c2be1-600a-4f16-ad94-9118e1d50088',
    headline: 'USPS Launches Operation Santa',
    datePublishedIso: '2026-09-16T13:06:48-06:00',
    section: 'Community',
    sourceName: 'KTSM',
    sourceUrl: 'https://www.ktsm.com/news/usps-operation-santa',
    ...overrides,
  };
}

test('newsArticleNode: author and publisher are the Organization @id, never a Person', () => {
  const node = newsArticleNode(baseArticleInput());
  assert.deepEqual(node.author, { '@id': 'https://915tldr.com/#organization' });
  assert.deepEqual(node.publisher, { '@id': 'https://915tldr.com/#organization' });
  assert.equal(node['@type'], 'NewsArticle');
});

test('newsArticleNode: isBasedOn carries the original article url and outlet name', () => {
  const node = newsArticleNode(baseArticleInput());
  assert.equal(node.isBasedOn.url, 'https://www.ktsm.com/news/usps-operation-santa');
  assert.equal(node.isBasedOn.publisher.name, 'KTSM');
  // 04-followups (task 2): 'CreativeWork', not 'NewsArticle' — Google's Rich Results Test
  // reported the latter as a separate, incomplete "Unnamed item" NewsArticle (missing
  // image/author/headline of its own). isBasedOn only needs to identify the source work.
  assert.equal(node.isBasedOn['@type'], 'CreativeWork');
});

test('newsArticleNode: omits keywords when tags are empty', () => {
  const node = newsArticleNode(baseArticleInput({ tags: [] }));
  assert.equal('keywords' in node, false);
  const nodeNoTags = newsArticleNode(baseArticleInput());
  assert.equal('keywords' in nodeNoTags, false);
});

test('newsArticleNode: emits keywords in sorted order when tags are present', () => {
  const node = newsArticleNode(baseArticleInput({ tags: ['usps', 'charity', 'holiday'] }));
  assert.equal(node.keywords, 'charity, holiday, usps');
});

test('newsArticleNode: omits description when empty, includes it when present', () => {
  const withoutDescription = newsArticleNode(baseArticleInput());
  assert.equal('description' in withoutDescription, false);
  const withDescription = newsArticleNode(baseArticleInput({ description: 'A short summary.' }));
  assert.equal(withDescription.description, 'A short summary.');
});

test('newsArticleNode: two articles with the same headline get different @id values', () => {
  const nodeA = newsArticleNode(
    baseArticleInput({ canonicalPath: '/community/article-one-a90c2be1-600a-4f16-ad94-9118e1d50088' })
  );
  const nodeB = newsArticleNode(
    baseArticleInput({ canonicalPath: '/community/article-two-326af4d4-ff96-4dec-8da2-a02085a802b3' })
  );
  assert.notEqual(nodeA['@id'], nodeB['@id']);
});

test('breadcrumbNode: positions start at 1 with absolute item URLs', () => {
  const node = breadcrumbNode([
    { name: 'Home', path: '/' },
    { name: 'Crime', path: '/crime' },
  ]);
  assert.equal(node['@type'], 'BreadcrumbList');
  assert.equal(node.itemListElement.length, 2);
  assert.equal(node.itemListElement[0].position, 1);
  assert.equal(node.itemListElement[0].item, 'https://915tldr.com/');
  assert.equal(node.itemListElement[1].position, 2);
  assert.equal(node.itemListElement[1].item, 'https://915tldr.com/crime');
});
