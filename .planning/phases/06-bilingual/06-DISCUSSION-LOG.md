# Phase 6: Bilingual - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-03
**Phase:** 06-bilingual
**Areas discussed:** Spanish data shape, URLs & Spanish-origin, Launch & backfill posture, Switcher & site chrome

**Interlude (before the second question):** Liz asked whether months of old articles are really
needed. Measured that night: 44,169 rows / 40,761 public in D1 (oldest 2025-12-10); ~60,700 pages
English-only, ~121,000 with Spanish; ~32,795 production article requests Sep 3–30 (~1,170/day,
requests not unique people). Readers do read old stories (80% of reads need an 83-day window). The
owner chose to keep the archive and continue Phase 6 as planned. A follow-up check found the Umami
tag was never installed, which led to D-11.

---

## Spanish data shape

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling table | `article_translations`; `articles` and its indexes untouched | ✓ |
| Separate row in articles | Doubles the table; every query needs a language filter | |
| Extra columns | title_es/summary_es/key_points_es; hard-wires two languages | |

| Option | Description | Selected |
|--------|-------------|----------|
| Title, summary, key points | Tags/entities untranslated; category names via UI map | ✓ |
| Also translate tags | ~20k-tag mapping, inconsistent translations | |
| Also translate the slug | Frozen-identity Spanish slugs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Check Spanish too | Same grounding check and queue | ✓ |
| Trust the shared call | Assume Spanish fine if English passes | |
| Spot-check only | Sample ~30 by eye | |

| Option | Description | Selected |
|--------|-------------|----------|
| Publish English, hold Spanish | /es falls back to English with a note | ✓ |
| Hold both | Neither publishes until both pass | |
| Retry once, then English-only | No queue | |

---

## URLs & Spanish-origin

| Option | Description | Selected |
|--------|-------------|----------|
| /es + identical path | Exact mirror of the English URL | ✓ |
| Spanish category segment | /es/crimen/... | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same as any article, plus a label | "Originally reported in Spanish"; lang="es" source link | ✓ |
| Same, no label | | |
| Spanish page is primary | x-default → /es for these | |

**Defaults accepted:** x-default → English; /es/rss.xml + Spanish sitemap; every page type mirrored.

---

## Launch & backfill posture

| Option | Description | Selected |
|--------|-------------|----------|
| Live with a measured launch | Public but noindex until data | |
| Fully public immediately | Indexed from day one; overrides PROJECT.md data gate | ✓ |
| Hidden until data says go | PROJECT.md as written | |

**Notes:** Owner: "80% of our population speak Spanish. if none of the real news outlets serve those
readers, then we become the top news source for spanish speakers." Claude flagged that PROJECT.md
rejects the demographic figure alone as justification; owner chose full launch knowing that.

| Option | Description | Selected |
|--------|-------------|----------|
| All of it, batched | ~40,761 articles, ~$1.49 estimate, dry run first | ✓ |
| Hot window only | ~27,500 | |
| New articles only | No backfill | |

| Option | Description | Selected |
|--------|-------------|----------|
| In v2's Worker | Aggregate buckets via Analytics Engine | (chosen first, then superseded) |
| In v1 too, starting now | | |

**Superseded by:** Umami. The owner supplied the tag and a screenshot of an empty Umami dashboard.
The tag was verified as never installed anywhere.

| Option | Description | Selected |
|--------|-------------|----------|
| v1 now + v2, Umami for language | Quick task on v1; Umami Languages report for I18N-10 | ✓ |
| v2 only, Umami for language | | |
| Keep the Worker counter | | |

---

## Switcher & site chrome

| Option | Description | Selected |
|--------|-------------|----------|
| Header + on each article | Plain links | ✓ |
| Header only | | |
| Footer + article | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Links only, no cookie | /es links stay in /es | ✓ |
| Remember with a cookie | Cookie redirect | |

| Option | Description | Selected |
|--------|-------------|----------|
| AI draft, human review | About/Privacy/Terms/Contact reviewed by a fluent reader | ✓ |
| AI translation, ship as-is | | |
| English-only for now | | |

| Option | Description | Selected |
|--------|-------------|----------|
| English content, Spanish chrome | Changelog entries stay English | ✓ |
| Translate every entry | | |

---

## Claude's Discretion

Language-detection method; `article_translations` details; Spanish register; prompt change; Google
News sitemap for /es; backfill order and pacing; exact UI copy.

## Deferred Ideas

Contact page focus and asking readers what they want; deploy ASAP (roadmap ordering); Umami
engagement setup with browser access; Umami tag on v1 (quick task); derive-hot-window hostname
filter bug.
