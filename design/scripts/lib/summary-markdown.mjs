// Summary markdown -> typed blocks -> safe HTML (revision request 9).
//
// The corpus uses exactly two markdown constructs (measured across all 54
// fixture summaries during planning): a `**Key Details:**` label line and
// bullet lines starting with U+2022 (`•`) plus a space. There are no
// headings, links, italics, dash lists, numbered lists or code. This module
// parses exactly that grammar into a small, closed block/inline contract and
// renders it to HTML, escaping text at render time (never at parse time) so
// a client renderer (01-21) can also use these blocks with `textContent`.
//
// Pure ESM, no dependencies, no I/O. Public API: escapeHtml, parseSummary,
// renderSummaryHtml, summaryPlainText, validateBlocks.

const BULLET_PREFIX = '• ';

/**
 * Escapes exactly & < > " ' — the characters that matter when a text run is
 * placed inside HTML element content or a double-quoted attribute. Order
 * matters: & must be escaped first, or the entities produced for the other
 * characters would themselves be re-escaped.
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parses inline text (a paragraph's text, or a single list item's text) into
 * a run of Inline objects. Each balanced `**x**` pair becomes a strong
 * inline with text `x`; everything else becomes plain text. A `**` with no
 * closing partner is left as literal text — no strong is produced. Adjacent
 * plain text is naturally merged because it accumulates in one buffer until
 * interrupted by a strong match. Empty text runs are never emitted.
 */
function parseInline(text) {
  const inlines = [];
  let plain = '';
  let i = 0;

  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const closeIndex = text.indexOf('**', i + 2);
      if (closeIndex !== -1) {
        const strongText = text.slice(i + 2, closeIndex);
        if (plain.length > 0) {
          inlines.push({ text: plain });
          plain = '';
        }
        if (strongText.length > 0) {
          inlines.push({ text: strongText, strong: true });
        }
        i = closeIndex + 2;
        continue;
      }
      // No closing "**" anywhere ahead: treat this "**" as two literal
      // characters and keep scanning normally.
      plain += text[i] + text[i + 1];
      i += 2;
      continue;
    }
    plain += text[i];
    i += 1;
  }

  if (plain.length > 0) {
    inlines.push({ text: plain });
  }

  return inlines;
}

function isBulletLine(line) {
  return line.startsWith(BULLET_PREFIX);
}

/**
 * True when a line's entire trimmed content is a single balanced `**...**`
 * run — the corpus's "Key Details:" label shape. Used only to decide
 * whether a lone text line directly preceding a run of bullet lines should
 * be split into its own paragraph rather than merged with any preceding
 * prose in the same blank-line-delimited group.
 */
function isKeyDetailsHeaderLine(line) {
  return /^\*\*[^*]*\*\*$/.test(line.trim());
}

/**
 * Splits a group of contiguous non-blank lines (no blank lines between them)
 * into runs of consecutive bullet lines and consecutive non-bullet lines,
 * preserving order.
 */
function splitIntoRuns(lines) {
  const runs = [];
  for (const line of lines) {
    const bullet = isBulletLine(line);
    const last = runs[runs.length - 1];
    if (last && last.bullet === bullet) {
      last.lines.push(line);
    } else {
      runs.push({ bullet, lines: [line] });
    }
  }
  return runs;
}

/**
 * Parses one blank-line-delimited group of lines into zero or more blocks.
 */
function parseGroup(lines) {
  const runs = splitIntoRuns(lines);
  const blocks = [];

  runs.forEach((run, index) => {
    if (run.bullet) {
      const items = run.lines.map((line) => parseInline(line.slice(BULLET_PREFIX.length).trim()));
      blocks.push({ type: 'list', items });
      return;
    }

    const nextRun = runs[index + 1];
    const lastLine = run.lines[run.lines.length - 1];
    const isKeyDetailsHeader = nextRun && nextRun.bullet && isKeyDetailsHeaderLine(lastLine);

    if (isKeyDetailsHeader) {
      if (run.lines.length > 1) {
        const precedingInlines = parseInline(run.lines.slice(0, -1).join(' '));
        if (precedingInlines.length > 0) {
          blocks.push({ type: 'p', inlines: precedingInlines });
        }
      }
      blocks.push({ type: 'p', inlines: parseInline(lastLine.trim()) });
      return;
    }

    const inlines = parseInline(run.lines.join(' '));
    if (inlines.length > 0) {
      blocks.push({ type: 'p', inlines });
    }
  });

  return blocks;
}

/**
 * Parses a raw summary string into a list of typed blocks. Normalises CRLF
 * to LF first, then splits on one or more blank lines into groups; each
 * group is parsed independently (see parseGroup).
 */
