// Astro 6+ Content Layer collection registration. This file MUST live at `src/content.config.ts`
// — `src/content/config.ts` (the pre-6 location) raises `LegacyContentConfigError` (confirmed
// against Context7 `/withastro/docs` errors/legacy-content-config-error during 04-01 planning).
import { defineCollection } from 'astro:content';
import { articlesLoader } from './content/loaders/articles-loader';
import { changelogLoader } from './content/loaders/changelog-loader';

const articles = defineCollection({
  loader: articlesLoader(),
});

// D-13 / FIX-05: dual-source (v1 changelog.json + D1 public_changelogs) changelog collection.
const changelog = defineCollection({
  loader: changelogLoader(),
});

export const collections = { articles, changelog };
