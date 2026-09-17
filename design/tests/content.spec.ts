import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { openPage, pagesUnderTest, THEMES } from './support/harness.ts';

/**
 * Content-integrity checks (D-01, D-06, D-10, D-11, D-12, DSGN-04, DSGN-07):
 * probe-derived edge cases and decision-level content rules turned into
 * executable checks against the real mockups and the real fixtures they
 * were built from (design/fixtures/changelog.json,
 * design/fixtures/stress-set.json) — never against a synthetic stand-in.
 */

const CHANGELOG_PATH = path.resolve('design/fixtures/changelog.json');
const STRESS_SET_PATH = path.resolve('design/fixtures/stress-set.json');

const CANONICAL_CATEGORY_ORDER = ['crime', 'politics', 'sports', 'business', 'education', 'community', 'health', 'weather'];

interface ChangelogEntry {
  date: string;
  title: string;
  items: string[];
}

function readChangelogEntries(): ChangelogEntry[] {
  const raw = JSON.parse(readFileSync(CHANGELOG_PATH, 'utf8'));
  return raw.entries;
}

/**
 * design/fixtures/stress-set.json's `cases` object is a hand-authored mix
 * of shapes — a bare row, a list of rows, `{ chosen, rejected }` pairs, a
 * `{ rows, chosen }` pair, and non-row metadata (`categories`,
 * `corpus-stats`) with no `uuid` field at all. Rather than hand-enumerate
 * every shape, this walks the whole structure recursively and collects
 * every object that carries a `uuid` — the same "don't hand-roll a list of
 * special cases" approach already used by check-contrast.mjs's coverage
 * rule (01-07/01-05 precedent).
 */
function readFixtureRowsByUuid(): Map<string, { status: unknown; is_duplicate: unknown }> {
  const raw = JSON.parse(readFileSync(STRESS_SET_PATH, 'utf8'));
  const byUuid = new Map<string, { status: unknown; is_duplicate: unknown }>();

  // The same uuid recurs under different shapes across `cases` — a full
  // article row (has `status`/`is_duplicate`) in `feed`/`category-feed`/a
  // named case, but also a bare `{ uuid, url, headStatus, reason }` image
  // *candidate* record inside `usable-image`/`category-lead`'s `rejected`
  // arrays, which was never a real row and carries no `status` at all. Only
  // record an entry once we find the real row shape (`'status' in obj`), so
  // an earlier-encountered candidate record can't shadow the real one.
  function walk(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (typeof obj.uuid === 'string' && 'status' in obj && !byUuid.has(obj.uuid)) {
        byUuid.set(obj.uuid, { status: obj.status, is_duplicate: obj.is_duplicate });
      }
      for (const v of Object.values(obj)) walk(v);
    }
  }

  walk(raw.cases);
  return byUuid;
}

/**
 * Same real-row-shape walk as readFixtureRowsByUuid, but returns the whole
 * row (so its `summary` field is available) instead of just status/
 * is_duplicate. Returns null when no real row (has `status`) carries the
 * uuid.
 */
function readFixtureSummaryRowByUuid(uuid: string): Record<string, unknown> | null {
  const raw = JSON.parse(readFileSync(STRESS_SET_PATH, 'utf8'));
  function walk(value: unknown): Record<string, unknown> | null {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item);
        if (found) return found;
      }
      return null;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (obj.uuid === uuid && 'status' in obj) return obj;
      for (const v of Object.values(obj)) {
        const found = walk(v);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(raw.cases);
}

/** Extracts a fixture summary's "• " bullet lines, prefix stripped, trimmed. */
function fixtureBulletLines(summary: string): string[] {
  return summary
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.startsWith('• '))
    .map((line) => line.slice('• '.length).trim());
}

