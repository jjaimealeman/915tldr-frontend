// D-08 (05-03): pure archive-key derivation for the Worker's archive-serving branch
// (src/worker.ts). Imports only ./article-url.ts — this module is bundled directly into the
// deployed Worker, so (matching article-redirect.ts's own module-boundary discipline) it must
// never reach the D1/KV chokepoint directory (src/lib/server/, see tools/assert-no-d1.mjs's
// FORBIDDEN_TARGET_DIR).
//
// R2 keys are derived ONLY from a validated identifier — a uuid the Worker already obtained from
// its one KV read (resolveRedirect's `canonical` decision), or (Task 2) a TAG_SLUG_RE-validated
// slug off the request path itself — with a fixed `articles/`/`tags/` prefix, never from raw
// request path text (T-05-09). 05-03-PLAN.md's objective records why this plan does not add a
// stored `r2Key` to the manifest (schema v3 per 05-RESEARCH.md Pattern 1): the Worker already
// holds a validated articleId after its one KV read, so a stored key adds nothing, and deriving
// the key fresh on every request is race-free in both transition directions (hot->archive and
// archive->hot), where a stored tier flag could disagree with the deployed assets for the length
// of a build.
//
// Task 1 (this file's first version) implements only article-key derivation, the minimum the
// tracer needs. Task 2 adds `matchTagPath`/`tagArchiveKey`/`formatServerTiming` via its own
// RED/GREEN cycle — deliberately not stubbed here, so Task 2's RED run is genuine.
import { UUID_RE } from '../article-url.ts';

export const ARCHIVE_ARTICLE_PREFIX = 'articles/';
export const ARCHIVE_TAG_PREFIX = 'tags/';

/** Edge-cache TTL (seconds, Task 3) for an R2-served archive response — archived content changes
 * at most once per 2-hour build cycle (D-09/D-11), so a 5-minute edge cache can never serve
 * content more than one cycle stale. */
export const ARCHIVE_EDGE_CACHE_TTL_SECONDS = 300;

/**
 * Builds the R2 key for an archived article's canonical page from a validated articleId.
 * Lowercases before validating (mirrors `extractArticleUuid`'s own lowercase-then-match
 * discipline) and throws — never silently coerces — on anything that isn't a `UUID_RE`-shaped
 * uuid, matching `article-url.ts`'s `assertMatches` convention.
 */
export function articleArchiveKey(articleId: string): string {
  const lower = typeof articleId === 'string' ? articleId.toLowerCase() : articleId;
  if (typeof lower !== 'string' || !UUID_RE.test(lower)) {
    throw new Error(`archive-route: invalid articleId: ${JSON.stringify(articleId)}`);
  }
  return `${ARCHIVE_ARTICLE_PREFIX}${lower}.html`;
}
