// 06-09 Task 1: proves the full `/es` article route against REAL built output — tier-fact parity
// with the English route, and (for the known 06-08 pilot rows) that a clean translation renders
// as Spanish and a held/missing one renders the honest D-05 fallback. Follows
// `tests/unit/article-markup.test.mjs`'s "assert on rendered output, skip if unbuilt" convention
// and `tests/helpers/archive-sample.mjs`'s "read dist/archive-plan.json, don't assume hot"
// discipline via the new `tests/helpers/built-page.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readTierFacts } from '../../src/lib/archive/tier-facts.ts';
import { localizedPath } from '../../src/lib/article-url.ts';
import { t } from '../../src/lib/i18n/dictionary.ts';
import { readBuiltPage } from '../helpers/built-page.mjs';
import { decodeEntities } from '../helpers/html-text.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_BUILT = existsSync(DIST_CLIENT);
const SKIP_REASON = 'dist/client not found — run `pnpm build` first (pnpm test:unit does this automatically)';

// 06-08-SUMMARY.md / docs/phase-06/translation-backfill-dry-run.md "Pilot" section (read-only
// reference in the pipeline repo) — 30 real production `article_translations` rows, origin
// `backfill-pilot`, written 2026-10-03/04. Listed here rather than re-derived so this test
// exercises REAL production data, not a fixture.
const PILOT_CLEAN_UUIDS = [
  'af043fec-a731-4421-ade5-526e13b99746',
  '59311020-540a-441b-8c26-bcad476fd2a2',
  '112879e2-5077-4650-a740-fea5cf653850',
  '00244ecd-2c99-4d6c-9263-cffe7a5d0d50',
  'bd5d26a7-51ce-4e53-b0e3-03f38caa01f6',
  '9737df8d-6f3b-4d02-9d71-c057a4b3f7ca',
  '400dedbf-b318-43c5-bbbd-9162972bc086',
  '7156e710-a4ca-40f6-816b-a684422eda9a',
  '5b2a59fe-56e6-4254-a33e-718b24684bab',
  '66a377ab-a5e7-45f9-adb1-94937a9ba714',
  '1bbad97f-cb57-4f1e-b141-1849e4db4e3c',
  'e2b7515d-16a9-4833-afa1-87eb49f6f066',
  '4e7a5764-b1a3-429f-8fde-5830f84e174a',
];
const PILOT_HELD_UUIDS = [
  '8dbbb362-7791-4223-850f-c7f472945f02',
  'becd829c-c525-4e09-b694-6ab830ba4e79',
  'a2875fab-4cf2-4852-b8e0-db81898107a7',
  'b2af749f-39e3-41a1-88e5-5d04b4c7f83a',
  '641592ea-50c3-482a-80b2-3faab9f6e5d5',
  'b05aeb72-2ddc-468f-a0c0-1934aaccc11e',
  'ff9fea3f-8e4c-4b42-827c-8ac63621adf8',
  '59c0caa5-2f66-4aa4-8b38-f80480f98c89',
  'aeefbcf3-4d2b-477b-aad5-fb20ff2c6e3d',
  'bc3e203b-dd06-41d4-ad3e-451c5ecf4988',
  'b81cfe6d-2aae-477d-95c2-49608ff3e8f5',
  'c2ec1176-3c8b-4229-810c-0d72e3eb8a56',
  '3e491b3e-5577-40ad-9afb-b3d05def3d0c',
  'b17e94f0-e8dd-4abd-973d-10ad8f24331d',
  '2442206b-561c-4e2c-81de-15667c9c8337',
  '3fa6afbb-4c68-43ac-ac61-796262745ec8',
  'f5c80ed4-77be-469a-b1d1-257678a71240',
];

function extractArticleRegion(html) {
  const match = html.match(/<article data-uuid="[^"]+" data-category="[^"]+" data-reading-column>([\s\S]*?)<\/article>/);
  assert.ok(match, 'expected an <article data-reading-column> block');
  return match[1];
}

test(
  'es-article-pages: every public English article has exactly one /es tier fact, path-prefixed correctly',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const facts = readTierFacts();

    assert.equal(
      facts.articlesEs.length,
      facts.articles.length,
      'expected one /es tier fact per public English article'
    );

    const englishPathByUuid = new Map(facts.articles.map((f) => [f.uuid, f.path]));
    for (const esFact of facts.articlesEs) {
      const englishPath = englishPathByUuid.get(esFact.uuid);
      assert.ok(englishPath, `expected an English fact for uuid ${esFact.uuid}`);
      assert.equal(
        esFact.path,
        localizedPath(englishPath, 'es'),
        `expected ${esFact.uuid}'s /es path to be the localized form of its English path`
      );
      assert.equal(esFact.publishedAt, facts.articles.find((f) => f.uuid === esFact.uuid).publishedAt);
    }
  }
);

