// GREEN half of the html-text RED/GREEN pair (tests/unit/html-text.test.mjs). Decodes exactly the
// five HTML entities Astro's default text escaping produces, plus the hex apostrophe form, so a
// test can compare a live D1 title against rendered HTML without either side needing to already
// match byte-for-byte — see .planning/todos/pending/2026-09-26-tracer-test-html-entity-title.md
// for the failure mode this exists to prevent.

const NAMED_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const ENTITY_RE = /&amp;|&lt;|&gt;|&quot;|&#39;|&#x27;|&#x([0-9a-fA-F]+);|&#(\d+);/g;

/** Decodes the small, fixed set of HTML entities Astro's default escaping can produce (named
 * `&amp; &lt; &gt; &quot; &#39;`), plus generic numeric decimal/hex entities (`&#39;`, `&#x27;`).
 * Text without entities passes through unchanged. */
export function decodeEntities(html) {
  return html.replace(ENTITY_RE, (match, hex, dec) => {
    if (match === '&#x27;') return "'";
    if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
    if (dec !== undefined) return String.fromCodePoint(parseInt(dec, 10));
    return NAMED_ENTITIES[match] ?? match;
  });
}

/** Strips HTML tags, then decodes entities — for comparing a rendered page's visible text against
 * an unrendered source string (e.g. a D1 title) without either side needing pre-processing. */
export function textOf(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ''));
}