export function parseSummary(markdown) {
  if (typeof markdown !== 'string') return [];

  const normalized = markdown.replace(/\r\n/g, '\n');
  if (normalized.trim() === '') return [];

  const lines = normalized.split('\n');
  const groups = [];
  let current = [];

  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }

  const blocks = [];
  for (const group of groups) {
    blocks.push(...parseGroup(group));
  }
  return blocks;
}

function renderInlines(inlines) {
  return inlines
    .map((inline) =>
      inline.strong ? `<strong>${escapeHtml(inline.text)}</strong>` : escapeHtml(inline.text)
    )
    .join('');
}

function renderBlock(block) {
  if (block.type === 'p') {
    return `<p>${renderInlines(block.inlines)}</p>`;
  }
  if (block.type === 'list') {
    const items = block.items.map((item) => `<li>${renderInlines(item)}</li>`).join('');
    return `<ul data-key-details>${items}</ul>`;
  }
  throw new Error(`renderSummaryHtml: unknown block type "${block.type}"`);
}

/**
 * Renders typed blocks to HTML. Only p, strong, ul[data-key-details] and li
 * are ever emitted. Every text run is escaped at render time (see
 * escapeHtml) — blocks themselves carry raw text so a client renderer can
 * use textContent instead of innerHTML. Blocks are joined with a single
 * newline; list items are joined with nothing.
 */
export function renderSummaryHtml(blocks) {
  return blocks.map(renderBlock).join('\n');
}

/**
 * Flattens blocks to plain text: each paragraph's text and each list item's
 * text, joined with "\n".
 */
export function summaryPlainText(blocks) {
  const parts = [];
  for (const block of blocks) {
    if (block.type === 'p') {
      parts.push(block.inlines.map((inline) => inline.text).join(''));
    } else if (block.type === 'list') {
      for (const item of block.items) {
        parts.push(item.map((inline) => inline.text).join(''));
      }
    }
  }
  return parts.join('\n');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateInline(inline, label, problems) {
  if (!isPlainObject(inline)) {
    problems.push(`${label}: not a plain object`);
    return;
  }
  for (const key of Object.keys(inline)) {
    if (key !== 'text' && key !== 'strong') {
      problems.push(`${label}: unexpected key "${key}"`);
    }
  }
  if (typeof inline.text !== 'string' || inline.text.length === 0) {
    problems.push(`${label}: text must be a non-empty string`);
  }
  if ('strong' in inline && inline.strong !== true) {
    problems.push(`${label}: strong must be true when present`);
  }
}

/**
 * Structurally validates a value against exactly what parseSummary /
 * renderSummaryHtml would produce or consume: an array of p/list blocks,
 * no extra keys anywhere, non-empty string text on every inline, `strong`
 * only ever `true`, and every list non-empty with every item non-empty.
 * Returns a list of human-readable problem strings; [] means valid.
 */
export function validateBlocks(value) {
  const problems = [];

  if (!Array.isArray(value)) {
    problems.push('blocks must be an array');
    return problems;
  }

  value.forEach((block, blockIndex) => {
    if (!isPlainObject(block)) {
      problems.push(`block ${blockIndex}: not a plain object`);
      return;
    }

    if (block.type === 'p') {
      for (const key of Object.keys(block)) {
        if (key !== 'type' && key !== 'inlines') {
          problems.push(`block ${blockIndex}: unexpected key "${key}"`);
        }
      }
      if (!Array.isArray(block.inlines)) {
        problems.push(`block ${blockIndex}: inlines must be an array`);
      } else {
        block.inlines.forEach((inline, inlineIndex) => {
          validateInline(inline, `block ${blockIndex} inline ${inlineIndex}`, problems);
        });
      }
    } else if (block.type === 'list') {
      for (const key of Object.keys(block)) {
        if (key !== 'type' && key !== 'items') {
          problems.push(`block ${blockIndex}: unexpected key "${key}"`);
        }
      }
      if (!Array.isArray(block.items) || block.items.length === 0) {
        problems.push(`block ${blockIndex}: items must be a non-empty array`);
      } else {
        block.items.forEach((item, itemIndex) => {
          if (!Array.isArray(item) || item.length === 0) {
            problems.push(`block ${blockIndex} item ${itemIndex}: must be a non-empty array of inlines`);
            return;
          }
          item.forEach((inline, inlineIndex) => {
            validateInline(inline, `block ${blockIndex} item ${itemIndex} inline ${inlineIndex}`, problems);
          });
        });
      }
    } else {
      problems.push(`block ${blockIndex}: unknown type "${block.type}"`);
    }
  });

  return problems;
}
