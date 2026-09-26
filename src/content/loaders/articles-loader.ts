// REND-01: the hand-written Content Layer `Loader` proving Phase 4's architecture end-to-end.
// Registered via `defineCollection({ loader: articlesLoader() })` in `src/content.config.ts`.
//
// Sync model (D-14, planner_findings §2/§3): fetches the `published_at` window
// [now - SYNC_WINDOW_SECONDS, now) via `fetchPublicArticlesWindow` (the bulk-fetch +
// in-memory-stitch shape, docs/phase-03/d1-pagination-report.md), writes each public article to
// the store with a content digest, deletes any now-non-public article still present from a prior
// sync, and refuses to build if the store ends up empty (D-14: zero rows is always a failure —
// the `/changelog` empty-state bug reborn one layer deeper is exactly what this guards against,
// REND-02/REND-03). Manifest v2 entries (D-08, `slug`) are written only for entries whose digest
// actually changed — `store.set()`'s own return value reports that (confirmed against
// `astro/dist/content/mutable-data-store.js`'s `scopedStore().set()`: returns `false` when an
// existing entry's digest matches the incoming one, `true` otherwise).
//
// Every relative import below carries an explicit `.ts` extension — Node 24's native
// type-stripping (used by `node --test` in this project's unit tests, which import this module
// directly) does not resolve extensionless specifiers the way a bundler does.
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { UUID_RE, ARTICLE_SLUG_RE, CATEGORY_SLUG_RE } from '../../lib/article-url.ts';
import { fetchPublicArticlesWindow, type FetchPublicArticlesWindowResult } from '../../lib/server/d1-client.ts';
import { buildManifestEntry, putManifestEntriesBulk, type ManifestEntry } from '../../lib/server/kv-manifest.ts';
import { BUILD_HASH } from '../../lib/build-info.ts';

/** 3 days — the loader's steady-state sync window (D-06 binding constraint: staleness detection
 * must never bulk-scan the full corpus every cycle, only a bounded recent window). */
export const SYNC_WINDOW_SECONDS = 259_200;

export const articleSchema = z.object({
  uuid: z.string().regex(UUID_RE, 'uuid must match UUID_RE'),
  title: z.string().min(1),
  // D-07: the stored `articles.slug` column — never re-derived from the title.
  slug: z.string().regex(ARTICLE_SLUG_RE, 'slug must match ARTICLE_SLUG_RE'),
  summary: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).nullable(),
  // The original article — attribution and disclosure link to it (IDNT-03/04, SEO-07). The
  // protocol restriction rejects `javascript:` and other schemes a bare URL check accepts.
  url: z.url({ protocol: /^https?$/ }),
  publishedAt: z.number().int().positive(),
  category: z.object({
    slug: z.string().regex(CATEGORY_SLUG_RE, 'category.slug must match CATEGORY_SLUG_RE'),
    name: z.string().min(1),
  }),
  tags: z.array(
    z.object({
      slug: z.string().min(1),
      name: z.string().min(1),
    })
  ),
  source: z.object({
    slug: z.string().min(1),
    // The disclosure and attribution paragraphs name the source outlet (IDNT-03/04).
    name: z.string().min(1),
    websiteUrl: z.url(),
  }),
});

export type ArticleData = z.infer<typeof articleSchema>;

/** Test seams only — production code never passes any of these. */
export interface ArticlesLoaderDeps {
  /** Overrides "now" (epoch seconds). Defaults to the real wall clock. */
  now?: () => number;
  /** Overrides the D1 window fetch. Defaults to `fetchPublicArticlesWindow`. */
  fetchWindow?: (sinceEpoch: number) => Promise<FetchPublicArticlesWindowResult>;
  /** Overrides the manifest bulk-write. Defaults to `putManifestEntriesBulk`. */
  writeManifest?: (entries: ManifestEntry[]) => Promise<void>;
}

export function articlesLoader(deps: ArticlesLoaderDeps = {}): Loader {
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const fetchWindow = deps.fetchWindow ?? fetchPublicArticlesWindow;
  const writeManifest = deps.writeManifest ?? putManifestEntriesBulk;

  return {
    name: 'd1-articles',
    schema: articleSchema,
    load: async ({ store, meta, parseData, generateDigest, logger }) => {
      const since = now() - SYNC_WINDOW_SECONDS;
      const { publicArticles, nonPublic, rowsRead } = await fetchWindow(since);

      const changedEntries: ArticleData[] = [];
      for (const article of publicArticles) {
        const parsed = (await parseData({ id: article.uuid, data: article })) as ArticleData;
        const digest = generateDigest(parsed as unknown as Record<string, unknown>);
        const changed = store.set({ id: article.uuid, data: parsed, digest });
        if (changed) changedEntries.push(parsed);
      }

      let removed = 0;
      for (const entry of nonPublic) {
        if (store.has(entry.uuid)) {
          store.delete(entry.uuid);
          removed += 1;
          logger.warn(`d1-articles-loader: removed ${entry.uuid} (${entry.reason})`);
        }
      }

      if (store.keys().length === 0) {
        throw new Error(
          'd1-articles-loader: store is empty after sync — refusing to build (D-14: zero rows is always a failure)'
        );
      }

      const manifestEntries = await Promise.all(
        changedEntries.map((article) =>
          buildManifestEntry(
            {
              id: article.uuid,
              title: article.title,
              summary: article.summary,
              category: article.category.slug,
              slug: article.slug,
              published_at: article.publishedAt,
              tags: article.tags.map((tag) => tag.name).join(','),
            },
            { buildHash: BUILD_HASH }
          )
        )
      );
      await writeManifest(manifestEntries);

      meta.set('lastSync', String(since));
      logger.info(
        `mode=window synced=${publicArticles.length} changed=${changedEntries.length} removed=${removed} rowsRead=${rowsRead}`
      );
    },
  };
}
