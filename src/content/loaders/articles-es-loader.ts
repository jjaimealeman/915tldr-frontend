// 06-06 (I18N-01/I18N-04): the Spanish-translation Content Layer `Loader` — a second, independent
// collection (`articlesEs`) that joins `article_translations` to `articles.uuid`, never touching
// the English `articles` collection or its loader (06-RESEARCH.md Pattern 2 / Pitfall 3: a
// separate collection, not a doubled one, keeps every existing `getCollection('articles')` call
// site byte-identical).
//
// Registered via `defineCollection({ loader: articlesEsLoader() })` in `src/content.config.ts`.
//
// Two sync modes only (simpler than the English loader's cold/warm/warm+sweep three-way split —
// this table is sparse and far smaller):
//   - cold (empty store, an `ES_LOADER_STATE_VERSION` bump, every
//     `ES_COLD_RESYNC_INTERVAL_SECONDS`, or `ARTICLES_FORCE_COLD=1` — the SAME env var the English
//     loader reads, so a forced full rebuild always forces both collections cold together):
//     `fetchTranslationsAll()`, a full bulk-fetch replacing the store wholesale (self-healing,
//     including cascade deletes when an article is removed).
//   - warm (every other build): `fetchTranslationsChangedSince(lastSync - ES_SYNC_OVERLAP_SECONDS)`
//     — after the full backfill writes ~40,000 rows, one warm pass can legitimately return all of
//     them in a single response; `ES_ROWS_READ_BUDGET` is sized to cover that.
//
// D-04/D-05: a row's `grounding_status` decides `available` — only a `'clean'` translation's
// title/summary/keyPoints ever reach the store; a held (non-clean) row is still stored (so its
// `sourceLanguage` and existence are known to templates for the D-07 "Originally reported in
// Spanish" label and the D-05 fallback note) but with `available: false` and null text. Held text
// NEVER enters the content store — there is no code path in this file that writes a held row's
// `title`/`summary`/`key_points` into the parsed data it hands to `store.set`.
//
// This collection is legitimately empty before any translation exists (pre-backfill, pre-pilot) —
// unlike the English loader's D-14 "zero rows is always a failure" rule, zero Spanish rows is a
// valid steady state here. The never-shrink check below is skipped specifically for that case; see
// the comment above `noTranslationEverExisted`.
//
// Every relative import below carries an explicit `.ts` extension — Node 24's native
// type-stripping (used by `node --test` in this project's unit tests, which import this module
// directly) does not resolve extensionless specifiers the way a bundler does.
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { UUID_RE } from '../../lib/article-url.ts';
import {
  fetchTranslationsAll,
  fetchTranslationsChangedSince as fetchTranslationsChangedSinceD1,
  type TranslationRow,
  type FetchTranslationsResult,
} from '../../lib/server/d1-client.ts';
import {
  readLastGood as readLastGoodState,
  writePendingBuildState as writePendingBuildStateFn,
  evaluateShrink,
  type LastGoodState,
} from '../../lib/server/build-state.ts';

/** Bumped whenever this loader's own sync semantics change in a way that invalidates whatever the
 * content-layer store already holds — forces a cold rebuild on the next run. Independent of the
 * English loader's `LOADER_STATE_VERSION` (06-PATTERNS.md: "give the Spanish loader its own
 * independent constants ... rather than importing the English ones"). */
export const ES_LOADER_STATE_VERSION = '1';

/** Every 7 days (or sooner, per the other cold triggers): the full bulk-fetch self-healing pass —
 * same interval as the English loader's `COLD_RESYNC_INTERVAL_SECONDS`, kept as this loader's own
 * constant rather than an import. */
export const ES_COLD_RESYNC_INTERVAL_SECONDS = 604_800;

/** One cron cycle's worth of overlap subtracted from `lastSync` before querying
 * `fetchTranslationsChangedSince`, so a translation that changed in the few seconds before the
 * previous build's cutoff is never missed by a boundary race — same discipline as the English
 * loader's `SWEEP_OVERLAP_SECONDS`. */
export const ES_SYNC_OVERLAP_SECONDS = 7_200;

// Task 2 measurement: production `article_translations` holds 0 real Spanish rows right now
// (confirmed live, `SELECT COUNT(*) ... WHERE language = 'es'` -> 0; 06-08's ≤30-row pilot had not
// landed yet at measurement time), so a real cold pass cannot measure a non-zero per-row cost
// directly — the projection below is built from the query's own CONFIRMED per-unit cost instead of
// an arbitrary round number. `EXPLAIN QUERY PLAN` against production for the exact cold-pass SQL
// (see the CROSS JOIN comment above `TRANSLATION_SELECT`/`fetchTranslationsAll` in d1-client.ts)
// shows `SEARCH t USING INDEX ... (article_id>?)` driving plus `SEARCH a USING INTEGER PRIMARY KEY
// (rowid=?)` probing — a range-scan read plus a point-lookup read per matched translation row, so
// D1's `rows_read` cost is ~2 per joined output row (confirmed: a real zero-row query against this
// exact SQL reads exactly 1 row, the index-scan's own minimum unit). Projected at D-10's full
// backfill scale (~41,000 Spanish rows): 41,000 x 2 = ~82,000 rows read for one full cold pass.
// Applying the English loader's own 2x margin discipline: 82,000 x 2 = 164,000; the next round
// number at or above that is 200,000. Re-measure directly once the backfill lands real rows
// (06-08+) and tighten this budget if the real figure comes in meaningfully under the projection.
export const ES_ROWS_READ_BUDGET = 200_000;

