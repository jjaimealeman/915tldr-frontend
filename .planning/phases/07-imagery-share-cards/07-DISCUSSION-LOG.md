# Phase 7: Share Cards & Head Metadata - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-08
**Phase:** 07-imagery-share-cards
**Areas discussed:** Phase shape & roadmap amendment, Spanish card & per-page og:image, Logo mark/favicon/icons, Meta tags + card validation

Prior decisions (from the 2026-10-08 handoff, not re-asked): no page images; no per-article OG; one static card; V1 masthead design chosen.

---

## Phase shape & roadmap amendment

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as Phase 7, rename | 'Share Cards & Head Metadata'; branch exists | ✓ |
| Fold into Phase 8 | Shares Base.astro with theme toggle/ClientRouter | |
| /gsd-quick | Skip phase ceremony | |

**User's choice:** Keep as Phase 7, rename.

| Option | Description | Selected |
|--------|-------------|----------|
| Move to 'Deferred / v2.x' section | Verbatim with reasons | ✓ |
| Delete outright | | |
| Keep in place, marked Out of scope | | |

**User's choice:** Move to Deferred / v2.x.

---

## Spanish card & per-page og:image

| Option | Description | Selected |
|--------|-------------|----------|
| Two cards: EN + ES | og-image.png + og-image-es.png | ✓ |
| One English card everywhere | | |
| One card with no tagline text | | |

**User's choice:** Two cards.

| Option | Description | Selected |
|--------|-------------|----------|
| Describe the card | '915 TLDR — El Paso news, in brief.' | ✓ |
| Per-page alt (headline) | | |
| You decide | | |

**User's choice:** Describe the card.

| Option | Description | Selected |
|--------|-------------|----------|
| /og-image.png and /og-image-es.png in public/ | Matches v1 URL | ✓ |
| Versioned name | | |
| /og/ directory | | |

**User's choice:** /og-image.png and /og-image-es.png.

---

## Logo mark, favicon & icons

| Option | Description | Selected |
|--------|-------------|----------|
| Keep text wordmark in header | Matches approved mockups | ✓ |
| Add the mark beside the wordmark | | |
| Replace wordmark with the mark | | |

**User's choice:** Keep text wordmark.

| Option | Description | Selected |
|--------|-------------|----------|
| Port v1 as-is + apple-touch-icon | | ✓ |
| Port v1 as-is, nothing more | | |
| Full set + web manifest | | |

**User's choice:** Port v1 + apple-touch-icon.

---

## Meta tags + card validation

| Option | Description | Selected |
|--------|-------------|----------|
| article:author = /about URL | Consistent with JSON-LD | ✓ |
| Omit article:author | | |
| Originating outlet's URL | | |

**User's choice:** /about URL.

| Option | Description | Selected |
|--------|-------------|----------|
| All pages og+twitter:card; articles add article:*; no twitter:site | | ✓ |
| Same, plus handle supplied | | |
| Skip tags on noindex pages | | |

**User's choice:** First option (no twitter:site).

| Option | Description | Selected |
|--------|-------------|----------|
| PNG, measure WhatsApp, JPEG fallback if needed | | ✓ |
| Ship JPEG now | | |
| Research limits online first | | |

**User's choice:** PNG, measure, fall back only if needed.

| Option | Description | Selected |
|--------|-------------|----------|
| Dev host, all five platforms | | ✓ |
| Only after cutover on prod | | |
| Dev host, three platforms | | |

**User's choice:** Dev host, all five platforms.

---

## Claude's Discretion

- Spanish tagline/credit wording (owner confirms at plan time), `og:type` for non-articles, `og:locale` mapping, `og:description` fallbacks, apple-touch-icon rendering method.

## Deferred Ideas

- Per-article OG images; all page imagery (IMG-*); image backfills; on-demand OG rendering; header logo mark; web manifest; twitter:site.