for (const name of pagesUnderTest()) {
  test.describe(`content: ${name}`, () => {
    test(`nav category order is canonical, and the eight stripe colours are pairwise distinct per theme @c1`, async ({
      page,
    }) => {
      for (const theme of THEMES) {
        await openPage(page, name as any, { theme });

        const order = await page.locator('[data-nav-category]').evaluateAll((els) =>
          els.map((el) => el.getAttribute('data-category'))
        );
        expect(order, `${name} (${theme}) nav order`).toEqual(CANONICAL_CATEGORY_ORDER);

        const colours = await page
          .locator('nav[aria-label="Sections"] [data-stripe]')
          .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
        expect(colours.length).toBe(8);
        expect(new Set(colours).size, `${name} (${theme}) nav stripe colours: ${colours.join(', ')}`).toBe(8);
      }
    });

    test(`every categorised card has a non-empty category name; --cat-none cards have neither; every summary is non-empty @c1`, async ({
      page,
    }) => {
      await openPage(page, name as any);

      const noneStripeColor = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--cat-none').trim()
      );

      const offenders = await page.evaluate((noneColorRaw) => {
        const bad: string[] = [];
        for (const card of Array.from(document.querySelectorAll('[data-card]'))) {
          const category = card.getAttribute('data-category');
          const nameEl = card.querySelector('[data-category-name]');
          if (category !== 'none') {
            if (!nameEl || !(nameEl.textContent || '').trim()) {
              bad.push(`card ${card.getAttribute('data-uuid')} (${category}) missing non-empty [data-category-name]`);
            }
          } else {
            if (nameEl) {
              bad.push(`card ${card.getAttribute('data-uuid')} (none) unexpectedly has [data-category-name]`);
            }
            const stripe = card.querySelector('[data-stripe]');
            if (stripe) {
              const stripeColor = getComputedStyle(stripe).backgroundColor;
              // Resolve noneColorRaw (a var() or literal) the same way the
              // browser resolves the stripe's own background, by writing it
              // to a throwaway element and reading its computed style back.
              const probe = document.createElement('span');
              probe.style.backgroundColor = noneColorRaw;
              document.body.appendChild(probe);
              const expected = getComputedStyle(probe).backgroundColor;
              probe.remove();
              if (stripeColor !== expected) {
                bad.push(
                  `card ${card.getAttribute('data-uuid')} (none) stripe ${stripeColor} !== --cat-none ${expected}`
                );
              }
            }
          }
        }
        for (const summary of Array.from(document.querySelectorAll('[data-summary]'))) {
          if (!(summary.textContent || '').trim()) {
            bad.push('a [data-summary] element has empty text');
          }
        }
        return bad;
      }, noneStripeColor);

      expect(offenders, offenders.join(' | ')).toEqual([]);
    });

    test(`[data-block] appears only on category.html and article.html, exactly once each, coloured --block-ink @c1`, async ({
      page,
    }) => {
      await openPage(page, name as any);
      const count = await page.locator('[data-block]').count();

      if (name === 'category' || name === 'article') {
        expect(count, `${name} should have exactly one [data-block]`).toBe(1);
        const matches = await page.evaluate(() => {
          const block = document.querySelector('[data-block]')!;
          const blockInk = getComputedStyle(document.documentElement).getPropertyValue('--block-ink').trim();
          const probe = document.createElement('span');
          probe.style.color = blockInk;
          document.body.appendChild(probe);
          const expected = getComputedStyle(probe).color;
          probe.remove();
          return getComputedStyle(block).color === expected;
        });
        expect(matches, `${name}'s [data-block] color does not compute to --block-ink`).toBe(true);
      } else {
        expect(count, `${name} should have no [data-block]`).toBe(0);
      }
    });

    test(`every data-uuid belongs to a processed, non-duplicate fixture row @c1`, async ({ page }) => {
      await openPage(page, name as any);
      const uuids = await page.locator('[data-uuid]').evaluateAll((els) => els.map((el) => el.getAttribute('data-uuid')));
      expect(uuids.length).toBeGreaterThan(0);

      const rowsByUuid = readFixtureRowsByUuid();
      const offenders: string[] = [];
      for (const uuid of uuids) {
        const row = uuid ? rowsByUuid.get(uuid) : undefined;
        if (!row) {
          offenders.push(`${uuid}: not found in any fixture case`);
          continue;
        }
        if (row.status !== 'processed') {
          offenders.push(`${uuid}: status is "${row.status}", not "processed"`);
        }
        if (row.is_duplicate) {
          offenders.push(`${uuid}: is_duplicate is truthy (${row.is_duplicate})`);
        }
      }
      expect(offenders, offenders.join(' | ')).toEqual([]);
    });

    test(`external links open in a new tab with rel=noopener, an icon and an accessible "(opens in a new tab)" cue; same-origin links carry neither; every img has width/height/alt; the junk-image stress card has no img @c1`, async ({
      page,
    }) => {
      await openPage(page, name as any);

      const linkResults = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]')).map((a, index) => {
          const href = a.getAttribute('href') || '';
          const resolved = new URL(href, window.location.href);
          return {
            index,
            href,
            external: resolved.origin !== window.location.origin,
            scheme: resolved.protocol,
            rel: a.getAttribute('rel') || '',
            target: a.getAttribute('target'),
            cueCount: a.querySelectorAll('[data-new-tab-cue]').length,
            iconCount: a.querySelectorAll('[data-new-tab-icon][aria-hidden="true"]').length,
          };
        });
      });

      const offenders: string[] = [];
      for (const link of linkResults) {
        if (link.external) {
          if (link.target !== '_blank') {
            offenders.push(`external link ${link.href} missing target="_blank" (target="${link.target}")`);
          }
          if (!link.rel.split(/\s+/).includes('noopener')) {
            offenders.push(`external link ${link.href} missing rel=noopener (rel="${link.rel}")`);
          }
          if (link.scheme !== 'https:') {
            offenders.push(`external link ${link.href} is not https (${link.scheme})`);
          }
          if (link.cueCount !== 1) {
            offenders.push(`external link ${link.href} has ${link.cueCount} [data-new-tab-cue] element(s) (expected 1)`);
          }
          if (link.iconCount !== 1) {
            offenders.push(
              `external link ${link.href} has ${link.iconCount} [data-new-tab-icon][aria-hidden="true"] element(s) (expected 1)`
            );
          }
        } else {
          if (link.target !== null) {
            offenders.push(`same-origin link ${link.href} unexpectedly has target="${link.target}"`);
          }
          if (link.cueCount !== 0) {
            offenders.push(`same-origin link ${link.href} unexpectedly carries a new-tab cue`);
          }
        }
      }
      expect(offenders, offenders.join(' | ')).toEqual([]);

      for (const link of linkResults) {
        if (!link.external) continue;
        await expect(
          page.locator('a[href]').nth(link.index),
          `external link ${link.href} (index ${link.index}) accessible name must end with "(opens in a new tab)"`
        ).toHaveAccessibleName(/\(opens in a new tab\)$/);
      }

      const imageOffenders = await page.evaluate(() => {
        const bad: string[] = [];
        for (const img of Array.from(document.querySelectorAll('img'))) {
          if (!img.getAttribute('width') || !img.getAttribute('height') || img.getAttribute('alt') === null) {
            bad.push(`img ${img.getAttribute('src')} missing width/height/alt`);
          }
        }
        const junkCard = document.querySelector('[data-stress="junk-image"]');
        if (junkCard && junkCard.querySelector('img')) {
          bad.push('junk-image stress card unexpectedly contains an img');
        }
        return bad;
      });

      expect(imageOffenders, imageOffenders.join(' | ')).toEqual([]);
    });

    test(`summaries render markdown as HTML: no bold marker in rendered text; Key Details are a strong label plus a list @c1`, async ({
      page,
    }) => {
      await openPage(page, name as any);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText.includes('**'), 'rendered body text must not contain a literal "**" marker').toBe(false);

      const keyDetailsResults = await page.evaluate(() => {
        const results: Array<{ uuid: string | null; lang: string | null; ok: boolean; reason: string; items: string[] }> = [];
        for (const list of Array.from(document.querySelectorAll('[data-key-details]'))) {
          let ok = true;
          let reason = '';
          const prev = list.previousElementSibling;
          if (!prev || prev.tagName !== 'P') {
            ok = false;
            reason = 'previous sibling is not a <p>';
          } else {
            const children = Array.from(prev.children);
            const soleStrong = children.length === 1 && children[0].tagName === 'STRONG';
            const label = soleStrong ? (children[0].textContent || '').trim() : '';
            if (!soleStrong || label !== 'Key Details:') {
              ok = false;
              reason = `preceding <p> is not a single <strong>Key Details:</strong> (got: ${prev.outerHTML})`;
            }
          }
          const items = Array.from(list.querySelectorAll('li')).map((li) => li.textContent || '');
          for (const text of items) {
            if (!text.trim()) {
              ok = false;
              reason += (reason ? '; ' : '') + 'an li has empty text';
            }
            if (text.trim().startsWith('•')) {
              ok = false;
              reason += (reason ? '; ' : '') + 'an li text starts with the bullet character';
            }
          }
          const container = list.closest('[data-uuid]');
          results.push({
            uuid: container ? container.getAttribute('data-uuid') : null,
            lang: container ? container.getAttribute('lang') : null,
            ok,
            reason,
            items,
          });
        }
        return results;
      });

      const offenders = keyDetailsResults.filter((r) => !r.ok).map((r) => `${r.uuid ?? '(no uuid)'}: ${r.reason}`);
      expect(offenders, offenders.join(' | ')).toEqual([]);

      const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();
      const mismatches: string[] = [];
      for (const result of keyDetailsResults) {
        if (!result.uuid || result.lang === 'es') continue;
        const row = readFixtureSummaryRowByUuid(result.uuid);
        if (!row || typeof row.summary !== 'string') continue;
        const expectedItems = fixtureBulletLines(row.summary).map(normalise);
        const actualItems = result.items.map(normalise);
        if (JSON.stringify(actualItems) !== JSON.stringify(expectedItems)) {
          mismatches.push(
            `${result.uuid}: rendered [${actualItems.join(' / ')}] !== fixture [${expectedItems.join(' / ')}]`
          );
        }
      }
      expect(mismatches, mismatches.join(' | ')).toEqual([]);
    });
  });
}