export const articleEsSchema = z.object({
  uuid: z.string().regex(UUID_RE, 'uuid must match UUID_RE'),
  sourceLanguage: z.enum(['en', 'es', 'und']),
  available: z.boolean(),
  title: z.string().min(1).nullable(),
  summary: z.string().min(1).nullable(),
  keyPoints: z.array(z.string().min(1)).nullable(),
  updatedAt: z.number().int(),
});

export type ArticleEsData = z.infer<typeof articleEsSchema>;

type SyncMode = 'cold' | 'warm';

/** Test seams only — production code never passes any of these; the real defaults are the actual
 * D1/KV modules. */
export interface ArticlesEsLoaderDeps {
  now?: () => number;
  fetchAll?: () => Promise<FetchTranslationsResult>;
  fetchChangedSince?: (sinceEpoch: number) => Promise<FetchTranslationsResult>;
  readLastGood?: () => Promise<LastGoodState | null>;
  writePending?: (patch: { articlesEs: { count: number; ids: string[] } }) => Promise<void>;
  env?: Record<string, string | undefined>;
}

/** Maps one raw D1 row to this loader's schema shape, or returns `null` if the row is malformed
 * (bad `key_points` JSON, an out-of-enum `source_language`, an invalid `uuid`, etc.) — a malformed
 * row is excluded from the store and counted separately, never thrown as a build-crashing error
 * (one bad translation must never block the whole build, same tolerance the English loader applies
 * to its own `missing-summary` rows). D-04/D-05: `title`/`summary`/`keyPoints` are forced to `null`
 * whenever `available` is `false` — held text is never carried into the candidate object at all,
 * so there is no later step that could accidentally store it. */
function mapRow(row: TranslationRow): { uuid: string; data: Record<string, unknown> } | null {
  const available = row.grounding_status === 'clean';

  let keyPoints: string[] | null = null;
  if (available && row.key_points !== null && row.key_points !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.key_points);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      return null;
    }
    keyPoints = parsed;
  }

  return {
    uuid: row.uuid,
    data: {
      uuid: row.uuid,
      sourceLanguage: row.source_language,
      available,
      title: available ? row.title : null,
      summary: available ? row.summary : null,
      keyPoints,
      updatedAt: row.updated_at,
    },
  };
}

