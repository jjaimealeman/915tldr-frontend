// 06-16 gap closure (Defect 2): the Spanish category nav was unstyled on every `/es` page because
// `src/styles/global.css` styled it with `nav[aria-label="Sections"]` while the Spanish page's nav
// carries `aria-label="Secciones"` (a dictionary string, `navLabel`). A selector keyed to any
// string that goes through the EN/ES dictionary only ever matches ONE language.
//
// This file guards the whole class, not the one selector:
//   (a) no CSS selector — in global.css, any other .css file under src, or any `<style>` block in
//       src/**/*.astro (and .vue) — may depend on an attribute value that is a dictionary string
//       in either language;
//   (b) the header section nav carries the language-independent hook `data-site-nav="sections"`
//       (and keeps its translated aria-label for assistive technology), and global.css styles
//       through that hook.
// The live-origin, real-browser counterpart is in tests/integration/browser-journeys.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { DICTIONARY, t } from '../../src/lib/i18n/dictionary.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(REPO_ROOT, 'src');
const GLOBAL_CSS = path.join(SRC, 'styles', 'global.css');
const BASE_ASTRO = path.join(SRC, 'layouts', 'Base.astro');

// Attributes whose VALUE is human-readable, translatable text in this codebase.
const TEXT_ATTRS = ['aria-label', 'aria-description', 'aria-roledescription', 'title', 'alt', 'placeholder'];

const ATTR_SELECTOR_RE = new RegExp(
  String.raw`\[\s*(${TEXT_ATTRS.join('|')})\s*([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*(?:[iIsS])?\s*\]`,
  'g'
);

/** Every distinct English and Spanish string in the UI dictionary. */
const DICTIONARY_STRINGS = [
  ...new Set(
    Object.values(DICTIONARY)
      .flatMap((entry) => [entry.en, entry.es])
      .map((s) => s.trim())
      .filter(Boolean)
  ),
];

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Returns one problem string per attribute selector whose value is a dictionary string. */
export function findTranslatedAttributeSelectors(css, label) {
  const problems = [];
  const clean = stripCssComments(css);
  for (const match of clean.matchAll(ATTR_SELECTOR_RE)) {
    const [whole, attr, op] = match;
    const value = (match[3] ?? match[4] ?? match[5] ?? '').trim();
    if (!value) continue;
    const lower = value.toLowerCase();
    const hit = DICTIONARY_STRINGS.find((s) => {
      const sl = s.toLowerCase();
      if (op === '=' || op === '~=' || op === '|=') return sl === lower;
      // Substring operators match any dictionary string they would match.
      if (lower.length < 3) return false;
      if (op === '^=') return sl.startsWith(lower);
      if (op === '$=') return sl.endsWith(lower);
      return sl.includes(lower); // *=
    });
    if (hit !== undefined) {
      problems.push(`${label}: ${whole} depends on the translated dictionary string ${JSON.stringify(hit)}`);
    }
  }
  return problems;
}

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(entry))) out.push(full);
  }
  return out;
}

