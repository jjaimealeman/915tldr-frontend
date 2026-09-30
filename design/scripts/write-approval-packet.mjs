#!/usr/bin/env node
// D-16: writes .planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md
// from the unscoped verify:phase-1 evidence. Refuses scoped or failing evidence,
// and refuses to regenerate over a signed packet.
//
// 01-23 restores D-16's original strict gate. 01-10 (see that script's own
// header comment, now superseded) temporarily widened this gate to accept a
// FAIL on criterion 5 alone, because 01-09 had root-caused a genuine,
// non-cosmetic font-swap CLS failure inherent to font-display:swap, and the
// owner had not yet made the architectural call needed to fix it. That call
// was made (owner decision D-GAP-A, 2026-09-17: reopen PRD §6.5, switch to
// font-display:optional, shrink the Source Serif 4 subsets) and implemented in
// 01-13/01-14. Criterion 5 now passes on real evidence. There is no remaining
// reason to special-case it, so the exception is REMOVED here: every criterion
// must PASS in every engine it runs in, or this script refuses to generate a
// packet at all, full stop — D-16's original contract.
//
// This run (01-23) also carries the round-1 packet's own revision history
// forward rather than silently discarding it: the existing packet's
// "Revision requests" and "File fingerprints" sections are read before the
// file is rewritten, and folded into a new "Revision history" section so the
// owner's round-1 words are never lost to a regeneration.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const REPO_ROOT = path.resolve('.');
const PHASE_DIR = '.planning/phases/01-design-sketch-editorial-identity';
const OUT_PATH = path.join(PHASE_DIR, '01-APPROVAL.md');
const EVIDENCE_REL = '../../../design/evidence';
const SIGNOFF_LINE_RE = /^Approved-by: \S.* — \d{4}-\d{2}-\d{2}$/;
const SIGNOFF_LABEL_RE = /^Approved-by:/m;

function parseArgs(argv) {
  const args = { evidence: 'design/evidence/verify-phase-1.json', packet: OUT_PATH };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--evidence' && argv[i + 1]) args.evidence = argv[i + 1];
    if (argv[i] === '--packet' && argv[i + 1]) args.packet = argv[i + 1];
  }
  return args;
}

function sha256(relPath) {
  const full = path.resolve(relPath);
  if (!existsSync(full)) return `MISSING: ${relPath}`;
  const buf = readFileSync(full);
  return createHash('sha256').update(buf).digest('hex');
}

function readJson(relPath) {
  return JSON.parse(readFileSync(path.resolve(relPath), 'utf8'));
}

function readTextIfExists(relPath) {
  const full = path.resolve(relPath);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
}

function extractSection(markdown, headingRegex, nextHeadingRegex) {
  if (!markdown) return null;
  const startMatch = markdown.match(headingRegex);
  if (!startMatch) return null;
  const startIdx = startMatch.index + startMatch[0].length;
  const rest = markdown.slice(startIdx);
  const endMatch = rest.match(nextHeadingRegex);
  return (endMatch ? rest.slice(0, endMatch.index) : rest).trim();
}

