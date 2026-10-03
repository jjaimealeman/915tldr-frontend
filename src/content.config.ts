// Astro 6+ Content Layer collection registration. This file MUST live at `src/content.config.ts`
// — `src/content/config.ts` (the pre-6 location) raises `LegacyContentConfigError` (confirmed
// against Context7 `/withastro/docs` errors/legacy-content-config-error during 04-01 planning).
import { defineCollection } from 'astro:content';
import { articlesLoader } from './content/loaders/articles-loader';
import { changelogLoader } from './content/loaders/changelog-loader';
import { articlesEsLoader } from './content/loaders/articles-es-loader';

const articles = defineCollection({
  loader: articlesLoader(),
});

// D-13 / FIX-05: dual-source (v1 changelog.json + D1 public_changelogs) changelog collection.
const changelog = defineCollection({
  loader: changelogLoader(),
});

// 06-06 (I18N-01/I18N-04): a SEPARATE Spanish-translation collection, not a doubled `articles`
// collection — every existing `getCollection('articles')` call site stays untouched (06-RESEARCH.md
// Pattern 2 / Pitfall 3). Joined to `articles` at template-render time by `src/lib/i18n/spanish-view.ts`.
const articlesEs = defineCollection({
  loader: articlesEsLoader(),
});

export const collections = { articles, changelog, articlesEs };