function styleBlocks(source) {
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------------------
// The detector itself must not be vacuous.
// ---------------------------------------------------------------------------

test('translated-selector guard: flags the exact defect (English AND Spanish label) and ignores language-independent hooks', () => {
  assert.equal(findTranslatedAttributeSelectors('nav[aria-label="Sections"] ul { }', 'fixture').length, 1);
  assert.equal(findTranslatedAttributeSelectors("nav[aria-label='Secciones'] a { }", 'fixture').length, 1);
  assert.equal(findTranslatedAttributeSelectors('img[alt="Home"] { }', 'fixture').length, 1);
  assert.equal(findTranslatedAttributeSelectors('a[title*="Skip"] { }', 'fixture').length, 1);
  // Language-independent hooks and value-less attribute selectors are fine.
  assert.deepEqual(findTranslatedAttributeSelectors('nav[data-site-nav="sections"] ul { }', 'fixture'), []);
  assert.deepEqual(findTranslatedAttributeSelectors('a[aria-current="page"] { }', 'fixture'), []);
  assert.deepEqual(findTranslatedAttributeSelectors('nav[aria-label] { }', 'fixture'), []);
  // A commented-out selector is not a selector.
  assert.deepEqual(findTranslatedAttributeSelectors('/* nav[aria-label="Sections"] */ a { }', 'fixture'), []);
});

// ---------------------------------------------------------------------------
// (a) The whole class: nothing in src styles off translated text.
// ---------------------------------------------------------------------------

test('translated-selector guard: no CSS in src/ (global.css, other .css, <style> blocks in .astro/.vue) selects by a dictionary string', () => {
  const problems = [];
  let blocksChecked = 0;

  for (const file of walk(SRC, ['.css'])) {
    problems.push(...findTranslatedAttributeSelectors(readFileSync(file, 'utf8'), path.relative(REPO_ROOT, file)));
    blocksChecked++;
  }
  for (const file of walk(SRC, ['.astro', '.vue'])) {
    for (const block of styleBlocks(readFileSync(file, 'utf8'))) {
      problems.push(...findTranslatedAttributeSelectors(block, `${path.relative(REPO_ROOT, file)} <style>`));
      blocksChecked++;
    }
  }

  assert.ok(blocksChecked >= 1, 'expected to scan at least global.css');
  assert.deepEqual(
    problems,
    [],
    `selectors bound to a translated string only match one language (see 06-16 Defect 2):\n${problems.join('\n')}`
  );
});

// ---------------------------------------------------------------------------
// (b) The nav's rendering contract: stable hook for both languages, translated label kept.
// ---------------------------------------------------------------------------

const baseSource = readFileSync(BASE_ASTRO, 'utf8');
// The header section nav is the <nav> whose aria-label comes from the `navLabel` dictionary key.
const NAV_OPEN_TAG_RE = /<nav\b[^>]*aria-label=\{t\('navLabel',\s*lang\)\}[^>]*>/;

test('section nav markup: Base.astro renders the nav with data-site-nav="sections" and a translated aria-label', () => {
  const tag = baseSource.match(NAV_OPEN_TAG_RE);
  assert.ok(tag, "expected a <nav aria-label={t('navLabel', lang)}> in src/layouts/Base.astro");
  // The hook is a static literal: identical for every language, never interpolated from `lang`
  // or from a dictionary string.
  assert.match(tag[0], /\sdata-site-nav="sections"(\s|>)/, 'the section nav must carry a literal data-site-nav="sections"');
  // The translated label stays for assistive technology.
  assert.match(tag[0], /aria-label=\{t\('navLabel', lang\)\}/);
});

test('section nav markup: the label differs by language but the hook does not (en and es)', () => {
  const tag = baseSource.match(NAV_OPEN_TAG_RE)[0];
  const hook = tag.match(/data-site-nav="([^"]*)"/)?.[1];
  assert.equal(hook, 'sections');
  assert.equal(t('navLabel', 'en'), 'Sections');
  assert.equal(t('navLabel', 'es'), 'Secciones');
  assert.notEqual(t('navLabel', 'en'), t('navLabel', 'es'), 'the premise: the two labels differ, the hook must not');
  // Exactly one section nav in the shared layout, so both languages go through this one tag.
  assert.equal((baseSource.match(/<nav\b/g) ?? []).length, 1, 'Base.astro should render exactly one <nav>');
});

test('section nav styling: global.css styles the nav through the hook at every breakpoint, never through aria-label', () => {
  const css = stripCssComments(readFileSync(GLOBAL_CSS, 'utf8'));
  assert.doesNotMatch(css, /nav\[aria-label/, 'global.css must not select the nav by aria-label');
  const hookSelectors = css.match(/nav\[data-site-nav="sections"\]/g) ?? [];
  // Base rule, ul, a, a[aria-current], 48em ul, 80em ul, 80em width group.
  assert.ok(hookSelectors.length >= 7, `expected the 7 nav rules to use the hook, found ${hookSelectors.length}`);
  // The 48em and 80em media-query rules specifically.
  assert.match(css, /@media \(min-width: 48em\)\s*\{\s*nav\[data-site-nav="sections"\] ul/);
  assert.match(css, /@media \(min-width: 80em\)\s*\{\s*nav\[data-site-nav="sections"\] ul/);
});
