#!/usr/bin/env node
// 06-09 Task 1 (RED-first): pins `esArticlePageModel`/`enArticleLanguageModel` — the pure page
// model the `/es` article route and the English article page's language-pair props both read
// through. Pure module, no I/O, no D1 — this test stubs nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esArticlePageModel, enArticleLanguageModel } from '../../src/lib/i18n/article-page.ts';
import { articlePath } from '../../src/lib/article-url.ts';
import { t } from '../../src/lib/i18n/dictionary.ts';

const EMPTY_RAIL = { more: [], second: [], secondHeading: 'Earlier' };

function article(overrides = {}) {
  return {
    uuid: '201187fa-6484-4516-99d5-7e41da203323',
    title: 'El Paso faces Level 3 flash flood risk',
    slug: 'el-paso-faces-level-3-flash-flood-risk',
    summary: 'Heavy rain is forecast through the weekend. Avoid low-lying roads.',
    keyPoints: ['Flash flood watch issued', 'Avoid low-lying roads'],
    url: 'https://www.ktsm.com/news/flash-flood',
    publishedAt: 1790099986,
    category: { slug: 'weather', name: 'Weather' },
    tags: [],
    source: { slug: 'ktsm', name: 'KTSM', websiteUrl: 'https://www.ktsm.com' },
    ...overrides,
  };
}

function esEntry(overrides = {}) {
  return {
    uuid: '201187fa-6484-4516-99d5-7e41da203323',
    sourceLanguage: 'en',
    available: true,
    title: 'El Paso enfrenta riesgo de inundación repentina',
    summary: 'Se pronostican fuertes lluvias durante el fin de semana. Evite calles bajas.',
    keyPoints: ['Alerta de inundación repentina emitida', 'Evite calles bajas'],
    updatedAt: 1790099986,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// esArticlePageModel
// ---------------------------------------------------------------------------

test('esArticlePageModel: an available (clean) entry renders Spanish, translated, paired', () => {
  const a = article();
  const entry = esEntry();
  const model = esArticlePageModel(a, entry, EMPTY_RAIL);

  assert.equal(model.translated, true);
  assert.equal(model.contentLang, 'es');
  assert.equal(model.noindex, false);
  assert.equal(model.alternates, 'paired');
  assert.equal(model.title, entry.title);
  assert.equal(model.canonicalPath, articlePath(a.category.slug, a.slug, a.uuid, 'es'));
  assert.equal(model.switchPath, articlePath(a.category.slug, a.slug, a.uuid, 'en'));
  assert.equal('fallbackNote' in model, false);
  assert.equal('invalidSpanish' in model, false);
  assert.equal(model.sourceLanguage, 'en');
  assert.ok(model.bodyHtml.length > 0);
});

test('esArticlePageModel: a held entry degrades to the English fallback — noindex, no alternates, visible note', () => {
  const a = article();
  const held = esEntry({ available: false, title: null, summary: null, keyPoints: null, sourceLanguage: 'es' });
  const model = esArticlePageModel(a, held, EMPTY_RAIL);

  assert.equal(model.translated, false);
  assert.equal(model.contentLang, 'en');
  assert.equal(model.noindex, true);
  assert.equal(model.alternates, 'none');
  assert.equal(model.title, a.title);
  assert.equal(model.fallbackNote, t('fallbackNote', 'es'));
  // D-07: the held entry's own sourceLanguage carries through even though translated is false.
  assert.equal(model.sourceLanguage, 'es');
});

test('esArticlePageModel: no entry at all (I18N-04 empty case) degrades the same way, sourceLanguage "und"', () => {
  const a = article();
  const model = esArticlePageModel(a, undefined, EMPTY_RAIL);

  assert.equal(model.translated, false);
  assert.equal(model.contentLang, 'en');
  assert.equal(model.noindex, true);
  assert.equal(model.alternates, 'none');
  assert.equal(model.fallbackNote, t('fallbackNote', 'es'));
  assert.equal(model.sourceLanguage, 'und');
});

test('esArticlePageModel: an available entry whose text fails block validation degrades to the fallback, invalidSpanish: true, never throws', () => {
  const a = article();
  // An empty-string key point is something the real zod-validated loader can never produce
  // (articleEsSchema requires z.string().min(1) on every item) — constructed directly here to
  // exercise this function's own defensive degrade path (T-06-34: summaryBodyHtml's block
  // validation failing must never crash the build or leak raw text through set:html).
  const invalid = esEntry({ keyPoints: [''] });

  const model = esArticlePageModel(a, invalid, EMPTY_RAIL);

  assert.equal(model.translated, false);
  assert.equal(model.contentLang, 'en');
  assert.equal(model.noindex, true);
  assert.equal(model.invalidSpanish, true);
  assert.equal(model.title, a.title);
});

// ---------------------------------------------------------------------------
// enArticleLanguageModel
// ---------------------------------------------------------------------------

test('enArticleLanguageModel: an available entry pairs, esPath set, sourceLanguage threaded', () => {
  const a = article();
  const entry = esEntry();
  const model = enArticleLanguageModel(a, entry);

  assert.equal(model.alternates, 'paired');
  assert.equal(model.esPath, articlePath(a.category.slug, a.slug, a.uuid, 'es'));
  assert.equal(model.sourceLanguage, 'en');
});

test('enArticleLanguageModel: a held entry does not pair (would point hreflang at English content)', () => {
  const a = article();
  const held = esEntry({ available: false, title: null, summary: null, keyPoints: null, sourceLanguage: 'es' });
  const model = enArticleLanguageModel(a, held);

  assert.equal(model.alternates, 'self');
  assert.equal('esPath' in model, false);
  assert.equal(model.sourceLanguage, 'es');
});

test('enArticleLanguageModel: no entry at all does not pair, sourceLanguage "und"', () => {
  const a = article();
  const model = enArticleLanguageModel(a, undefined);

  assert.equal(model.alternates, 'self');
  assert.equal('esPath' in model, false);
  assert.equal(model.sourceLanguage, 'und');
});