test(
  'es-article-pages: a clean pilot translation renders as Spanish, paired, no fallback note',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const facts = readTierFacts();
    const translatedFact = facts.articlesEs.find((f) => PILOT_CLEAN_UUIDS.includes(f.uuid) && f.translated);
    assert.ok(
      translatedFact,
      'expected at least one 06-08 pilot "clean" uuid to have translated:true in the built tier facts'
    );

    const html = readBuiltPage(translatedFact.path);
    assert.ok(html, `expected a built page at ${translatedFact.path} (static or archived)`);

    assert.match(html, /<html lang="es">/);
    assert.ok(!html.includes(t('fallbackNote', 'es')), 'expected no D-05 fallback note on a translated page');
    assert.ok(!html.includes('<meta name="robots" content="noindex">'), 'expected a translated page to be indexable');

    const articleHtml = extractArticleRegion(html);
    assert.match(articleHtml, /<p data-ai-disclosure>/);
    assert.match(articleHtml, /<p data-lang-link><a href="[^"]+" hreflang="en" lang="en">/);

    // Paired hreflang: en, es, x-default all present (Base.astro's alternateLinks 'paired' mode).
    assert.match(html, /<link rel="alternate" hreflang="en" href="[^"]+"/);
    assert.match(html, /<link rel="alternate" hreflang="es" href="[^"]+"/);
    assert.match(html, /<link rel="alternate" hreflang="x-default" href="[^"]+"/);

    const h1Match = articleHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    assert.ok(h1Match, 'expected an <h1>');
    assert.ok(!h1Match[0].includes('lang="en"'), 'expected the translated h1 to carry no English lang override');
  }
);

test(
  'es-article-pages: a held/missing pilot translation renders the honest D-05 fallback — noindex, visible note, English content marked lang="en"',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const facts = readTierFacts();
    const fallbackFact = facts.articlesEs.find((f) => PILOT_HELD_UUIDS.includes(f.uuid) && !f.translated);
    assert.ok(
      fallbackFact,
      'expected at least one 06-08 pilot "held" uuid to have translated:false in the built tier facts'
    );

    const html = readBuiltPage(fallbackFact.path);
    assert.ok(html, `expected a built page at ${fallbackFact.path} (static or archived)`);

    assert.match(html, /<html lang="es">/, 'the PAGE is still Spanish even though its content falls back');
    assert.ok(html.includes(decodeEntities(t('fallbackNote', 'es'))), 'expected the D-05 fallback note');
    assert.match(html, /<meta name="robots" content="noindex">/);

    // D-14 discretion: a fallback page pairs with nothing — zero HREFLANG alternate links.
    // (Base.astro always renders a separate `rel="alternate" type="application/rss+xml"` feed
    // link regardless of hreflang mode — that's not what this assertion is about.)
    assert.ok(
      !html.includes('rel="alternate" hreflang='),
      'expected zero hreflang alternates on a fallback page'
    );

    const articleHtml = extractArticleRegion(html);
    const h1Match = articleHtml.match(/<h1([^>]*)>/);
    assert.ok(h1Match, 'expected an <h1>');
    assert.match(h1Match[1], /lang="en"/, 'expected the fallback h1 to carry lang="en"');
  }
);

test(
  'es-article-pages: rail headings on /es pages are Spanish from the dictionary — no English rail heading text leaks through',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const facts = readTierFacts();
    const sorted = [...facts.articlesEs].sort((a, b) => a.uuid.localeCompare(b.uuid));
    // Evenly-spaced sample across the sorted list, same discipline as article-markup.test.mjs's
    // sampleEvenly — not the first N (same handful of categories/dates) and not random.
    const sampleSize = 15;
    const step = Math.max(1, Math.floor(sorted.length / sampleSize));
    let railPagesChecked = 0;

    for (let i = 0; i < sorted.length && railPagesChecked < sampleSize; i += step) {
      const html = readBuiltPage(sorted[i].path);
      if (!html) continue;
      if (!html.includes('data-rail')) continue; // this article has no rail neighbours at all
      railPagesChecked++;

      assert.ok(
        !html.includes('More in ') && !/>\s*Earlier\s*</.test(html),
        `expected no English rail heading text on ${sorted[i].path}`
      );
      if (html.includes('id="rail-more-heading"')) {
        assert.match(html, /Más en /, 'expected the Spanish "Más en {category}" heading');
      }
      if (html.includes('id="rail-second-heading"')) {
        assert.match(html, />\s*Anteriores\s*</, 'expected the Spanish "Anteriores" heading');
      }
      assert.match(html, /aria-label="Más historias"/, 'expected the Spanish rail aria-label');
    }

    assert.ok(railPagesChecked > 0, 'expected to find at least one sampled /es page with a rail');
  }
);