export function articlesEsLoader(deps: ArticlesEsLoaderDeps = {}): Loader {
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const fetchAll = deps.fetchAll ?? fetchTranslationsAll;
  const fetchChangedSince = deps.fetchChangedSince ?? fetchTranslationsChangedSinceD1;
  const readLastGood = deps.readLastGood ?? readLastGoodState;
  const writePending = deps.writePending ?? writePendingBuildStateFn;
  const env = deps.env ?? process.env;

  return {
    name: 'd1-articles-es',
    schema: articleEsSchema,
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
        stateVersion !== ES_LOADER_STATE_VERSION ||
        lastCold === null ||
        nowEpoch - lastCold >= ES_COLD_RESYNC_INTERVAL_SECONDS ||
        forceCold
      ) {
        mode = 'cold';
      } else {
        mode = 'warm';
      }

      // ---------------------------------------------------------------
      // 2. Fetch.
      // ---------------------------------------------------------------
      let rawRows: TranslationRow[];
      let rowsRead: number;

      if (mode === 'cold') {
        const result = await fetchAll();
        rawRows = result.rows;
        rowsRead = result.rowsRead;
      } else {
        const lastSyncRaw = meta.get('lastSync');
        const lastSync = lastSyncRaw !== undefined ? Number(lastSyncRaw) : nowEpoch;
        const since = lastSync - ES_SYNC_OVERLAP_SECONDS;
        const result = await fetchChangedSince(since);
        rawRows = result.rows;
        rowsRead = result.rowsRead;
      }

      // ---------------------------------------------------------------
      // 3. Budget check — before any store mutation.
      // ---------------------------------------------------------------
      if (rowsRead > ES_ROWS_READ_BUDGET) {
        throw new Error(`articles-es: ${mode} rows-read budget exceeded: ${rowsRead} > ${ES_ROWS_READ_BUDGET}`);
      }

      // ---------------------------------------------------------------
      // 4. Map + validate every row — before any store mutation. Malformed rows are excluded and
      // counted, never thrown (see `mapRow`'s own doc comment).
      // ---------------------------------------------------------------
      let availableCount = 0;
      let heldCount = 0;
      let malformedCount = 0;
      const parsedRows: ArticleEsData[] = [];

      for (const row of rawRows) {
        const mapped = mapRow(row);
        if (mapped === null) {
          malformedCount += 1;
          continue;
        }
        try {
          const parsed = (await parseData({ id: mapped.uuid, data: mapped.data })) as ArticleEsData;
          parsedRows.push(parsed);
          if (parsed.available) availableCount += 1;
          else heldCount += 1;
        } catch {
          malformedCount += 1;
        }
      }

      // ---------------------------------------------------------------
      // 5. Compute the prospective id set — before any store mutation. Cold mode replaces the
      // store wholesale (self-healing, including cascade deletes); warm mode only ever upserts
      // (a Spanish row disappearing because its article was deleted is caught by the next cold
      // pass, same self-healing design as the English loader).
      // ---------------------------------------------------------------
      const existingStoreIds = new Set(store.keys());
      const newIds = new Set(parsedRows.map((p) => p.uuid));
      const prospectiveIds =
        mode === 'cold'
          ? newIds
          : (() => {
              const ids = new Set(existingStoreIds);
              for (const id of newIds) ids.add(id);
              return ids;
            })();

      // ---------------------------------------------------------------
      // 6. evaluateShrink — before any store mutation.
      // ---------------------------------------------------------------
      const lastGood = await readLastGood();
      const previousEs = lastGood?.articlesEs ?? null;
      // A pre-Phase-6 last-good record exists but has never carried an `articlesEs` section —
      // this is the FIRST build to ever report Spanish state, not a missing/corrupted baseline.
      // `BUILD_STATE_REQUIRE_BASELINE` guards a baseline that SHOULD exist and doesn't (a real
      // failure signal); it must not also block this one-time, expected transition, or the first
      // production build after this phase deploys would fail outright.
      const sectionNeverExisted = lastGood !== null && lastGood.articlesEs === undefined;
      // No Spanish translation has ever existed (current is empty, and either there is no
      // baseline at all or the baseline itself was empty) — a legitimate steady state before the
      // pilot/backfill lands, unlike the English loader's unconditional "zero rows is a failure"
      // rule. `evaluateShrink` itself has no such exception (D-14 is English-table-specific), so
      // this loader skips calling it entirely in this one case rather than passing it a flag it
      // doesn't support.
      const noTranslationEverExisted = prospectiveIds.size === 0 && (previousEs === null || previousEs.count === 0);

      const shrinkResult = noTranslationEverExisted
        ? {
            ok: true as const,
            note: 'articles-es: no Spanish rows exist yet — valid pre-translation state',
            missingCount: 0,
            explainedCount: 0,
            unexplainedCount: 0,
            allowanceUsed: 0,
          }
        : evaluateShrink({
            label: 'articles-es',
            previous: previousEs,
            currentIds: Array.from(prospectiveIds),
            allowance: parseInt(env.ALLOWED_ARTICLES_ES_SHRINK ?? '0', 10),
            requireBaseline: env.BUILD_STATE_REQUIRE_BASELINE === '1',
            bootstrap: env.BUILD_STATE_BOOTSTRAP === '1' || sectionNeverExisted,
          });

      // ---------------------------------------------------------------
      // 7. Mutate the store — only now.
      // ---------------------------------------------------------------
      if (mode === 'cold') {
        store.clear();
      }
      for (const parsed of parsedRows) {
        const digest = generateDigest(parsed as unknown as Record<string, unknown>);
        store.set({ id: parsed.uuid, data: parsed, digest });
      }

      // ---------------------------------------------------------------
      // 8. Meta updates.
      // ---------------------------------------------------------------
      meta.set('stateVersion', ES_LOADER_STATE_VERSION);
      if (mode === 'cold') {
        meta.set('lastCold', String(nowEpoch));
      }
      meta.set('lastSync', String(nowEpoch));

      // ---------------------------------------------------------------
      // 9. Pending build state — written unconditionally (even when empty), since
      // `commitLastGood`'s default `requiredSections` now includes `'articlesEs'`.
      // ---------------------------------------------------------------
      const finalIds = Array.from(prospectiveIds);
      await writePending({ articlesEs: { count: finalIds.length, ids: finalIds } });

      // ---------------------------------------------------------------
      // 10. One summary log line. `rows` is the raw count read from D1 (available + held +
      // malformed) — on a cold pass this equals `SELECT COUNT(*) FROM article_translations WHERE
      // language = 'es'` exactly, the acceptance criterion this line exists to let a human verify.
      // ---------------------------------------------------------------
      logger.info(
        `[articles-es] mode=${mode} rows=${rawRows.length} available=${availableCount} held=${heldCount} malformed=${malformedCount} rowsRead=${rowsRead} budget=${ES_ROWS_READ_BUDGET}`
      );
      void shrinkResult;
    },
  };
}
