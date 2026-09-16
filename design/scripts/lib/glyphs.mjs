// Glyph-set helpers for the PERF-07 font subset. Kept dependency-free so
// collectPageText can be serialised straight into page.evaluate() by
// build-fonts.mjs and design/tests/font-cls.spec.ts without a bundler step.

/**
 * U+0020-U+007E (basic Latin + ASCII punctuation/digits), U+00A0 (non-
 * breaking space), and the Spanish-specific punctuation/diacritic/typography
 * characters this project's copy actually uses: inverted punctuation,
 * guillemets, degree/middle-dot, ordinal indicators, the accented vowels and
 * ñ/Ñ in both cases, ü/Ü, en/em dashes, curly quotes, ellipsis and bullet.
 */
export const SPANISH_BASELINE = (() => {
  let chars = '';
  for (let cp = 0x0020; cp <= 0x007e; cp++) {
    chars += String.fromCodePoint(cp);
  }
  chars += ' ';
  chars += '¡¿«»°·ªºÁÉÍÓÚÜÑáéíóúüñ–—‘’“”…•';
  return chars;
})();

/**
 * Serialisable into page.evaluate(): returns the union of every character
 * actually rendered on the current document — body innerText, ::before/
 * ::after computed `content` (quoted-string values only; "none" and "normal"
 * are not real content), and the visible/typed text of form controls (input/
 * textarea placeholder and value, option text) that a crawl of body text
 * alone would miss.
 */
export function collectPageText() {
  const parts = [document.body.innerText];

  function pseudoContent(el, pseudo) {
    const value = getComputedStyle(el, pseudo).content;
    if (!value || value === 'none' || value === 'normal') return null;
    const match = value.match(/^["'](.*)["']$/);
    return match ? match[1] : null;
  }

  const all = document.querySelectorAll('*');
  for (const el of all) {
    const before = pseudoContent(el, '::before');
    if (before) parts.push(before);
    const after = pseudoContent(el, '::after');
    if (after) parts.push(after);
  }

  for (const el of document.querySelectorAll('input, textarea')) {
    if (el.placeholder) parts.push(el.placeholder);
    if (el.value) parts.push(el.value);
  }

  for (const el of document.querySelectorAll('option')) {
    if (el.textContent) parts.push(el.textContent);
  }

  return parts.join('');
}

/**
 * Adds the toUpperCase()/toLowerCase() form of every character in `chars` to
 * the set, so a subset built from crawled (typically sentence-case) copy
 * still covers the opposite case for every letter it contains.
 */
export function closeOverCase(chars) {
  const set = new Set([...chars]);
  for (const ch of [...chars]) {
    set.add(ch.toUpperCase());
    set.add(ch.toLowerCase());
  }
  return [...set].join('');
}
