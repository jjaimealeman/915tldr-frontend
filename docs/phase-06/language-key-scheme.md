# Language Key Scheme — KV Manifest Identity, R2 Archive Keys, and the `/es` Canonical Path

Produced by 06-02-PLAN.md (Task 1). Records the decision for how the KV render-manifest, the R2
archive tier and the Worker's canonical-path check carry a second language without colliding with
the English-only data already written by Phases 3-5.

## The assumption-delta decision

06-RESEARCH.md's Pattern 3 proposed making BOTH the KV manifest key and the R2 archive key
language-qualified (`manifest:<uuid>:<language>`, `articles/<uuid>/<language>.html`). 06-02-PLAN.md
overrode that proposal after re-reading what the manifest entry actually stores. The identity
noun for this phase is the **translation group** (Phase 3 D-04: the English uuid =
`translationGroupId`); a **page** is `(translation group, language)`.

### KV render manifest — `no-change` to the stored identity entry

`manifest:<uuid>` already IS the translation-group identity record: `category`, the stored `slug`
and `articleId` are **untranslated** (D-02/D-06 — slugs and category *slugs* never change between
languages; only the category's *display name* does, via a fixed UI label map the Worker never
touches). So the Worker reads that **ONE** entry for both `/x` and `/es/x`, and derives the
language from the validated path prefix (`languageOfPath`, `src/lib/article-url.ts`) — not from
the stored value. This is still exactly one KV read per request (ARCH-08), unchanged from Phase 5.

No Spanish manifest entries are written this phase — nothing would read them, since the Worker's
one read already serves both languages off the English entry. 06-04 (a later plan in this phase)
still makes `manifestKey(articleId, language)` itself language-aware (`es` → `manifest:<uuid>:es`)
so that if a later writer ever emits a Spanish manifest entry for some other purpose, it lands at
its own key and can never silently overwrite the English one at `manifest:<uuid>`.

**Why not language-qualify the manifest key now, as 06-RESEARCH.md originally proposed?** Because
the *reason* the research pass flagged a collision was "a Spanish write would overwrite the
English entry at the same key" — but this plan does not write a Spanish entry at all. The
identity data behind `/es/x` and `/x` is the same record. Qualifying the key pre-emptively would
require every `/es` request to resolve to a *different* KV entry holding duplicate
category/slug/articleId data that must stay in lockstep with the English entry forever — a sync
burden with no corresponding benefit, since nothing today needs language-specific identity data
in the manifest.

### R2 archive keys — `add-alongside`

English keys are unchanged: `articles/<uuid>.html`, `tags/<slug>.html` (unprefixed = default
language, matching both the published URL shape and `x-default → English`, D-06/D-08). Spanish
keys are added alongside, at a fixed prefix: `es/articles/<uuid>.html`, `es/tags/<slug>.html`
(`ARCHIVE_ES_PREFIX = 'es/'` in `src/lib/archive/archive-route.ts`).

**Rejected: `promote`** — renaming every existing key to `en/articles/<uuid>.html` so English and
Spanish are symmetric. This would require re-uploading all ~30,500 existing English R2 objects,
rewriting the archive index (`tools/archive-sync.mjs`) and the Worker's English read path, in one
coordinated migration — for zero reader-visible gain. The chosen shape costs nothing to existing
data: every English key, every existing sync-tool invariant, and every already-archived object
stays exactly as it was before this phase.

## Key table

| | Article (KV identity) | Article (R2 archive) | Tag (R2 archive) |
|---|---|---|---|
| **en** (default, unchanged) | `manifest:<uuid>` | `articles/<uuid>.html` | `tags/<slug>.html` |
| **es** | *same* `manifest:<uuid>` entry, language derived from the request path | `es/articles/<uuid>.html` | `es/tags/<slug>.html` |

## Reversibility

Rated **costly, not one-way**, in the plan's own `<reversibility>` block. If the R2 key shape ever
needs to change (e.g. to the `promote` shape above, or to a nested-directory shape), every
existing Spanish archive object (~30,000 once the D-10 backfill runs) would need re-uploading
under the new key — mechanical via the existing `requestFullReupload` path `tools/archive-sync.mjs`
already supports for exactly this kind of forced full resync — plus a coordinated Worker deploy so
the read path and the re-uploaded keys agree during the cutover window. No published URL and no
English key is ever affected by that kind of change, which is what keeps the rating at "costly"
rather than "one-way": nothing reader-visible (an indexed URL, a hreflang pair) depends on the
internal storage key shape, unlike the published `/es` URL shape itself (D-06, rated one-way in
CONTEXT.md).

## Invariants the tests pin

- `tests/unit/worker.test.mjs`: a GET for an archived `/es/<category>/<slug>-<uuid>` performs
  exactly one `RENDER_MANIFEST.get('manifest:<uuid>', 'json')` call and reads R2 key
  `es/articles/<uuid>.html`; the equivalent English request still reads the unprefixed
  `articles/<uuid>.html` key, and both do so with exactly one KV read.
- `tests/unit/worker.test.mjs`: a non-canonical `/es` request (wrong slug, wrong category) 301s
  to the `/es` canonical, never to the English one.
- `tests/unit/worker.test.mjs`: the Worker's response is byte-identical with and without an
  `Accept-Language: es-MX` header on every shape tested (D-13) — the language comes only from the
  path.
- `tests/unit/article-url.test.mjs`: `languageOfPath` is a case-sensitive, exact-first-segment
  test — `/escuela/...`, `/es-mx/...` and `/ES/...` are all `'en'`, never `'es'` (I18N-04
  adjacency).
- `tests/unit/article-redirect.test.mjs` / `tests/unit/archive-route.test.mjs`: `assertLanguage`
  is a closed two-member enum with no trimming or case-folding, exercised at every key- and
  path-construction call site.
