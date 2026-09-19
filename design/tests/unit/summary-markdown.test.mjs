// D-GAP revision request 9 — node:test suite for the summary markdown →
// typed-blocks → safe-HTML conversion. Every behavior bullet in
// 01-12-PLAN.md's <feature> block gets its own test, plus a sweep over
// every real fixture summary (stress-set.json) and every Spanish fixture
// string (spanish-stress.json), following the check-contrast.test.mjs
// style already used in this repo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  escapeHtml,
  parseSummary,
  renderSummaryHtml,
  summaryPlainText,
  validateBlocks,
} from '../../scripts/lib/summary-markdown.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STRESS_SET_PATH = path.join(__dirname, '../../fixtures/stress-set.json');
const SPANISH_STRESS_PATH = path.join(__dirname, '../../fixtures/spanish-stress.json');

// ---------------------------------------------------------------------------
// Basic empty / whitespace-only input
// ---------------------------------------------------------------------------

test("parseSummary('') returns []", () => {
  assert.deepEqual(parseSummary(''), []);
});

test("parseSummary('  \\n\\n ') (whitespace-only) returns []", () => {
  assert.deepEqual(parseSummary('  \n\n '), []);
});

// ---------------------------------------------------------------------------
// Single paragraph / multiple paragraphs
// ---------------------------------------------------------------------------

test("parseSummary('One sentence.') returns a single plain-text paragraph", () => {
  assert.deepEqual(parseSummary('One sentence.'), [
    { type: 'p', inlines: [{ text: 'One sentence.' }] },
  ]);
});

test("parseSummary('A.\\n\\nB.') splits on a blank line into two paragraphs", () => {
  assert.deepEqual(parseSummary('A.\n\nB.'), [
    { type: 'p', inlines: [{ text: 'A.' }] },
    { type: 'p', inlines: [{ text: 'B.' }] },
  ]);
});

// ---------------------------------------------------------------------------
// Key Details + bullets: the core corpus pattern
// ---------------------------------------------------------------------------

test('Prose + Key Details + bullets parses to [p, p(strong), list] and renders exact HTML', () => {
  const markdown = 'Prose.\n\n**Key Details:**\n• one\n• two';
  const blocks = parseSummary(markdown);
  assert.deepEqual(blocks, [
    { type: 'p', inlines: [{ text: 'Prose.' }] },
    { type: 'p', inlines: [{ text: 'Key Details:', strong: true }] },
    {
      type: 'list',
      items: [[{ text: 'one' }], [{ text: 'two' }]],
    },
  ]);
  const html = renderSummaryHtml(blocks);
  assert.equal(
    html,
    '<p>Prose.</p>\n<p><strong>Key Details:</strong></p>\n<ul data-key-details><li>one</li><li>two</li></ul>'
  );
});

test('The CRLF form of the Key Details case gives the same result as its LF form', () => {
  const lf = 'Prose.\n\n**Key Details:**\n• one\n• two';
  const crlf = 'Prose.\r\n\r\n**Key Details:**\r\n• one\r\n• two';
  assert.deepEqual(parseSummary(crlf), parseSummary(lf));
});

// ---------------------------------------------------------------------------
// Inline bold parsing
// ---------------------------------------------------------------------------

test("'The **big** day' produces plain/strong/plain inlines", () => {
  const blocks = parseSummary('The **big** day');
  assert.deepEqual(blocks, [
    {
      type: 'p',
      inlines: [{ text: 'The ' }, { text: 'big', strong: true }, { text: ' day' }],
    },
  ]);
});

test("'Price ** unmatched' keeps the unmatched ** as literal text with no strong tag", () => {
  const blocks = parseSummary('Price ** unmatched');
  assert.deepEqual(blocks, [{ type: 'p', inlines: [{ text: 'Price ** unmatched' }] }]);
  const html = renderSummaryHtml(blocks);
  assert.doesNotMatch(html, /<strong>/);
  assert.match(html, /Price \*\* unmatched/);
});

// ---------------------------------------------------------------------------
// HTML escaping / safety
// ---------------------------------------------------------------------------

