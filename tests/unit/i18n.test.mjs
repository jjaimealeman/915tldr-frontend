// 06-05 (Task 1): pure, pre-build unit coverage for the fixed EN/ES dictionary (D-15) and the
// fixed Spanish category label map (D-02). Follows this repo's `node:test` + `assert/strict`
// convention (tests/unit/format.test.mjs, tests/unit/article-url.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARY, t } from '../../src/lib/i18n/dictionary.ts';
import { CATEGORY_LABELS_ES, categoryLabel } from '../../src/lib/i18n/category-labels.ts';
import { CATEGORIES } from '../../src/lib/categories.ts';

test('t: navLabel renders "Secciones" for es and "Sections" for en', () => {
  assert.equal(t('navLabel', 'es'), 'Secciones');
  assert.equal(t('navLabel', 'en'), 'Sections');
});

test('t: aiDisclosure substitutes {source} and carries the same meaning in both languages', () => {
  const en = t('aiDisclosure', 'en', { source: 'KVIA' });
  const es = t('aiDisclosure', 'es', { source: 'KVIA' });
  assert.ok(en.includes('KVIA'), `expected the English disclosure to include "KVIA", got "${en}"`);
  assert.ok(es.includes('KVIA'), `expected the Spanish disclosure to include "KVIA", got "${es}"`);
  assert.match(en, /written by AI/i);
  assert.match(es, /redactado por IA/i);
});

test('t: throws on an unknown key', () => {
  assert.throws(() => t('thisKeyDoesNotExist', 'en'));
});

test('t: throws on an invalid language', () => {
  assert.throws(() => t('navLabel', 'fr'));
  assert.throws(() => t('navLabel', 'ES'));
});

test('DICTIONARY: every entry has a non-empty en and es string', () => {
  for (const [key, entry] of Object.entries(DICTIONARY)) {
    assert.ok(typeof entry.en === 'string' && entry.en.length > 0, `${key}.en must be a non-empty string`);
    assert.ok(typeof entry.es === 'string' && entry.es.length > 0, `${key}.es must be a non-empty string`);
  }
});

test('categoryLabel: translates every CATEGORIES slug, en passthrough + es from the fixed map', () => {
  assert.equal(categoryLabel('crime', 'es'), 'Crimen');
  assert.equal(categoryLabel('crime', 'en'), 'Crime');
  for (const category of CATEGORIES) {
    const es = categoryLabel(category.slug, 'es');
    assert.ok(
      typeof es === 'string' && es.length > 0,
      `expected a non-empty Spanish label for category "${category.slug}"`
    );
    assert.equal(categoryLabel(category.slug, 'en'), category.name);
  }
});

test('categoryLabel: returns undefined for an unknown slug (never throws — UI lookup contract)', () => {
  assert.equal(categoryLabel('not-a-real-category', 'es'), undefined);
  assert.equal(categoryLabel('not-a-real-category', 'en'), undefined);
});

test('CATEGORY_LABELS_ES: has an entry for every CATEGORIES slug', () => {
  for (const category of CATEGORIES) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(CATEGORY_LABELS_ES, category.slug),
      `expected CATEGORY_LABELS_ES to have a "${category.slug}" entry`
    );
  }
});