// Extracts the body of a top-level "## <heading>" section: everything after
// that heading line up to (not including) the next top-level "## " heading,
// or end of file. Returns null if the heading is not present.
function extractTopLevelSection(md, heading) {
  if (!md) return null;
  const re = new RegExp(`^## ${heading}\\s*$`, 'm');
  return extractSection(md, re, /\n## /);
}

function readChromiumWebkitVersions(fontClsMd) {
  if (!fontClsMd) return { chromium: 'unknown', webkit: 'unknown' };
  const line = fontClsMd.split('\n').find((l) => l.startsWith('Chromium '));
  if (!line) return { chromium: 'unknown', webkit: 'unknown' };
  const chromiumMatch = line.match(/Chromium ([^\s,]+)/);
  const webkitMatch = line.match(/WebKit \(Playwright\) ([^\s,]+)/);
  return {
    chromium: chromiumMatch ? chromiumMatch[1] : 'unknown',
    webkit: webkitMatch ? webkitMatch[1] : 'unknown',
  };
}

function readFallbackFacesPerEngine(fontClsMd) {
  // font-cls.md now carries a second, differently-shaped table (the D-GAP-A
  // positive control, added in 01-13) whose own column 5 happens to be
  // "verdict"/"detected"/"not observable" for the same column index as the
  // swap matrix's "fallback face" column. Scope collection to rows strictly
  // inside the swap-matrix table (the one whose header cell 5 literally
  // reads "fallback face"), not any table row with more than 5 columns.
  if (!fontClsMd) return [];
  const faceSet = new Set();
  let inSwapTable = false;
  for (const line of fontClsMd.split('\n')) {
    if (!line.startsWith('|')) {
      inSwapTable = false;
      continue;
    }
    const cols = line.split('|').map((c) => c.trim());
    if (cols[5] === 'fallback face') {
      inSwapTable = true;
      continue;
    }
    if (cols.every((c) => /^-*$/.test(c))) continue; // separator row
    if (inSwapTable && cols.length > 5 && cols[5]) faceSet.add(cols[5]);
  }
  return [...faceSet].filter(Boolean);
}

function readPackageVersion(pkgName) {
  const pkg = readJson('package.json');
  return pkg.devDependencies?.[pkgName] ?? pkg.dependencies?.[pkgName] ?? 'unknown';
}

function readPackageManager() {
  const pkg = readJson('package.json');
  return pkg.packageManager ?? 'unknown';
}

function buildPaletteProvenanceTable(hueSources, paletteMd) {
  const rows = hueSources
    .map((h) => {
      const note = (h.note ?? '').replace(/\|/g, '\\|');
      return `| ${h.slug} | ${h.subject} | [source](${h.pageUrl}) | ${h.license} | ${h.hue}° | ${note} |`;
    })
    .join('\n');

  const c01Section = extractSection(paletteMd, /## C-01 review\s*/, /\n\*\*Overall/);

  return [
    '| Category | Subject | Photo | Licence | Sampled hue | Note |',
    '|---|---|---|---|---|---|',
    rows,
    '',
    '### C-01 review (verbatim from palette.md)',
    '',
    c01Section ?? '_palette.md C-01 review section not found._',
  ].join('\n');
}

function listFeedPages() {
  const feedDir = path.resolve('design/mockups/feed');
  if (!existsSync(feedDir)) return [];
  const pageRe = /^page-(\d+)\.json$/;
  return readdirSync(feedDir)
    .map((f) => ({ file: f, m: f.match(pageRe) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    .map((x) => `design/mockups/feed/${x.file}`);
}

// Round-1 -> round-2 closure map, confirmed against 01-11..01-22-SUMMARY.md
// and design/evidence/*.md at generation time (01-23 read_first).
const ROUND1_CLOSURE_TABLE = `| Round-1 item | Plans | Evidence |
|---|---|---|
| A — criterion 5: font-display optional + shrink Source Serif 4 | 01-13, 01-14 | font-cls.md (paths + positive control), font-subset.md |
| B — Source Serif 4 Bold headlines; Instrument Serif wordmark only | 01-14, 01-15 | structure.spec "type roles"; recalibrated spanish-stress.json |
| C — Business: new photo, re-sample | 01-16 | palette.md, swatches, photo-sources.json |
| D — pnpm | 01-11 | pnpm-lock.yaml, pw.mjs, lockfile parity |
| 1 — remove the header rule | 01-17 | chrome.spec.ts |
| 2 — category lead image or fallback | 01-18 | lead-fallback.spec.ts, content.spec lead contract |
| 3 — article right rail | 01-19 | layout.spec.ts (article) |
| 4 — changelog layout | 01-20 | layout.spec.ts (changelog) |
| 5 — contact centring and spacing | 01-20 | layout.spec.ts (contact) |
| 6 — external links, new tab | 01-17 | content.spec, keyboard-walk new-tab test |
| 7 — 768px full width | 01-19, 01-20 | layout.spec.ts |
| 8 — Load more | 01-21, 01-22 | load-more.spec.ts, keyboard-walk load-more tests, expanded-feed checks |
| 9 — raw markdown | 01-12, 01-18 | summary-markdown unit tests; content.spec markdown test |
| 10 — toggle outside column | 01-17 | chrome.spec.ts |
| Accepted as-is in round 1 | — | Spanish copy; keyboard walk order; Weather hue. Politics photo: no objection raised, to be confirmed. Real-Safari/Georgia: still open |`;

function buildRevisionHistory(existingMd) {
  const existingHistoryBody = extractTopLevelSection(existingMd, 'Revision history');
  if (existingHistoryBody) {
    // Already a round-2+ packet being regenerated again — carry the whole
    // prior history forward verbatim. (This plan only implements the round
    // 1 -> round 2 transition; a future regeneration adds its own new round
    // the same way, cumulatively.)
    return existingHistoryBody;
  }

  const round1Body = extractTopLevelSection(existingMd, 'Revision requests');
  if (round1Body === null || SIGNOFF_LABEL_RE.test(round1Body)) {
    console.error('FATAL: could not extract a round-1 "## Revision requests" body to preserve — refusing to regenerate.');
    process.exit(1);
  }
  const round1Fingerprints = extractTopLevelSection(existingMd, 'File fingerprints');

  return [
    '### Round 1 — 2026-09-17 — revisions requested (not approved)',
    '',
    round1Body,
    '',
    '#### Round 1 fingerprints (superseded)',
    '',
    round1Fingerprints ?? '_round-1 fingerprint table not found._',
    '',
    '#### Round 1 closure',
    '',
    ROUND1_CLOSURE_TABLE,
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(path.resolve(args.evidence))) {
    console.error(`FATAL: evidence file not found: ${args.evidence}`);
    process.exit(1);
  }
  const evidence = readJson(args.evidence);

  if (evidence.scope !== 'full') {
    console.error(
      `FATAL: evidence scope is "${evidence.scope}" (SCOPED) — refusing to generate an approval packet from a narrowed run. Re-run "pnpm run verify:phase-1" with no flags.`
    );
    process.exit(1);
  }

  // Strict D-16 gate, restored: every criterion must PASS. No exceptions.
  const failures = Object.entries(evidence.results).filter(([, r]) => r.verdict !== 'PASS');
  if (failures.length > 0) {
    console.error(
      `FATAL: criterion (${failures.map(([c]) => c).join(', ')}) failed — refusing to generate a packet. Fix and re-run "pnpm run verify:phase-1".`
    );
    process.exit(1);
  }

  const passCount = Object.values(evidence.results).filter((r) => r.verdict === 'PASS').length;
  const totalCount = Object.keys(evidence.results).length;

  if (!existsSync(path.resolve(args.packet))) {
    console.error(`FATAL: existing packet not found at ${args.packet} — nothing to regenerate over. Run 01-10's original generation first.`);
    process.exit(1);
  }
  const existingMd = readFileSync(path.resolve(args.packet), 'utf8');

  if (SIGNOFF_LABEL_RE.test(existingMd)) {
    console.error(
      'FATAL: packet is signed — refusing to regenerate over an owner signature (T-01-32/T-01-33).'
    );
    process.exit(1);
  }

  const revisionHistoryBody = buildRevisionHistory(existingMd);

  const runnerOutput = readTextIfExists('design/evidence/verify-phase-1.txt') ?? '(missing design/evidence/verify-phase-1.txt)';
  const fontClsMd = readTextIfExists('design/evidence/font-cls.md');
  const { chromium: chromiumVersion, webkit: webkitEngineVersion } = readChromiumWebkitVersions(fontClsMd);
  const fallbackFaces = readFallbackFacesPerEngine(fontClsMd);
  const webkitMode = existsSync('design/.webkit-mode.json') ? readJson('design/.webkit-mode.json') : {};
  const hueSources = readJson('design/palette/hue-sources.json');
  const paletteMd = readTextIfExists('design/evidence/palette.md');
  const playwrightVersion = readPackageVersion('@playwright/test');
  const nodeVersion = process.version;
  const pnpmVersion = readPackageManager();

  const feedPages = listFeedPages();
  const fingerprintTargets = [
    'design/mockups/style.css',
    'design/mockups/index.html',
    'design/mockups/category.html',
    'design/mockups/article.html',
    'design/mockups/changelog.html',
    'design/mockups/contact.html',
    'design/palette/palette.json',
    'design/mockups/fonts/subset-manifest.json',
    'design/fixtures/home-feed.json',
    ...feedPages,
  ];
  const fingerprintRows = fingerprintTargets.map((f) => `| \`${f}\` | \`${sha256(f)}\` |`).join('\n');

  const statusLine = `Machine evidence: PASS (${passCount}/${totalCount}, Chromium + WebKit (Playwright)). Owner sign-off: pending.`;
  const generatedAt = new Date().toISOString();

  const criteriaRows = [
    ['1', 'Mockups + both themes + no .astro files', [['contrast.md', 'contrast.md'], ['pages/', 'pages/']]],
    ['2', 'Contrast (D-13)', [['contrast.md', 'contrast.md']]],
    ['3', 'Keyboard walk (D-14, scripted half)', [['keyboard/ contact sheets', 'keyboard/'], ['tab-order-chromium.json', 'keyboard/tab-order-chromium.json'], ['tab-order-webkit.json', 'keyboard/tab-order-webkit.json']]],
    ['4', 'Spanish overflow (D-15)', [['pages/ (320px screenshots)', 'pages/'], ['spanish-overflow.spec.ts results — see Runner output above', null]]],
    ['5', 'Font subsetting + swap CLS (D-08, D-GAP-A)', [['font-cls.md', 'font-cls.md'], ['font-subset.md', 'font-subset.md']]],
  ];

  const criteriaTable = [
    '| Criterion | What it checks | Evidence |',
    '|---|---|---|',
    ...criteriaRows.map(([n, what, links]) => {
      const cell = links.map(([label, target]) => (target ? `[${label}](${EVIDENCE_REL}/${target})` : label)).join(', ');
      return `| ${n} | ${what} | ${cell} |`;
    }),
    `| — | Palette swatches (both themes) | [palette-swatches-light.png](${EVIDENCE_REL}/palette-swatches-light.png), [palette-swatches-dark.png](${EVIDENCE_REL}/palette-swatches-dark.png) |`,
    `| — | Layout / chrome / lead-fallback / load-more regression | covered by \`layout.spec.ts\`, \`chrome.spec.ts\`, \`lead-fallback.spec.ts\`, \`load-more.spec.ts\` in the Runner output above |`,
  ].join('\n');

  const businessHue = hueSources.find((h) => h.slug === 'business');
  const politicsHue = hueSources.find((h) => h.slug === 'politics');

  const ownerReviewFocus = `## Owner review focus (round 2)

1. **Real-Safari/Georgia is still open.** WebKit (Playwright ${webkitMode.webkitVersion ?? 'unknown'}, ${webkitMode.mode ?? 'unknown'}) is not Safari — it tracks WebKit trunk on Linux, ahead of any shipped Safari release. Georgia is not installed on this Linux machine or in the pinned Playwright Docker image (\`${webkitMode.image ?? 'unknown'}\`), so the fallback face most real macOS/iOS/Windows readers actually get was never directly measured. A real macOS or iOS Safari pass, including the Georgia fallback, remains open (WINDOWS.md entry 1).
2. **The new Business photo and hue.** Subject as recorded: "${businessHue?.subject ?? 'unknown'}"; licence ${businessHue?.license ?? 'unknown'}; final sampled hue ${businessHue?.hue ?? 'unknown'}°, a forest green (see hue-sources.json / palette.json, and the Palette provenance section below). Two things for the owner to weigh: the record's own subject wording still says "turquoise or teal" even though the photo that was actually used and sampled reads as green at 152° — the subject text was not updated to match the photo that replaced the marigold record (D-GAP-C, 01-16); and at the palette's "block" stop, Business and Health are the closest pair of all eight categories (OKLab distance 0.0559 against the 0.05 floor — comfortably a PASS, but the tightest margin in the palette; see design/evidence/palette.md "Minimum pairwise distance"). Separately, \`design/evidence/palette-swatches-*.png\`'s captions still read "Instrument Serif" in the swatch heading text, even though 01-14 moved headlines to Source Serif 4 Bold — a stale caption, not a design change; flagged here rather than silently left for the owner to notice.
3. **The Politics photo (Santa Fe dusk).** "${politicsHue?.subject ?? 'unknown'}" — no objection was raised in round 1; please confirm (WINDOWS.md entry 2).
4. **What D-GAP-A looks like in practice.** Under \`font-display: optional\`, a slow first visit keeps the fallback face for that page view rather than swapping mid-render (no more font-swap CLS). With Source Serif 4's \`opsz\` axis pinned to shrink the subsets, display-size headlines render at the font's default optical size rather than a size-matched one — see \`design/evidence/font-subset.md\` for the byte-size trade and the accepted optical-size trade-off (also flagged at the next phase transition, below).
5. **Planner decisions to accept or overturn.** Resolutions 8–10 (external-link new-tab cue; the ≥1024px reading column plus right rail; home feed lead + 6 cards then Load More pages of 6); the changelog adopting the article's right-rail layout; the rendered Key Details list (no more raw markdown asterisks); the category lead's typographic fallback when no usable image exists.
6. **New Spanish strings to read.** \`rail-heading\`, \`load-more-button\`, \`load-more-status\`, \`new-tab-cue\` (design/fixtures/spanish-stress.json).
7. **Any other open WINDOWS.md entries.** At packet-generation time: entry 1 (real-Safari spot-check), entry 2 (Politics photo), entry 13 (the italic face outside D-GAP-A's two preloads essentially always renders in its fallback), entry 16 (the category lead image needs a real-network visual check — tests block third-party requests, so this was never automatable). Review \`.planning/WINDOWS.md\` directly before signing.`;

  const deviations = `## Deviations to raise at the next phase transition

- **D-10** drops PRD §5.1 pull quotes in favour of a standfirst deck (see \`01-CONTEXT.md\` D-10 for the full rationale — machine-generated summary text at display size would misrepresent it as editorial voice).
- **C-01** supersedes the "Chihuahuan desert palette" wording in \`REQUIREMENTS.md\` DSGN-04 and in \`ROADMAP.md\` Phase 1 criterion 2. Recommend rewording both — the owner's call, not edited mid-phase.
- **D-GAP-A**: PRD §6.5 amended to \`font-display: optional\`. The amendment is committed (\`docs/PRD.md\` tracked since 2026-09-17).
- **D-GAP-B**: DSGN-03 ("Display type is Instrument Serif") and ROADMAP criterion 5's "(display)" now describe the wordmark only; headlines are Source Serif 4 Bold; D-09 and PRD §5.2 amended; PRD §6.8's share-card headline face is to be re-decided when share cards are built.
- **D-05**: the mockups directory has eight entries (\`feed/\`).
- **DSGN-06 / criterion 5 wording** "the article grid is pure HTML with zero JavaScript": the server-rendered grid stays script-free, and the PRD §5.5 load-more island appends pre-built static cards. Recommend rewording DSGN-06 to say exactly that.`;

  const plannerResolutions = `## Planner resolutions of open items

The following ten items from \`01-CONTEXT.md\`'s "Open Within This Phase" list, and the round-1 gap-closure plan, are repeated here verbatim for the owner to accept or overturn:

1. Link and focus colour: links are ink with a visible underline; there is no link hue. The focus ring is \`--focus-ring\` (ink-family, 3 px solid, 2 px offset) on paper, and switches to \`--focus-ring-on-block\` (= \`--block-ink\`) inside colour blocks. The contrast gate checks the ring against both papers and all eight blocks, and the keyboard walk checks it against the real rendered background.
2. Brand colour: 915 TLDR owns no ninth hue. Its signature is the eight-segment spectrum rule under the wordmark.
3. Masthead and nav: the Instrument Serif wordmark — its only use, at weight 400 with font synthesis off — with a dateline and the spectrum rule closing the masthead (no ink rule). The nav wraps to 2, then 4, then 8 columns, with no scroll container and no disclosure JavaScript.
4. Category masthead: a full-bleed \`--cat-<slug>-block\` panel with the display-size name, description and public story count in \`--block-ink\`.
5. Subsetting toolchain: \`subset-font\` with a Playwright glyph crawl plus a fixed Spanish baseline set; \`@capsizecss/core\` + \`@capsizecss/metrics\` for fallback faces. glyphhanger and fontaine are not used (reasons in 01-01). Source Serif 4 ships with \`opsz\` pinned to its default (Roman keeps wght 400–700; Italic is pinned to 400); Instrument Serif Italic is retired.
6. Images: real source URLs, hotlinked, in fixed 3:2 frames with explicit dimensions. Junk images render as imageless. Automated tests block third-party requests.
7. Theme toggle and Load more: one inline head script, identical on all five pages. It is chrome, not grid: every grid's server-rendered HTML is script-free and identical with JavaScript disabled; the toggle and the Load more button are hidden without JavaScript; Load more appends pre-built cards from same-origin static JSON with DOM APIs only.
8. External links: \`target="_blank"\`, \`rel="noopener"\`, a decorative icon and visually hidden "(opens in a new tab)".
9. Text pages at ≥1024px: a reading column capped at ~70ch plus a 20rem right rail (article and changelog); contact is a centred 44rem column; at 320 and 768px these pages run full width.
10. Home feed: lead plus 6 cards, then Load more pages of 6.`;

  const flaggedAssumptions = `## Flagged assumptions

- Probe rows left unresolved because they were unclassified: DSGN-01, DSGN-02, DSGN-03, DSGN-05, DSGN-06, PERF-07. The generic edge probe could not classify them; their requirements are covered by explicit truths across 01-02 through 01-22, but no edge-probe category was resolved for them.
- A-01: WebKit (Playwright) on Linux tracks trunk and is not Safari. The Georgia fallback is not exercised on Linux. A real macOS/iOS pass remains open.
- A-02: 200% zoom is emulated as 640 CSS px at devicePixelRatio 2, backed by the owner's manual Ctrl+ check.
- A-03: D-02's fixed chroma is implemented as a shared requested chroma, clamped per hue to sRGB (reported in palette.md).
- A-04: yellow and orange block stops may read as brown (C-01). This is the owner's call, flagged in palette.md.
- A-05: D-15's real Spanish was translated in-session with no paid API. The owner reviews its quality.
- A-06: images are hotlinked; tests block third-party requests.
- A-07: planner-chosen thresholds — OKLab distance ≥ 0.05; "zero layout shift" means below 0.005, i.e. reported CLS rounds to 0.00; synthetic width window 1.25–1.30 (wider only for short labels); woff2 at most 150 KB per file, with per-file ceilings of 60 KB (roman) / 30 KB (italic) applied during the D-GAP-A shrink.
- A-08: research corrections — WebKit has no layout-shift API, so the geometry instrument is used; the observer is installed with addInitScript; glyphhanger was replaced.
- A-09: the home feed starts with 6 initial cards, then Load More pages of 6.
- A-10: without JavaScript the home page shows the lead and 6 cards; older stories stay reachable through the category pages; Phase 4 should add a static pagination link as the no-JS fallback.
- A-11: optional fonts mean slow first visits keep the fallback face for that view.
- A-12: the Business subject target arc (150–225°) was a planner choice.
- A-13: the owner's "768px" changelog observation versus what 01-20 measured — 01-20 reproduced the dispatch squeeze as real, but confined to ≥80em (1280/1920px), not 768px as the owner's screenshot label suggested (see 01-20-SUMMARY.md).
- A-14: contact page centring at 1280/1920px in both themes was a planner/orchestrator visual call (01-20), not separately re-confirmed by the owner since round 1 — flagged for round-2 confirmation.`;

  const md = `# Phase 01 Approval Packet — Design Sketch & Editorial Identity

Generated: ${generatedAt}

${statusLine}

---

${ownerReviewFocus}

## Runner output

\`\`\`
${runnerOutput.trim()}
\`\`\`

## Criteria and evidence

${criteriaTable}

## Environment

- **Node:** ${nodeVersion}
- **pnpm:** ${pnpmVersion}
- **@playwright/test:** ${playwrightVersion}
- **Chromium:** ${chromiumVersion}
- **WebKit (Playwright):** ${webkitEngineVersion} (from font-cls.md; \`design/.webkit-mode.json\` records ${webkitMode.webkitVersion ?? 'unknown'}); mode: \`${webkitMode.mode ?? 'unknown'}\`; image: \`${webkitMode.image ?? 'unknown'}\`; image digest: \`${webkitMode.imageDigest ?? 'unknown'}\`
- **Fallback faces exercised per engine (from font-cls.md):** ${fallbackFaces.length ? fallbackFaces.join(', ') : 'unknown'}

WebKit (Playwright) is not Safari. A pass on real macOS or iOS Safari, including the Georgia fallback, remains open.

## Palette provenance

${buildPaletteProvenanceTable(hueSources, paletteMd)}

${deviations}

${plannerResolutions}

${flaggedAssumptions}

## File fingerprints

Recomputed by \`pnpm run verify:approval\`. Any change to a listed file after this packet is generated invalidates the approval — re-run \`verify:phase-1\`, regenerate this packet, and re-sign.

| File | sha256 |
|---|---|
${fingerprintRows}

## Owner review checklist

- [ ] Start \`pnpm run serve:mockups\` in your own pane and open http://127.0.0.1:4319/mockups/index.html
- [ ] Review all five pages in light and dark at 320, 768, 1280 and 1920px
- [ ] Review each page at real 200% browser zoom
- [ ] Keyboard-walk every page in both themes (Tab, Shift+Tab, Enter, Space), including pressing Load more until it disappears and confirming focus and footer reachability
- [ ] Open an external link and confirm it opens in a new tab
- [ ] Check each round-1 item 1–10 in the closure table
- [ ] Review the Business block and swatches against C-01
- [ ] Read the new Spanish strings
- [ ] Accept or overturn each planner resolution and decision above

## Owner sign-off

To approve, add one line directly below this paragraph, yourself, giving your name
and the date after the \`Approved-by:\` label (label, a space, your name, an em dash,
then the date as \`YYYY-MM-DD\`) — for example: \`Approved-by: Jaime Aleman — 2026-09-17\`.

Then leave this section otherwise empty. This generator never writes that line.

## Revision requests

(none yet — round 2)

## Revision history

${revisionHistoryBody}
`;

  writeFileSync(path.resolve(args.packet), md, 'utf8');
  console.log(`Wrote ${args.packet}`);
  console.log(statusLine);
}

main();