// ---- index and category: grid order + no per-category sections ----

for (const name of ['index', 'category']) {
  test(`${name}: [data-grid] time[datetime] values are non-increasing @c1 @c5`, async ({ page }) => {
    await openPage(page, name as any);
    const times = await page
      .locator('[data-grid] [data-card] time[datetime]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('datetime')));

    expect(times.length).toBeGreaterThan(0);
    for (let i = 1; i < times.length; i++) {
      const prev = new Date(times[i - 1]!).getTime();
      const curr = new Date(times[i]!).getTime();
      expect(curr, `${name} grid order broken at index ${i}: ${times[i - 1]} then ${times[i]}`).toBeLessThanOrEqual(
        prev
      );
    }
  });
}

test('index: no per-category section or heading outside a card (D-12) @c1', async ({ page }) => {
  await openPage(page, 'index');
  const categoryNames = CANONICAL_CATEGORY_ORDER.map((slug) => slug); // slugs; names checked via text below

  const offenders = await page.evaluate((slugs) => {
    const main = document.querySelector('main')!;
    const bad: string[] = [];
    const headings = Array.from(main.querySelectorAll('h2, h3'));
    for (const h of headings) {
      if (h.closest('[data-card]') || h.closest('[data-lead]')) continue;
      const text = (h.textContent || '').trim().toLowerCase();
      if (slugs.includes(text)) {
        bad.push(`heading "${h.textContent}" (${h.tagName}) outside any card matches a category name`);
      }
    }
    return bad;
  }, categoryNames);

  expect(offenders, offenders.join(' | ')).toEqual([]);
});

// ---- changelog: dispatch order, fidelity, punctuation-free items ----

test.describe('content: changelog dispatches', () => {
  test('dispatch count, titles, dates, and item text match changelog.json exactly, in array order @c1', async ({
    page,
  }) => {
    await openPage(page, 'changelog');
    const entries = readChangelogEntries();

    const dispatchCount = await page.locator('[data-dispatch]').count();
    expect(dispatchCount, 'dispatch count must equal changelog.json entry count').toBe(entries.length);

    for (let i = 0; i < entries.length; i++) {
      const dispatch = page.locator('[data-dispatch]').nth(i);
      const entry = entries[i];

      await expect(dispatch.locator('h2'), `dispatch ${i} title`).toHaveText(entry.title);
      await expect(dispatch.locator('time[data-dispatch-date]'), `dispatch ${i} datetime`).toHaveAttribute(
        'datetime',
        entry.date
      );

      const itemTexts = await dispatch.locator('[data-item]').evaluateAll((els) =>
        els.map((el) => (el.textContent || '').normalize('NFC'))
      );
      const expectedTexts = entry.items.map((s) => s.normalize('NFC'));
      expect(itemTexts, `dispatch ${i} (${entry.title}) item text`).toEqual(expectedTexts);
    }
  });

  test('no ul/ol/li inside main; no empty <p> inside a dispatch @c1', async ({ page }) => {
    await openPage(page, 'changelog');

    const listCount = await page.locator('main ul, main ol, main li').count();
    expect(listCount, 'main must contain no ul/ol/li').toBe(0);

    const emptyParagraphs = await page.evaluate(() => {
      let count = 0;
      for (const dispatch of Array.from(document.querySelectorAll('[data-dispatch]'))) {
        for (const p of Array.from(dispatch.querySelectorAll('p'))) {
          if (!(p.textContent || '').trim()) count++;
        }
      }
      return count;
    });
    expect(emptyParagraphs, 'no <p> inside a dispatch may be empty').toBe(0);
  });

  test('the single-item entry renders as exactly one <p> holding exactly one [data-item] @c1', async ({ page }) => {
    await openPage(page, 'changelog');
    const entries = readChangelogEntries();
    const singleItemIndex = entries.findIndex((e) => e.items.length === 1);
    expect(singleItemIndex, 'fixture must contain a single-item entry to exercise this check').toBeGreaterThanOrEqual(
      0
    );

    const dispatch = page.locator('[data-dispatch]').nth(singleItemIndex);
    await expect(dispatch.locator('p')).toHaveCount(1);
    await expect(dispatch.locator('p [data-item]')).toHaveCount(1);
  });

  test('dispatches sharing a datetime are distinct elements, each with its own <time> @c1', async ({ page }) => {
    await openPage(page, 'changelog');
    const entries = readChangelogEntries();

    const byDate = new Map<string, number[]>();
    entries.forEach((e, i) => {
      const list = byDate.get(e.date) ?? [];
      list.push(i);
      byDate.set(e.date, list);
    });

    const tiedDates = Array.from(byDate.entries()).filter(([, idxs]) => idxs.length > 1);
    expect(tiedDates.length, 'fixture must contain at least one shared-date tie to exercise this check').toBeGreaterThan(
      0
    );

    for (const [date, idxs] of tiedDates) {
      const times = await page.locator(`[data-dispatch] time[datetime="${date}"]`).count();
      expect(times, `date ${date} should have ${idxs.length} distinct <time> elements`).toBe(idxs.length);
    }
  });
});

// ---- article: no pull quotes, standfirst/body reproduce the summary, disclosure, tags ----

test.describe('content: article', () => {
  function readArticleFixtureRow(uuid: string): Record<string, unknown> {
    const raw = JSON.parse(readFileSync(STRESS_SET_PATH, 'utf8'));
    // Same shadowing hazard as readFixtureRowsByUuid above: only accept the
    // real row shape ('status' in obj), never a bare image-candidate record
    // from a `rejected` array that happens to share the uuid.
    function walk(value: unknown): Record<string, unknown> | null {
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = walk(item);
          if (found) return found;
        }
        return null;
      }
      if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if (obj.uuid === uuid && 'status' in obj) return obj;
        for (const v of Object.values(obj)) {
          const found = walk(v);
          if (found) return found;
        }
      }
      return null;
    }
    const found = walk(raw.cases);
    if (!found) throw new Error(`readArticleFixtureRow: uuid ${uuid} not found in stress-set.json`);
    return found;
  }

  test('no blockquote/q, and no element with "pull" in its class or data attribute name @c1', async ({ page }) => {
    await openPage(page, 'article');
    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      if (document.querySelector('blockquote') || document.querySelector('q')) {
        bad.push('a blockquote or q element exists');
      }
      for (const el of Array.from(document.querySelectorAll('*'))) {
        if (el.className && typeof el.className === 'string' && /pull/i.test(el.className)) {
          bad.push(`element ${el.tagName} has "pull" in its class: ${el.className}`);
        }
        for (const attr of Array.from(el.attributes)) {
          if (/pull/i.test(attr.name)) {
            bad.push(`element ${el.tagName} has "pull" in an attribute name: ${attr.name}`);
          }
        }
      }
      return bad;
    });
    expect(offenders, offenders.join(' | ')).toEqual([]);
  });

  test('standfirst + body reproduces the fixture summary exactly once (D-10) @c1', async ({ page }) => {
    await openPage(page, 'article');
    const uuid = await page.locator('main > article[data-uuid]').first().getAttribute('data-uuid');
    expect(uuid).toBeTruthy();
    const row = readArticleFixtureRow(uuid!);
    const summary = (row.summary as string).split('\n\n')[0]; // strip any "**Key Details:**" block, mirroring 01-07's own extraction

    const normalise = (s: string) => s.replace(/\s+/g, ' ').trim();

    const standfirst = normalise(await page.locator('[data-standfirst]').innerText());
    expect(/[.?!]$/.test(standfirst), `standfirst "${standfirst}" must end in . ? or !`).toBe(true);
    expect(normalise(summary).startsWith(standfirst), 'standfirst must be a prefix of the summary').toBe(true);

    const bodyParagraphs = await page.locator('[data-article-body] p').evaluateAll((els) =>
      els.map((el) => (el.textContent || '').trim())
    );
    const reconstructed = normalise([standfirst, ...bodyParagraphs].join(' '));
    expect(reconstructed).toBe(normalise(summary));
  });

  test('[data-ai-disclosure] links to the fixture row\'s own url @c1', async ({ page }) => {
    await openPage(page, 'article');
    const uuid = await page.locator('main > article[data-uuid]').first().getAttribute('data-uuid');
    const row = readArticleFixtureRow(uuid!);

    const href = await page.locator('[data-ai-disclosure] a').first().getAttribute('href');
    expect(href).toBe(row.url);
  });

  test('[data-tags] holds five links; removing it leaves no "Tags" heading and no empty section @c1', async ({
    page,
  }) => {
    await openPage(page, 'article');
    await expect(page.locator('[data-tags] a')).toHaveCount(5);

    const result = await page.evaluate(() => {
      document.querySelector('[data-tags]')?.remove();
      const headings = Array.from(document.querySelectorAll('main h1, main h2, main h3, main h4'));
      const hasTagsHeading = headings.some((h) => (h.textContent || '').trim() === 'Tags');
      const emptySections = Array.from(document.querySelectorAll('main section')).filter(
        (s) => !(s.textContent || '').trim()
      );
      return { hasTagsHeading, emptySectionCount: emptySections.length };
    });

    expect(result.hasTagsHeading, 'a "Tags" heading remains after removing [data-tags]').toBe(false);
    expect(result.emptySectionCount, 'an empty <section> remains after removing [data-tags]').toBe(0);
  });
});

// ---- contact: labelled fields, no form action ----

test.describe('content: contact', () => {
  test('every input/textarea has a label[for]; the form has no action attribute @c1', async ({ page }) => {
    await openPage(page, 'contact');

    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      for (const control of Array.from(document.querySelectorAll('input, textarea'))) {
        const id = control.getAttribute('id');
        if (!id || !document.querySelector(`label[for="${id}"]`)) {
          bad.push(`${control.tagName}#${id ?? '(no id)'} has no matching label[for]`);
        }
      }
      return bad;
    });
    expect(offenders, offenders.join(' | ')).toEqual([]);

    const formAction = await page.locator('form').first().getAttribute('action');
    expect(formAction, 'form must have no action attribute').toBeNull();
  });
});
