// 06-05 (D-02): the fixed Spanish category display-name map. Category display names NEVER come
// from the model — only this hand-maintained table — mirroring `src/lib/categories.ts`'s own
// fixed lookup-table pattern (06-PATTERNS.md's cited analog). Category SLUGS are never
// translated (identity, frozen per Phase 4 D-07); only the human-facing display name changes.
import { CATEGORIES } from '../categories.ts';
import { assertLanguage, type Language } from '../article-url.ts';

/** Spanish display name per category slug (D-02) — verified against every `CATEGORIES` slug by
 * this module's own `categoryLabel` contract test (`tests/unit/i18n.test.mjs`). */
export const CATEGORY_LABELS_ES: Readonly<Record<string, string>> = {
  crime: 'Crimen',
  politics: 'Política',
  sports: 'Deportes',
  business: 'Negocios',
  education: 'Educación',
  community: 'Comunidad',
  health: 'Salud',
  weather: 'Clima',
};

/**
 * Returns the display name for `slug` in `lang` — the plain English `categoryName(slug)` for
 * `'en'`, the fixed Spanish label for `'es'`. Returns `undefined` on an unknown slug, matching
 * `categoryName`'s own UI-lookup contract (never throws) — this is a display lookup, not a
 * tampering-surface validator like `article-url.ts`'s `assertMatches` functions.
 */
export function categoryLabel(slug: string, lang: Language): string | undefined {
  assertLanguage(lang);
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) return undefined;
  if (lang === 'en') return category.name;
  return CATEGORY_LABELS_ES[slug];
}
