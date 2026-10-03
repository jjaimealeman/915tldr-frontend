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
import { TAG_SLUG_RE, UUID_RE, assertLanguage, type Language } from '../article-url.ts';

export const ARCHIVE_ARTICLE_PREFIX = 'articles/';
export const ARCHIVE_TAG_PREFIX = 'tags/';

/** 06-02 (D-06, assumption-delta decision in 06-02-PLAN.md): English R2 objects keep their
 * existing unprefixed keys (`articles/<uuid>.html`, `tags/<slug>.html` — unprefixed = default
 * language, matching the published URLs and `x-default` → English). Spanish objects are
 * ADD-ALONGSIDE at this prefix: `es/articles/<uuid>.html`, `es/tags/<slug>.html`. Rejected:
 * "promote" (`en/articles/...` for everything), which would rewrite ~30,500 existing English R2
 * objects for zero reader-visible gain. See `docs/phase-06/language-key-scheme.md`. */
export const ARCHIVE_ES_PREFIX = 'es/';

/** Edge-cache TTL (seconds, Task 3) for an R2-served archive response — archived content changes
 * at most once per 2-hour build cycle (D-09/D-11), so a 5-minute edge cache can never serve
 * content more than one cycle stale. */
export const ARCHIVE_EDGE_CACHE_TTL_SECONDS = 300;

/**
 * Builds the R2 key for an archived article's canonical page from a validated articleId and
 * language (06-02, default `'en'` — the existing unprefixed key, unchanged). Lowercases the
 * articleId before validating (mirrors `extractArticleUuid`'s own lowercase-then-match
 * discipline) and throws — never silently coerces, no trimming, no case-folding — on anything
 * that isn't a `UUID_RE`-shaped uuid or a closed-enum language, matching `article-url.ts`'s
 * `assertMatches`/`assertLanguage` convention.
 */
export function articleArchiveKey(articleId: string, language: Language = 'en'): string {
  const lower = typeof articleId === 'string' ? articleId.toLowerCase() : articleId;
  if (typeof lower !== 'string' || !UUID_RE.test(lower)) {
    throw new Error(`archive-route: invalid articleId: ${JSON.stringify(articleId)}`);
  }
  assertLanguage(language);
  const prefix = language === 'es' ? ARCHIVE_ES_PREFIX : '';
  return `${prefix}${ARCHIVE_ARTICLE_PREFIX}${lower}.html`;
}

/** A matched `/tag/<slug>` or `/es/tag/<slug>` request path: `suffix` is `''` (bare canonical),
 * `'/'` (trailing slash) or `'.html'`; `language` is `'es'` only for the `/es/tag/...` shape.
 * Returned by `matchTagPath`. */
export interface TagPathMatch {
  slug: string;
  suffix: '' | '/' | '.html';
  language: Language;
}

/** Matches `/tag/<slug>` or `/es/tag/<slug>`, where `<slug>` is one or more non-`/` characters,
 * followed by at most one of `/` or `.html` and the end of the string. The optional `/es` group
 * is captured so `matchTagPath` can report `language` without a second regex pass. */
const TAG_PATH_RE = /^(\/es)?\/tag\/([^/]+?)(\/|\.html)?$/;

/**
 * Matches `/tag/<slug>` or `/es/tag/<slug>`, optionally followed by exactly one `/` or `.html`,
 * decoding the pathname first (a malformed percent-encoding is treated identically to "no
 * match", mirroring `extractArticleUuid`'s try/catch discipline) and validating `slug` against
 * `TAG_SLUG_RE` before ever accepting it. Returns `null` for anything else — including `/tag/`,
 * `/tag/a/b`, `/tags`, `/es/tag/`, `/es/tags`, an uppercase or otherwise-invalid slug, and a
 * path-traversal segment like `/tag/%2e%2e` (decodes to `/tag/..`, which `TAG_SLUG_RE` rejects —
 * `.` is not in its character class).
 */
export function matchTagPath(pathname: string): TagPathMatch | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const match = TAG_PATH_RE.exec(decoded);
  if (!match) return null;

  const slug = match[2];
  if (!TAG_SLUG_RE.test(slug)) return null;

  return {
    slug,
    suffix: (match[3] ?? '') as TagPathMatch['suffix'],
    language: match[1] ? 'es' : 'en',
  };
}

/**
 * Builds the R2 key for an archived tag's canonical page from a validated slug and language
 * (06-02, default `'en'` — the existing unprefixed key, unchanged). Throws — never silently
 * coerces, no trimming, no case-folding — on anything that doesn't match `TAG_SLUG_RE` or a
 * closed-enum language.
 */
export function tagArchiveKey(slug: string, language: Language = 'en'): string {
  if (typeof slug !== 'string' || !TAG_SLUG_RE.test(slug)) {
    throw new Error(`archive-route: invalid tag slug: ${JSON.stringify(slug)}`);
  }
  assertLanguage(language);
  const prefix = language === 'es' ? ARCHIVE_ES_PREFIX : '';
  return `${prefix}${ARCHIVE_TAG_PREFIX}${slug}.html`;
}

/** One `Server-Timing` metric: `desc` is the optional `;desc=` value (e.g. `r2`, `edge-cache`);
 * `dur` is the optional `;dur=` value in milliseconds. A metric with neither is emitted as its
 * bare name. */
export interface ServerTimingMetric {
  name: string;
  desc?: string;
  dur?: number;
}

/**
 * Formats a list of Server-Timing metrics into the header's comma-separated wire format, e.g.
 * `archive;desc=r2, kv;dur=12, r2;dur=34`.
 */
export function formatServerTiming(metrics: ServerTimingMetric[]): string {
  return metrics
    .map((metric) => {
      const parts = [metric.name];
      if (metric.desc !== undefined) parts.push(`desc=${metric.desc}`);
      if (metric.dur !== undefined) parts.push(`dur=${metric.dur}`);
      return parts.length === 1 ? parts[0] : `${parts[0]};${parts.slice(1).join(';')}`;
    })
    .join(', ');
}
