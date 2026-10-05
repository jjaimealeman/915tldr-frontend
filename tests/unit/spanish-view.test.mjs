#!/usr/bin/env node
// 06-06 Task 1: pins `buildEsIndex`/`localizedArticleView` — the pure join between an English
// article and its (possibly missing or held) Spanish `articlesEs` entry. This module carries NO
// imports from `src/lib/server/`; this test file does not stub D1/KV because the module under
// test never touches them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEsIndex, localizedArticleView, categoryLabel } from '../../src/lib/i18n/spanish-view.ts';

const ENGLISH_ARTICLE = {
  title: 'El Paso faces Level 3 flash flood risk',
  summary: 'Heavy rain is forecast through the weekend.',
  keyPoints: ['Flash flood watch issued', 'Avoid low-lying roads'],
};

function esEntry(overrides = {}) {
  return {
    uuid: '201187fa-6484-4516-99d5-7e41da203323',
    sourceLanguage: 'en',
    available: true,
    title: 'El Paso enfrenta riesgo de inundación repentina',
    summary: 'Se pronostican fuertes lluvias durante el fin de semana.',
    keyPoints: ['Alerta de inundación repentina emitida', 'Evite calles bajas'],
    updatedAt: 1790099986,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildEsIndex
// ---------------------------------------------------------------------------

test('buildEsIndex: returns a Map keyed by uuid', () => {
  const a = esEntry({ uuid: 'aaaaaaaa-0000-4000-8000-000000000000' });
  const b = esEntry({ uuid: 'bbbbbbbb-0000-4000-8000-000000000000' });

  const index = buildEsIndex([a, b]);

  assert.ok(index instanceof Map);
  assert.equal(index.size, 2);
  assert.equal(index.get('aaaaaaaa-0000-4000-8000-000000000000'), a);
  assert.equal(index.get('bbbbbbbb-0000-4000-8000-000000000000'), b);
});

test('buildEsIndex: an empty list returns an empty Map', () => {
  const index = buildEsIndex([]);
  assert.equal(index.size, 0);
});

// ---------------------------------------------------------------------------
// localizedArticleView
// ---------------------------------------------------------------------------

test('localizedArticleView: an available (clean) entry returns Spanish content, translated: true', () => {
  const entry = esEntry();
  const view = localizedArticleView(ENGLISH_ARTICLE, entry);

  assert.deepEqual(view, {
    lang: 'es',
    title: entry.title,
    summary: entry.summary,
    keyPoints: entry.keyPoints,
    translated: true,
    sourceLanguage: 'en',
  });
});

test('localizedArticleView: a held (not available) entry falls back to English, translated: false, sourceLanguage from the held entry', () => {
  const entry = esEntry({ available: false, title: null, summary: null, keyPoints: null, sourceLanguage: 'es' });
  const view = localizedArticleView(ENGLISH_ARTICLE, entry);

  assert.deepEqual(view, {
    lang: 'en',
    title: ENGLISH_ARTICLE.title,
    summary: ENGLISH_ARTICLE.summary,
    keyPoints: ENGLISH_ARTICLE.keyPoints,
    translated: false,
    sourceLanguage: 'es',
  });
});

test('localizedArticleView: no entry at all (undefined) falls back to English, sourceLanguage "und"', () => {
  const view = localizedArticleView(ENGLISH_ARTICLE, undefined);

  assert.deepEqual(view, {
    lang: 'en',
    title: ENGLISH_ARTICLE.title,
    summary: ENGLISH_ARTICLE.summary,
    keyPoints: ENGLISH_ARTICLE.keyPoints,
    translated: false,
    sourceLanguage: 'und',
  });
});

test('localizedArticleView: a genuinely Spanish-origin article (D-07) held entry still reports sourceLanguage "es" while English renders', () => {
  const entry = esEntry({ available: false, title: null, summary: null, keyPoints: null, sourceLanguage: 'es' });
  const view = localizedArticleView(ENGLISH_ARTICLE, entry);

  assert.equal(view.sourceLanguage, 'es');
  assert.equal(view.translated, false);
  assert.equal(view.lang, 'en');
});

// ---------------------------------------------------------------------------
// categoryLabel re-export (06-05's category-labels.ts, reused for Spanish category names)
// ---------------------------------------------------------------------------

test('categoryLabel: re-exported from spanish-view.ts, translates a known category to Spanish', () => {
  assert.equal(categoryLabel('crime', 'es'), 'Crimen');
  assert.equal(categoryLabel('crime', 'en'), 'Crime');
});
