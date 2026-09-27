// REND-01/REND-02 (04-03): the full Content Layer `Loader` — cold (full-corpus self-healing),
// warm (steady-state window) and warm+sweep (daily changed-since catch-up) sync modes, each capped
// by its own measured D1 rows-read budget, plus D-14's never-shrink check against a last-good
// baseline persisted in KV (survives a Workers Builds build-cache purge) and manifest deletes for
// every article that leaves the public set.
//
// Registered via `defineCollection({ loader: articlesLoader() })` in `src/content.config.ts`.
//
// Design (04-03-PLAN.md <planner_findings>, and see docs/phase-04/loader.md for the full writeup):
// `updated_at` alone is not a reliable incremental signal — the ingest pipeline never sets it on a
// normal publish, only on an admin edit or reprocess. Three signals combine instead:
//   - warm (every build): a rolling `published_at` window (`SYNC_WINDOW_SECONDS`, indexed) —
//     catches new articles, late processing, retitles and duplicate flags on recent rows.
//   - warm+sweep (once a day, `SWEEP_INTERVAL_SECONDS`): `fetchChangedSince` — one unindexed
//     `updated_at OR processed_at` scan, re-fetching only the returned ids — catches admin edits
//     and very late processing outside the window.
//   - cold (empty store, a `LOADER_STATE_VERSION` bump, every `COLD_RESYNC_INTERVAL_SECONDS`, or
//     `ARTICLES_FORCE_COLD=1`): the full bulk-fetch pass — self-heals anything the two cheaper
//     signals missed, including hard deletes, which neither window nor sweep can observe as
//     "removed" (a deleted row simply isn't returned by either query).
//
// Sequence inside `load()` (mandatory ordering — every check below runs, and can throw, BEFORE any
// store mutation, manifest write or meta update): pick mode -> fetch -> compute the prospective id
// set and changed/removed/explained sets in memory -> budget check -> category check ->
// evaluateShrink -> only then mutate the store -> manifest bulk write/delete -> meta updates ->
// writePendingBuildState -> one summary log line.
//
// Every relative import below carries an explicit `.ts` extension — Node 24's native
// type-stripping (used by `node --test` in this project's unit tests, which import this module
// directly) does not resolve extensionless specifiers the way a bundler does.
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { UUID_RE, ARTICLE_SLUG_RE, CATEGORY_SLUG_RE } from '../../lib/article-url.ts';
import { isKnownCategory } from '../../lib/categories.ts';
import {
  fetchPublicArticlesWindow,
  fetchAllArticlesStitched,
  fetchArticlesStitchedByIds,
  fetchChangedSince as fetchChangedSinceD1,
  type FetchPublicArticlesWindowResult,
  type FetchAllArticlesStitchedResult,
  type FetchArticlesStitchedByIdsResult,
  type FetchChangedSinceResult,
  type PublicArticle,
  type NonPublicArticle,
} from '../../lib/server/d1-client.ts';
import {
  buildManifestEntry,
  putManifestEntriesBulk,
  deleteManifestEntries,
  MANIFEST_SCHEMA_VERSION,
  type ManifestEntry,
} from '../../lib/server/kv-manifest.ts';
import {
  readLastGood as readLastGoodState,
  writePendingBuildState as writePendingBuildStateFn,
  evaluateShrink,
  type LastGoodState,
} from '../../lib/server/build-state.ts';
import { BUILD_HASH } from '../../lib/build-info.ts';

/** 3 days — the loader's steady-state sync window (D-06 binding constraint: staleness detection
 * must never bulk-scan the full corpus every cycle, only a bounded recent window). */
export const SYNC_WINDOW_SECONDS = 259_200;

/** Bumped whenever this loader's own sync semantics change in a way that invalidates whatever the
 * content-layer store already holds (e.g. a new required field, a changed digest shape) — forces a
 * cold rebuild on the next run rather than trusting a store built under different rules. */
export const LOADER_STATE_VERSION = '1';

/** Once a day: the `fetchChangedSince` catch-up sweep (planner_findings §2). */
export const SWEEP_INTERVAL_SECONDS = 86_400;

