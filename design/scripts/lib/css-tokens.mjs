// Reads the tokens region out of design/mockups/style.css and resolves it
// into concrete sRGB colours, without ever hand-writing the WCAG luminance
// formula or an OKLCH->sRGB conversion (D-13; see 01-RESEARCH.md "Don't
// Hand-Roll" — both are delegated to culori).

import { parse, displayable, converter } from 'culori';

const toRgb = converter('rgb');

/** Canonical category slugs, in required seed order (D-13 structure check). */
export const CANONICAL_SLUGS = [
  'crime',
  'politics',
  'sports',
  'business',
  'education',
  'community',
  'health',
  'weather',
];

/**
 * A typed error for anything wrong with a specific CSS custom property —
 * missing, cyclic, unparseable, or out of gamut. `token` names the offending
 * property (may be null when the caller has more context than this module
 * does); `reason` is a short machine-checkable category string.
 */
export class TokenError extends Error {
  constructor(message, { token = null, reason = null } = {}) {
    super(message);
    this.name = 'TokenError';
    this.token = token;
    this.reason = reason;
  }
}

/**
 * Extracts the substring between `/* <name>:start *\/` and `/* <name>:end *\/`
 * markers (exclusive of the markers themselves). Throws if either marker is
 * missing.
 */
export function extractRegion(css, name) {
  const startMarker = `/* ${name}:start */`;
  const endMarker = `/* ${name}:end */`;

  const startIndex = css.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`extractRegion: missing start marker "${startMarker}"`);
  }

  const contentStart = startIndex + startMarker.length;
  const endIndex = css.indexOf(endMarker, contentStart);
  if (endIndex === -1) {
    throw new Error(`extractRegion: missing end marker "${endMarker}"`);
  }

  return css.slice(contentStart, endIndex);
}

const ROOT_SELECTOR = ':root {';
const DARK_SELECTOR = '[data-theme="dark"] {';
const DECLARATION_RE = /^(--[\w-]+):\s*(.+);$/;
const FULL_LINE_COMMENT_RE = /^\/\*.*\*\/$/;

/**
 * Parses the tokens region into `{ light: Map, dark: Map }` of custom
 * property name -> raw (unresolved) value string. Throws, with the 1-based
 * line number, on any line that is not a declaration, a full-line comment,
 * blank, one of the two selector lines, or a closing brace.
 */
export function parseTokenRules(regionText) {
  const lines = regionText.split('\n');
  const light = new Map();
  const dark = new Map();

  let state = 'outside'; // 'outside' | 'light' | 'dark'
  let seenLight = false;
  let seenDark = false;

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (line === '') {
      return; // blank line — always allowed
    }

    if (FULL_LINE_COMMENT_RE.test(line)) {
      return; // comment line — always allowed
    }

    if (state === 'outside') {
      if (line === ROOT_SELECTOR) {
        state = 'light';
        seenLight = true;
        return;
      }
      if (line === DARK_SELECTOR) {
        state = 'dark';
        seenDark = true;
        return;
      }
      throw new Error(`parseTokenRules: unexpected line ${lineNumber}: "${rawLine}"`);
    }

    if (line === '}') {
      state = 'outside';
      return;
    }

    const match = DECLARATION_RE.exec(line);
    if (!match) {
      throw new Error(`parseTokenRules: unexpected line ${lineNumber}: "${rawLine}"`);
    }

    const [, name, value] = match;
    const target = state === 'light' ? light : dark;
    target.set(name, value);
  });

  if (state !== 'outside') {
    throw new Error('parseTokenRules: unclosed rule — missing a closing brace');
  }
  if (!seenLight) {
    throw new Error(`parseTokenRules: missing "${ROOT_SELECTOR}" rule`);
  }
  if (!seenDark) {
    throw new Error(`parseTokenRules: missing "${DARK_SELECTOR}" rule`);
  }

  return { light, dark };
}

const VAR_RE = /var\(\s*(--[\w-]+)\s*\)/;

/**
 * Resolves every `var(--x)` reference in `raw` (including references nested
 * inside functions such as oklch(...)) against `map`, using `resolveKey` to
 * resolve dependencies transitively and detect cycles.
 */
function substituteVars(raw, resolveKey) {
  let result = raw;
  let match;
  let guard = 0;
  while ((match = VAR_RE.exec(result))) {
    if (++guard > 100) {
      throw new Error(`resolveTheme: too many nested var() references while resolving "${raw}"`);
    }
    const ref = match[1];
    const refValue = resolveKey(ref);
    result = result.slice(0, match.index) + refValue + result.slice(match.index + match[0].length);
  }
  return result;
}

/**
 * Merges `rules.light` and (when theme is 'dark') `rules.dark` on top of it,
 * then resolves every var(--x) reference — including ones nested inside
 * oklch(...) — to a final literal value per custom property. Throws on a
 * missing reference or a reference cycle.
 */
export function resolveTheme(rules, theme) {
  const merged = new Map(rules.light);
  if (theme === 'dark') {
    for (const [key, value] of rules.dark) {
      merged.set(key, value);
    }
  }

  const resolved = new Map();
  const resolving = new Set();

  function resolveKey(key) {
    if (resolved.has(key)) return resolved.get(key);
    if (resolving.has(key)) {
      throw new TokenError(`resolveTheme: cycle detected resolving "${key}"`, {
        token: key,
        reason: 'cycle detected',
      });
    }
    if (!merged.has(key)) {
      throw new TokenError(`resolveTheme: missing reference "${key}"`, {
        token: key,
        reason: 'missing reference',
      });
    }
    resolving.add(key);
    const value = substituteVars(merged.get(key), resolveKey);
    resolving.delete(key);
    resolved.set(key, value);
    return value;
  }

  for (const key of merged.keys()) {
    resolveKey(key);
  }

  return resolved;
}

/**
 * Parses a (fully resolved) CSS colour value with culori and converts it to
 * sRGB. Throws if the value cannot be parsed, or if it is out of the sRGB
 * gamut (culori's `displayable()` returns false).
 */
export function toSrgb(value) {
  const parsed = parse(value.trim());
  if (!parsed) {
    throw new TokenError(`toSrgb: could not parse colour value "${value}"`, {
      reason: 'unparseable',
    });
  }
  if (!displayable(parsed)) {
    throw new TokenError(`toSrgb: colour value "${value}" is outside the sRGB gamut`, {
      reason: 'outside sRGB gamut',
    });
  }
  return toRgb(parsed);
}

/**
 * True when `value` is a colour culori can parse (and therefore something
 * the gate must either check or explicitly exempt) — a bare number, unit
 * value, `var()` reference, or keyword like `currentColor` all parse to
 * `undefined` and are never colour-valued.
 */
export function isColorValue(value) {
  return parse(value) !== undefined;
}
