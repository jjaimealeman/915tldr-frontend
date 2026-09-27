// 04-04 (Task 2): standfirst split (Phase 1 D-10) and safe summary body rendering — pure module,
// no I/O, no build required. Follows the `node:test` + `assert/strict` structure this repo uses
// (tests/unit/format.test.mjs, tests/unit/structured-data.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitStandfirst, summaryBodyHtml } from '../../src/lib/summary.ts';

// The exact standfirst/body pair from the approved mockup (design/mockups/article.html lines
// 283/288) — the named test the plan's own acceptance criteria requires.
const MOCKUP_SUMMARY =
  'The U.S. Postal Service has begun its annual Operation Santa, inviting residents to send ' +
  'letters to Santa Claus. This cherished initiative, which has been running since 1912, allows ' +
  "individuals to adopt letters from children and fulfill their holiday wishes. This year, El " +
  'Pasoans are encouraged to participate and spread joy during the festive season. The program ' +
  "not only brings smiles to children's faces but also fosters community spirit by connecting " +
  'donors with those in need.';

test('splitStandfirst: the approved mockup pair — standfirst ends at "...to Santa Claus." and rest starts at "This cherished initiative"', () => {
  const { standfirst, rest } = splitStandfirst(MOCKUP_SUMMARY);
  assert.equal(
    standfirst,
    'The U.S. Postal Service has begun its annual Operation Santa, inviting residents to send letters to Santa Claus.'
  );
  assert.ok(rest.startsWith('This cherished initiative'), `rest should start with "This cherished initiative", got: ${rest.slice(0, 40)}`);
});

test('splitStandfirst: does not break after "Dr." mid-sentence', () => {
  const { standfirst } = splitStandfirst(
    'Dr. Martinez treated 14 patients today. The clinic remains open through the weekend.'
  );
  assert.equal(standfirst, 'Dr. Martinez treated 14 patients today.');
});

test('splitStandfirst: does not break after "St." mid-sentence', () => {
  const { standfirst } = splitStandfirst(
    'The fire started on N. Mesa St. near downtown. Crews responded within minutes.'
  );
  assert.equal(standfirst, 'The fire started on N. Mesa St. near downtown.');
});

test('splitStandfirst: does not break after "a.m." or "p.m." mid-sentence', () => {
  const { standfirst } = splitStandfirst(
    'The meeting starts at 9 a.m. sharp. Doors open at 8 p.m. the night before.'
  );
  assert.equal(standfirst, 'The meeting starts at 9 a.m. sharp.');
});

test('splitStandfirst: does not break after "Sept." mid-sentence (AP month abbreviation)', () => {
  const { standfirst } = splitStandfirst(
    'The vote is scheduled for Sept. 16 at city hall. Residents may attend in person.'
  );
  assert.equal(standfirst, 'The vote is scheduled for Sept. 16 at city hall.');
});

test('splitStandfirst: does not break after "No." mid-sentence', () => {
  const { standfirst } = splitStandfirst(
    'Case No. 45 was closed by the district attorney. The judge announced a new ruling.'
  );
  assert.equal(standfirst, 'Case No. 45 was closed by the district attorney.');
});

test('splitStandfirst: a one-sentence summary returns that sentence as standfirst and an empty rest', () => {
  const { standfirst, rest } = splitStandfirst('The city council approved the new budget.');
  assert.equal(standfirst, 'The city council approved the new budget.');
  assert.equal(rest, '');
});

test('splitStandfirst: empty/whitespace input returns empty standfirst and rest', () => {
  assert.deepEqual(splitStandfirst(''), { standfirst: '', rest: '' });
  assert.deepEqual(splitStandfirst('   '), { standfirst: '', rest: '' });
});

// --- summaryBodyHtml ------------------------------------------------------------------------

test('summaryBodyHtml: a legacy summary with an inline "Key Details:" label and bullets renders the remaining paragraphs plus the key-details list, escaping "<" and "&"', () => {
  const summary =
    'The council approved a new <budget> today. It funds parks & libraries this year.\n\n' +
    '**Key Details:**\n' +
    '• Total spend: $4.2 million\n' +
    '• Includes a new library <branch>';

  const html = summaryBodyHtml(summary, null);

  // The standfirst sentence ("The council approved a new <budget> today.") is dropped.
  assert.ok(!html.includes('approved a new'));
  // The remaining paragraph sentence survives, with its "&" escaped.
  assert.ok(html.includes('It funds parks &amp; libraries this year.'));
  // The inline Key Details label survives as a paragraph with a <strong> run.
  assert.ok(html.includes('<strong>Key Details:</strong>'));
  // The bullet list renders with its "<branch>" escaped, never as a raw tag.
  assert.ok(html.includes('<ul data-key-details>'));
  assert.ok(html.includes('Includes a new library &lt;branch&gt;'));
  assert.ok(!html.includes('<branch>'));
});

test('summaryBodyHtml: keyPoints appends a rendered list through the same block contract when the summary has no inline Key Details', () => {
  const summary = 'Firefighters responded to a two-alarm blaze downtown. No injuries were reported.';
  const html = summaryBodyHtml(summary, ['Fire started near Mesa and Yandell', 'Contained within an hour']);

  assert.ok(html.includes('No injuries were reported.'));
  assert.ok(html.includes('<ul data-key-details>'));
  assert.ok(html.includes('<li>Fire started near Mesa and Yandell</li>'));
  assert.ok(html.includes('<li>Contained within an hour</li>'));
});

test('summaryBodyHtml: null keyPoints renders paragraphs only, no key-details list', () => {
  const summary = 'Firefighters responded to a two-alarm blaze downtown. No injuries were reported.';
  const html = summaryBodyHtml(summary, null);

  assert.ok(html.includes('No injuries were reported.'));
  assert.ok(!html.includes('data-key-details'));
});

test('summaryBodyHtml: an inline Key Details block wins over a non-null keyPoints — no duplicate list', () => {
  const summary =
    'A new ordinance passed the city council. It takes effect next month.\n\n' +
    '**Key Details:**\n' +
    '• Applies citywide';
  const html = summaryBodyHtml(summary, ['This should not appear']);

  const listMatches = html.match(/<ul data-key-details>/g) ?? [];
  assert.equal(listMatches.length, 1, 'expected exactly one key-details list, not a duplicate');
  assert.ok(!html.includes('This should not appear'));
});