/** One cron cycle's worth of overlap subtracted from `lastSweep` before querying
 * `fetchChangedSince`, so a row that changed in the few seconds before the previous sweep ran is
 * never missed by a boundary race. */
export const SWEEP_OVERLAP_SECONDS = 7_200;

/** Every 7 days (or sooner, per the other cold triggers): the full bulk-fetch self-healing pass. */
export const COLD_RESYNC_INTERVAL_SECONDS = 604_800;

/** Provisional — Task 3 (04-03-PLAN.md) replaces these with measured values from a real cold/warm
 * build, each backed by a comment citing the measurement. */
export const WARM_ROWS_READ_BUDGET = 25_000;
export const SWEEP_ROWS_READ_BUDGET = 100_000;
export const COLD_ROWS_READ_BUDGET = 1_500_000;

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

type SyncMode = 'cold' | 'warm' | 'warm+sweep';

/** Test seams only — production code never passes any of these; the real defaults are the actual
 * D1/KV modules. */
export interface ArticlesLoaderDeps {
  now?: () => number;
  fetchWindow?: (sinceEpoch: number) => Promise<FetchPublicArticlesWindowResult>;
  fetchAll?: () => Promise<FetchAllArticlesStitchedResult>;
  fetchByIds?: (internalIds: number[]) => Promise<FetchArticlesStitchedByIdsResult>;
  fetchChangedSince?: (sinceEpoch: number) => Promise<FetchChangedSinceResult>;
  readLastGood?: () => Promise<LastGoodState | null>;
  writeManifest?: (entries: ManifestEntry[]) => Promise<void>;
  deleteManifest?: (articleIds: string[]) => Promise<void>;
  writePending?: (patch: { articles: { count: number; ids: string[] } }) => Promise<void>;
  env?: Record<string, string | undefined>;
}

function toManifestSourceRow(article: ArticleData) {
  return {
    id: article.uuid,
    title: article.title,
    summary: article.summary,
    category: article.category.slug,
    slug: article.slug,
    published_at: article.publishedAt,
    tags: article.tags.map((tag) => tag.name).join(','),
  };
}