test('script tags and quote characters are escaped, never emitted as raw HTML', () => {
  const markdown = '<script>alert(1)</script> & "q" \'a\'';
  const blocks = parseSummary(markdown);
  const html = renderSummaryHtml(blocks);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
  assert.match(html, /&quot;/);
  assert.match(html, /&#39;/);
  assert.doesNotMatch(html, /<script/);
});

test('escapeHtml escapes exactly & < > " \' and nothing else', () => {
  assert.equal(escapeHtml('& < > " \''), '&amp; &lt; &gt; &quot; &#39;');
  assert.equal(escapeHtml('plain text'), 'plain text');
});

// ---------------------------------------------------------------------------
// Non-ASCII / Spanish characters pass through unchanged
// ---------------------------------------------------------------------------

test('Spanish and other non-ASCII characters are preserved code point for code point', () => {
  const markdown = 'Ciudad Juárez — niños, ñ, ü, “cita”…';
  const blocks = parseSummary(markdown);
  assert.equal(blocks[0].inlines[0].text, markdown);
  const html = renderSummaryHtml(blocks);
  assert.match(html, /Ciudad Juárez — niños, ñ, ü, “cita”…/);
});

// ---------------------------------------------------------------------------
// Bullet-like lines that are NOT real bullets
// ---------------------------------------------------------------------------

test("'•no space' (no space after bullet) stays literal paragraph text", () => {
  assert.deepEqual(parseSummary('•no space'), [
    { type: 'p', inlines: [{ text: '•no space' }] },
  ]);
});

test("'- dash item' stays literal paragraph text, not a list", () => {
  assert.deepEqual(parseSummary('- dash item'), [
    { type: 'p', inlines: [{ text: '- dash item' }] },
  ]);
});

test("'* star item' and '1. numbered item' stay literal paragraph text, not a list", () => {
  assert.deepEqual(parseSummary('* star item'), [
    { type: 'p', inlines: [{ text: '* star item' }] },
  ]);
  assert.deepEqual(parseSummary('1. numbered item'), [
    { type: 'p', inlines: [{ text: '1. numbered item' }] },
  ]);
});

// ---------------------------------------------------------------------------
// summaryPlainText
// ---------------------------------------------------------------------------

test('summaryPlainText joins each paragraph and each list item with \\n', () => {
  const blocks = parseSummary('Prose.\n\n**Key Details:**\n• one\n• two');
  assert.equal(summaryPlainText(blocks), 'Prose.\nKey Details:\none\ntwo');
});

// ---------------------------------------------------------------------------
// validateBlocks
// ---------------------------------------------------------------------------

test('validateBlocks returns [] for any parseSummary output', () => {
  const samples = [
    '',
    'One sentence.',
    'A.\n\nB.',
    'Prose.\n\n**Key Details:**\n• one\n• two',
    'The **big** day',
    'Price ** unmatched',
    'Ciudad Juárez — niños, ñ, ü, “cita”…',
  ];
  for (const sample of samples) {
    assert.deepEqual(validateBlocks(parseSummary(sample)), []);
  }
});

test('validateBlocks rejects malformed block structures', () => {
  assert.ok(validateBlocks([{ type: 'h2' }]).length > 0);
  assert.ok(validateBlocks([{ type: 'p', inlines: [{ text: '' }] }]).length > 0);
  assert.ok(validateBlocks([{ type: 'p', inlines: [{ text: 'x', strong: false }] }]).length > 0);
  assert.ok(validateBlocks([{ type: 'list', items: [[{ text: 1 }]] }]).length > 0);
  assert.ok(validateBlocks([{ type: 'p', inlines: [], extra: 1 }]).length > 0);
});

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

test('the module exports exactly the five named functions', async () => {
  const mod = await import('../../scripts/lib/summary-markdown.mjs');
  const keys = Object.keys(mod).sort().join(',');
  assert.equal(keys, 'escapeHtml,parseSummary,renderSummaryHtml,summaryPlainText,validateBlocks');
});

// ---------------------------------------------------------------------------
// Fixture sweep — every real corpus summary in stress-set.json
// ---------------------------------------------------------------------------

/**
 * stress-set.json's `cases` object is a hand-authored mix of shapes — a bare
 * row, arrays of rows, `{ chosen, rejected }` pairs, a `{ rows, chosen }`
 * pair, and non-row metadata with no `uuid` at all. Walk the whole structure
 * recursively and collect every object carrying `uuid` (string), `status`
 * (present) and a string `summary` — the same approach content.spec.ts
 * already uses for this fixture, extended with the `summary` requirement
 * this plan needs.
 */
function collectFixtureRows(raw) {
  const rows = [];
  const seen = new Set();
  function walk(value) {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === 'object') {
      const obj = value;
      if (
        typeof obj.uuid === 'string' &&
        'status' in obj &&
        typeof obj.summary === 'string' &&
        !seen.has(obj.uuid)
      ) {
        seen.add(obj.uuid);
        rows.push(obj);
      }
      for (const v of Object.values(obj)) walk(v);
    }
  }
  walk(raw.cases);
  return rows;
}

