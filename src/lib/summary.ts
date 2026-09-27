// 04-04 (Task 2): standfirst split (Phase 1 D-10) and safe summary body rendering. `splitStandfirst`
// pulls the summary's own opening sentence out as the standfirst deck; `summaryBodyHtml` renders
// everything after it, plus a `keyPoints` list when the summary carries no inline "Key Details:"
// block of its own. Pure module, no I/O, no dependency on the D1-access boundary the rest of this
// project enforces — mirrors `src/lib/format.ts`/`src/lib/structured-data.ts`'s "pure, build-
// anywhere module" convention.
//
// design/scripts/lib/summary-markdown.mjs's `renderSummaryHtml` is the ONLY escaping path in this
// pipeline (T-04-14) — this module never re-escapes text itself; it only decides which blocks to
// render.
import {
  parseSummary,
  renderSummaryHtml,
  validateBlocks,
} from '../../design/scripts/lib/summary-markdown.mjs';

// Node 24's `Intl.Segmenter('en-u-ss-standard', { granularity: 'sentence' })` correctly handles
// most sentence boundaries (verified live against this project's own corpus text), but ICU's
// sentence-break heuristic has no abbreviation dictionary — it reports a boundary after every
// period regardless of context, splitting "The U.S. Postal Service..." into "The U.S." + "Postal
// Service...". Each entry below is the exact trailing text that, when a raw ICU segment ends with
// it, means that boundary is not a real sentence end and the next segment must be merged back in.
const NON_TERMINAL_ABBREVIATIONS = [
  'U.S.',
  'Dr.',
  'Mr.',
  'Mrs.',
  'Ms.',
  'St.',
  'Jr.',
  'Sr.',
  'Gov.',
  'Sen.',
  'Rep.',
  'Lt.',
  'Sgt.',
  'Capt.',
  'No.',
  'a.m.',
  'p.m.',
  // AP month abbreviations (src/lib/format.ts's AP_MONTHS, minus the four spelled-out months —
  // March, April, May, June, July never end in a period, so ICU's own boundary is correct there).
  'Jan.',
  'Feb.',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
];

function endsWithAbbreviation(text: string): boolean {
  const trimmed = text.trimEnd();
  return NON_TERMINAL_ABBREVIATIONS.some((abbreviation) => trimmed.endsWith(abbreviation));
}

/** Merges ICU's raw sentence segments back together wherever a segment ends with a known
 * abbreviation — see the comment above `NON_TERMINAL_ABBREVIATIONS`. */
function mergeSentences(rawSegments: string[]): string[] {
  const merged: string[] = [];
  let buffer = '';
  for (const segment of rawSegments) {
    buffer += segment;
    if (endsWithAbbreviation(buffer)) continue;
    merged.push(buffer);
    buffer = '';
  }
  if (buffer.length > 0) merged.push(buffer);
  return merged;
}

export interface StandfirstSplit {
  /** The summary's opening sentence, trimmed. Empty when the input is empty/whitespace-only. */
  standfirst: string;
  /** Everything after the standfirst sentence, trimmed. Empty when the summary is one sentence. */
  rest: string;
}

/**
 * Splits a summary's opening sentence (Phase 1 D-10's standfirst deck) from the remaining body
 * text, using `Intl.Segmenter` sentence boundaries corrected for known non-terminal abbreviations.
 */
export function splitStandfirst(text: string): StandfirstSplit {
  if (typeof text !== 'string' || text.trim() === '') {
    return { standfirst: '', rest: '' };
  }

  const segmenter = new Intl.Segmenter('en-u-ss-standard', { granularity: 'sentence' });
  const rawSegments = Array.from(segmenter.segment(text), (s) => s.segment);
  const merged = mergeSentences(rawSegments);

  if (merged.length === 0) {
    return { standfirst: text.trim(), rest: '' };
  }

  const standfirst = merged[0].trim();
  const rest = merged.slice(1).join('').trim();
  return { standfirst, rest };
}

function keyPointsBlock(points: string[]) {
  return { type: 'list' as const, items: points.map((point) => [{ text: point }]) };
}

/**
 * Renders a summary's body HTML: the standfirst sentence is dropped (it renders separately, in
 * `<p data-standfirst>`), and — only when the remaining text carries no inline "Key Details:"
 * block of its own — a `keyPoints` list is appended, built through the same block contract as an
 * inline Key Details block so both shapes render identically. `keyPoints: null` means the article
 * has none; an inline Key Details block always wins over `keyPoints` (never a duplicate list).
 */
export function summaryBodyHtml(summary: string, keyPoints: string[] | null): string {
  const { rest } = splitStandfirst(summary);
  const blocks = parseSummary(rest);
  const hasInlineKeyDetails = blocks.some((block) => block.type === 'list');

  const finalBlocks =
    !hasInlineKeyDetails && keyPoints && keyPoints.length > 0
      ? [...blocks, keyPointsBlock(keyPoints)]
      : blocks;

  const problems = validateBlocks(finalBlocks);
  if (problems.length > 0) {
    throw new Error(`summaryBodyHtml: invalid summary blocks — ${problems.join('; ')}`);
  }

  return renderSummaryHtml(finalBlocks);
}