export function articlesLoader(deps: ArticlesLoaderDeps = {}): Loader {
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const fetchWindow = deps.fetchWindow ?? fetchPublicArticlesWindow;
  const fetchAll = deps.fetchAll ?? fetchAllArticlesStitched;
  const fetchByIds = deps.fetchByIds ?? fetchArticlesStitchedByIds;
  const fetchChangedSince = deps.fetchChangedSince ?? fetchChangedSinceD1;
  const readLastGood = deps.readLastGood ?? readLastGoodState;
  const writeManifest = deps.writeManifest ?? putManifestEntriesBulk;
  const deleteManifest = deps.deleteManifest ?? deleteManifestEntries;
  const writePending = deps.writePending ?? writePendingBuildStateFn;
  const env = deps.env ?? process.env;

  return {
    name: 'd1-articles',
    schema: articleSchema,
    load: async ({ store, meta, parseData, generateDigest, logger }) => {
      const nowEpoch = now();

      // ---------------------------------------------------------------
      // 1. Pick mode.
      // ---------------------------------------------------------------
      const stateVersion = meta.get('stateVersion');
      const lastColdRaw = meta.get('lastCold');
      const lastCold = lastColdRaw !== undefined ? Number(lastColdRaw) : null;
      const forceCold = env.ARTICLES_FORCE_COLD === '1';
      const storeEmpty = store.keys().length === 0;

      let mode: SyncMode;
      if (
        storeEmpty ||
        stateVersion !== LOADER_STATE_VERSION ||
        lastCold === null ||
        nowEpoch - lastCold >= COLD_RESYNC_INTERVAL_SECONDS ||
        forceCold
      ) {
        mode = 'cold';
      } else {
        const lastSweepRaw = meta.get('lastSweep');
        const lastSweep = lastSweepRaw !== undefined ? Number(lastSweepRaw) : null;
        mode = lastSweep === null || nowEpoch - lastSweep >= SWEEP_INTERVAL_SECONDS ? 'warm+sweep' : 'warm';
      }

      // ---------------------------------------------------------------
      // 2. Fetch.
      // ---------------------------------------------------------------
      let publicArticles: PublicArticle[];
      let nonPublic: NonPublicArticle[];
      let rowsRead: number;
      let since: number | null = null;
      let sweepSinceUsed: number | null = null;

      if (mode === 'cold') {
        const result = await fetchAll();
        publicArticles = result.publicArticles;
        nonPublic = result.nonPublic;
        rowsRead = result.rowsRead;
      } else {
        since = nowEpoch - SYNC_WINDOW_SECONDS;
        const windowResult = await fetchWindow(since);
        publicArticles = windowResult.publicArticles;
        nonPublic = windowResult.nonPublic;
        rowsRead = windowResult.rowsRead;

        if (mode === 'warm+sweep') {
          const lastSweepRaw = meta.get('lastSweep');
          const lastSweep = lastSweepRaw !== undefined ? Number(lastSweepRaw) : nowEpoch;
          sweepSinceUsed = lastSweep - SWEEP_OVERLAP_SECONDS;
          const changed = await fetchChangedSince(sweepSinceUsed);
          rowsRead += changed.rowsRead;

          if (changed.ids.length > 0) {
            const byIds = await fetchByIds(changed.ids);
            rowsRead += byIds.rowsRead;

            const publicByUuid = new Map(publicArticles.map((a) => [a.uuid, a]));
            const nonPublicByUuid = new Map(nonPublic.map((a) => [a.uuid, a]));
            for (const a of byIds.publicArticles) {
              publicByUuid.set(a.uuid, a);
              nonPublicByUuid.delete(a.uuid);
            }
            for (const a of byIds.nonPublic) {
              nonPublicByUuid.set(a.uuid, a);
              publicByUuid.delete(a.uuid);
            }
            publicArticles = Array.from(publicByUuid.values());
            nonPublic = Array.from(nonPublicByUuid.values());
          }
        }
      }

      // ---------------------------------------------------------------
      // 3. Budget check — before any store mutation.
      // ---------------------------------------------------------------
      const budget =
        mode === 'cold' ? COLD_ROWS_READ_BUDGET : mode === 'warm+sweep' ? SWEEP_ROWS_READ_BUDGET : WARM_ROWS_READ_BUDGET;
      if (rowsRead > budget) {
        throw new Error(`${mode} rows-read budget exceeded: ${rowsRead} > ${budget}`);
      }

      // ---------------------------------------------------------------
      // 4. Category check — before any store mutation.
      // ---------------------------------------------------------------
      for (const article of publicArticles) {
        if (!isKnownCategory(article.category.slug)) {
          throw new Error(
            `d1-articles-loader: article ${article.uuid} has unknown category slug "${article.category.slug}"`
          );
        }
      }

      // ---------------------------------------------------------------
      // 5. Compute the prospective id set (no store mutation yet).
      // ---------------------------------------------------------------
      const existingStoreIds = new Set(store.keys());
      const publicIds = new Set(publicArticles.map((a) => a.uuid));
      const nonPublicIds = new Set(nonPublic.map((a) => a.uuid));

      const prospectiveIds =
        mode === 'cold'
          ? new Set(publicIds)
          : (() => {
              const ids = new Set(existingStoreIds);
              for (const id of nonPublicIds) ids.delete(id);
              for (const id of publicIds) ids.add(id);
              return ids;
            })();

      // ---------------------------------------------------------------
      // 6. evaluateShrink — before any store mutation.
      // ---------------------------------------------------------------
      const lastGood = await readLastGood();
      const shrinkResult = evaluateShrink({
        label: 'd1-articles-loader',
        previous: lastGood?.articles ?? null,
        currentIds: Array.from(prospectiveIds),
        explained: nonPublicIds,
        allowance: parseInt(env.ALLOWED_ARTICLE_SHRINK ?? '0', 10),
        requireBaseline: env.BUILD_STATE_REQUIRE_BASELINE === '1',
        bootstrap: env.BUILD_STATE_BOOTSTRAP === '1',
      });

      // ---------------------------------------------------------------
      // 7. Mutate the store — only now.
      // ---------------------------------------------------------------
      const allParsed: ArticleData[] = [];
      const changedArticles: ArticleData[] = [];
      const removedIds: string[] = [];

      if (mode === 'cold') {
        const previousDigests = new Map(store.entries().map(([id, entry]) => [id, (entry as { digest?: string }).digest]));
        for (const id of existingStoreIds) {
          if (!publicIds.has(id)) removedIds.push(id);
        }
        store.clear();
        for (const article of publicArticles) {
          const parsed = (await parseData({ id: article.uuid, data: article })) as ArticleData;
          const digest = generateDigest(parsed as unknown as Record<string, unknown>);
          store.set({ id: article.uuid, data: parsed, digest });
          allParsed.push(parsed);
          if (previousDigests.get(article.uuid) !== digest) {
            changedArticles.push(parsed);
          }
        }
      } else {
        for (const article of publicArticles) {
          const parsed = (await parseData({ id: article.uuid, data: article })) as ArticleData;
          const digest = generateDigest(parsed as unknown as Record<string, unknown>);
          const changed = store.set({ id: article.uuid, data: parsed, digest });
          allParsed.push(parsed);
          if (changed) changedArticles.push(parsed);
        }
        for (const entry of nonPublic) {
          if (store.has(entry.uuid)) {
            store.delete(entry.uuid);
            removedIds.push(entry.uuid);
          }
        }
      }

      // ---------------------------------------------------------------
      // 8. Manifest bulk write / bulk delete.
      // ---------------------------------------------------------------
      const manifestSchemaStale = meta.get('manifestSchemaVersion') !== MANIFEST_SCHEMA_VERSION;
      const articlesForManifest = manifestSchemaStale ? allParsed : changedArticles;

      const manifestEntries = await Promise.all(
        articlesForManifest.map((article) => buildManifestEntry(toManifestSourceRow(article), { buildHash: BUILD_HASH }))
      );
      await writeManifest(manifestEntries);
      if (manifestSchemaStale) {
        meta.set('manifestSchemaVersion', MANIFEST_SCHEMA_VERSION);
      }

      await deleteManifest(removedIds);

      // ---------------------------------------------------------------
      // 9. Meta updates.
      // ---------------------------------------------------------------
      meta.set('stateVersion', LOADER_STATE_VERSION);
      if (mode === 'cold') {
        meta.set('lastCold', String(nowEpoch));
        // A cold pass subsumes what a sweep would catch — avoid an immediate warm+sweep on the
        // very next build.
        meta.set('lastSweep', String(nowEpoch));
      }
      if (since !== null) {
        meta.set('lastSync', String(since));
      }
      if (mode === 'warm+sweep') {
        meta.set('lastSweep', String(nowEpoch));
      }

      // ---------------------------------------------------------------
      // 10. Pending build state — the final store ids, for the never-shrink check to compare
      // against on the NEXT build once this one is committed as last-good.
      // ---------------------------------------------------------------
      const finalIds = Array.from(prospectiveIds);
      await writePending({ articles: { count: finalIds.length, ids: finalIds } });

      // D-14 carried forward: zero rows is always a failure, even though evaluateShrink already
      // enforces this on `currentIds` — this is a second, independent assertion directly against
      // the store's own post-mutation state.
      if (store.keys().length === 0) {
        throw new Error(
          'd1-articles-loader: store is empty after sync — refusing to build (D-14: zero rows is always a failure)'
        );
      }

      // ---------------------------------------------------------------
      // 11. One summary log line.
      // ---------------------------------------------------------------
      logger.info(
        `mode=${mode} public=${finalIds.length} changed=${changedArticles.length} removed=${removedIds.length} explained=${shrinkResult.explainedCount} rowsRead=${rowsRead} budget=${budget}`
      );
    },
  };
}
