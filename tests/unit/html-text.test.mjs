#!/usr/bin/env node
// Task 2 (04-01-PLAN.md): pins `decodeEntities`/`textOf` against the exact failure mode that
// broke the pre-Phase-4 tracer test — comparing raw D1 text against Astro-escaped HTML
// (.planning/todos/pending/2026-09-26-tracer-test-html-entity-title.md).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, textOf } from '../helpers/html-text.mjs';

test('decodeEntities decodes a named apostrophe and ampersand entity', () => {
  assert.equal(decodeEntities('It&#39;s Tom &amp; Jerry'), "It's Tom & Jerry");
});

test('decodeEntities decodes &quot; &lt; &gt; and hex &#x27;', () => {
  assert.equal(decodeEntities('&quot;quoted&quot;'), '"quoted"');
  assert.equal(decodeEntities('a &lt; b &gt; c'), 'a < b > c');
  assert.equal(decodeEntities('&#x27;hex apostrophe&#x27;'), "'hex apostrophe'");
});

test('decodeEntities leaves text without entities unchanged', () => {
  assert.equal(decodeEntities('El Paso faces Level 3 flash flood risk'), 'El Paso faces Level 3 flash flood risk');
});

test('textOf strips tags and decodes entities', () => {
  const html = '<h1>El Paso Water &amp; Power warns of <em>flooding</em></h1>';
  assert.equal(textOf(html), 'El Paso Water & Power warns of flooding');
});

test('textOf handles a title carrying both an apostrophe and an ampersand', () => {
  const html = "<h1>It&#39;s Tom &amp; Jerry&#39;s big day</h1>";
  assert.equal(textOf(html), "It's Tom & Jerry's big day");
});
