#!/usr/bin/env node
// Converts every `<p data-summary ...>...</p>` element on the mockup pages
// into `<div data-summary ...>` holding rendered summary-markdown HTML
// (revision request 9 / defect 9: raw `**Key Details:**`/bullet markdown was
// printed verbatim instead of being converted). Consumes the converter built
// in 01-12 (design/scripts/lib/summary-markdown.mjs) — never re-implements
// markdown handling or HTML escaping here.
//
// Usage:
//   node design/scripts/render-summaries.mjs [--pages=index,category,...]
//
// Idempotent: an element already converted to `<div data-summary>` is left
// untouched, so running this script twice in a row produces a byte-identical
// second run (converted=0, removed=0 on the second pass).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSummary, renderSummaryHtml } from './lib/summary-markdown.mjs';

const ALL_PAGES = ['index', 'category', 'article', 'changelog', 'contact'];
const MOCKUPS_DIR = path.resolve('design/mockups');

// Matches `<p data-summary` through its closing `>` (attrs captured
// verbatim), then the element's text content, up to the next `</p>`. Every
// data-summary element on these five pages is plain text with no nested
// markup (verified during planning), so a non-greedy match to the next
// `</p>` is safe and never crosses a summary-element boundary.
const P_SUMMARY_RE = /<p data-summary([^>]*)>([\s\S]*?)<\/p>/g;

// The five entities this corpus's summary text can legitimately carry
// (& < > " '), plus numeric character references. Any other named entity
// (e.g. &nbsp;) means the corpus is producing something this converter was
// never proven against — abort loudly rather than silently mis-decode it.
function decodeEntities(text, pageName) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const codePoint = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return String.fromCodePoint(codePoint);
    }
    const named = { amp: '&', lt: '<', gt: '>', quot: '"' };
    if (entity in named) return named[entity];
    console.error(
      `render-summaries: unexpected named entity "&${entity};" on page "${pageName}" — only &amp; &lt; &gt; &quot; &#39; and numeric references are decoded`
    );
    process.exit(1);
  });
}

function convertPage(pageName) {
  const filePath = path.join(MOCKUPS_DIR, `${pageName}.html`);
  const original = readFileSync(filePath, 'utf8');

  let converted = 0;
  let removed = 0;
  // Existing div[data-summary] elements (from a prior run) are never touched
  // by the replace below (it only matches <p data-summary), so the count on
  // the original file before this run's replacements is exactly "left
  // untouched by this run".
  const unchanged = (original.match(/<div data-summary/g) || []).length;

  const output = original.replace(P_SUMMARY_RE, (match, attrs, rawText) => {
    const decoded = decodeEntities(rawText, pageName);
    const blocks = parseSummary(decoded);
    if (blocks.length === 0) {
      removed += 1;
      return '';
    }
    converted += 1;
    return `<div data-summary${attrs}>${renderSummaryHtml(blocks)}</div>`;
  });

  if (output !== original) {
    writeFileSync(filePath, output);
  }

  console.log(`${pageName}: converted=${converted} removed=${removed} unchanged=${unchanged}`);
}

function parsePagesArg(argv) {
  const arg = argv.find((a) => a.startsWith('--pages='));
  if (!arg) return ALL_PAGES;
  const pages = arg
    .slice('--pages='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return pages.length > 0 ? pages : ALL_PAGES;
}

export function main(argv = process.argv.slice(2)) {
  for (const page of parsePagesArg(argv)) {
    convertPage(page);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