/**
 * Normalises a raw summary source string and a rendered summaryPlainText
 * output onto the same comparable form: strip every `**` marker, strip a
 * bullet-plus-space prefix from the start of any line, then collapse all
 * whitespace runs to a single space and trim. Applying this to BOTH sides
 * of a comparison is safe: applying it to text that never had `**`/bullets
 * (e.g. an already-rendered plain-text output) is a no-op beyond whitespace
 * collapsing.
 */
function normalizeForComparison(text) {
  const withoutBullets = text
    .split('\n')
    .map((line) => (line.startsWith('• ') ? line.slice(2) : line))
    .join('\n');
  const withoutStars = withoutBullets.replace(/\*\*/g, '');
  return withoutStars.replace(/\s+/g, ' ').trim();
}

test('fixture sweep: every stress-set.json summary parses and renders without throwing', () => {
  const raw = JSON.parse(readFileSync(STRESS_SET_PATH, 'utf8'));
  const rows = collectFixtureRows(raw);
  assert.ok(rows.length > 0, 'expected at least one fixture row with uuid+status+summary');

  for (const row of rows) {
    let blocks;
    assert.doesNotThrow(() => {
      blocks = parseSummary(row.summary);
    }, `parseSummary threw for uuid ${row.uuid}`);

    let html;
    assert.doesNotThrow(() => {
      html = renderSummaryHtml(blocks);
    }, `renderSummaryHtml threw for uuid ${row.uuid}`);

    assert.doesNotMatch(html, /\*\*/, `rendered HTML for uuid ${row.uuid} still contains **`);

    if (row.summary.includes('**Key Details:**')) {
      const keyDetailsIndex = blocks.findIndex(
        (b) =>
          b.type === 'p' &&
          b.inlines.length === 1 &&
          b.inlines[0].strong === true &&
          b.inlines[0].text === 'Key Details:'
      );
      assert.ok(
        keyDetailsIndex !== -1,
        `expected a single-strong-inline "Key Details:" paragraph for uuid ${row.uuid}`
      );

      const listBlock = blocks[keyDetailsIndex + 1];
      assert.ok(
        listBlock && listBlock.type === 'list',
        `expected a list block immediately after Key Details for uuid ${row.uuid}`
      );

      const bulletLineCount = row.summary
        .split('\n')
        .filter((line) => line.startsWith('• ')).length;
      assert.equal(
        listBlock.items.length,
        bulletLineCount,
        `expected ${bulletLineCount} list items for uuid ${row.uuid}`
      );

      const actual = normalizeForComparison(summaryPlainText(blocks));
      const expected = normalizeForComparison(row.summary);
      assert.equal(actual, expected, `plain-text round trip mismatch for uuid ${row.uuid}`);
    }

    assert.deepEqual(validateBlocks(blocks), [], `validateBlocks found problems for uuid ${row.uuid}`);
  }
});

// ---------------------------------------------------------------------------
// Spanish sweep — every string field of every spanish-stress.json component
// ---------------------------------------------------------------------------

test('Spanish sweep: every spanish-stress.json component string survives parse + summaryPlainText', () => {
  const raw = JSON.parse(readFileSync(SPANISH_STRESS_PATH, 'utf8'));
  assert.ok(Array.isArray(raw.components) && raw.components.length > 0);

  for (const component of raw.components) {
    for (const [field, value] of Object.entries(component)) {
      if (typeof value !== 'string') continue;

      let blocks;
      assert.doesNotThrow(() => {
        blocks = parseSummary(value);
      }, `parseSummary threw for component ${component.id} field ${field}`);

      const actual = normalizeForComparison(summaryPlainText(blocks));
      const expected = normalizeForComparison(value);
      assert.equal(
        actual,
        expected,
        `code points did not survive round trip for component ${component.id} field ${field}`
      );
    }
  }
});
