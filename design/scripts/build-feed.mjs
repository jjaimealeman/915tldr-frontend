#!/usr/bin/env node
// Revision request 8 (01-21): extracts the home grid's 33 cards into a
// static fixture once, then (re)builds the server-rendered first 6 cards on
// index.html plus static feed/page-<n>.json pages for the rest, so a
// load-more button can walk the chain reading only same-origin static
// files -- never D1, never an API (the project's core value).
//
// Modes:
//   --extract   one-time: reads the live [data-grid] cards from a real
//               render of index.html, self-verifies renderCardHtml against
//               them, and writes design/fixtures/home-feed.json. Exits 1 if
//               the fixture already exists.
//   (default)   reads home-feed.json, rewrites index.html's feed markers to
//               hold exactly the first INITIAL_CARDS cards, writes
//               design/mockups/feed/page-2.json.. for the rest, and keeps
//               the load-more button's data-next in sync. Idempotent.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { startServer } from './serve-mockups.mjs';
import { escapeHtml, renderSummaryHtml, validateBlocks } from './lib/summary-markdown.mjs';

const MOCKUPS_DIR = path.resolve('design/mockups');
const INDEX_PATH = path.join(MOCKUPS_DIR, 'index.html');
const FEED_DIR = path.join(MOCKUPS_DIR, 'feed');
const FIXTURE_PATH = path.resolve('design/fixtures/home-feed.json');
const FEED_START = '<!-- feed:start -->';
const FEED_END = '<!-- feed:end -->';

export const INITIAL_CARDS = 6;
export const PAGE_SIZE = 6;

const CATEGORY_SLUGS = ['crime', 'politics', 'sports', 'business', 'education', 'community', 'health', 'weather'];

const CARD_KEYS = [
  'uuid',
  'category',
  'categoryName',
  'stress',
  'lang',
  'variant',
  'image',
  'headline',
  'headlineI18n',
  'summaryI18n',
  'bylineI18n',
  'href',
  'summary',
  'source',
  'datetime',
  'timeLabel',
];

const FEED_PAGE_KEYS = ['schema', 'page', 'next', 'cards'];
const IMAGE_KEYS = ['src', 'width', 'height'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Structurally validates one card record against exactly what extraction
 * produces and the client renderer consumes. Returns a list of
 * human-readable problem strings; [] means valid.
 */
export function validateCard(card) {
  const problems = [];

  if (!isPlainObject(card)) {
    return ['card: not a plain object'];
  }

  for (const key of Object.keys(card)) {
    if (!CARD_KEYS.includes(key)) problems.push(`card: unexpected key "${key}"`);
  }
  for (const key of CARD_KEYS) {
    if (!(key in card)) problems.push(`card: missing key "${key}"`);
  }

  if (!isNonEmptyString(card.uuid)) problems.push('card.uuid must be a non-empty string');

  if (card.category !== 'none' && !CATEGORY_SLUGS.includes(card.category)) {
    problems.push(`card.category "${card.category}" is not a known slug or "none"`);
  }

  if (card.category === 'none') {
    if (card.categoryName !== null) problems.push('card.categoryName must be null when category is "none"');
  } else if (!isNonEmptyString(card.categoryName)) {
    problems.push('card.categoryName must be a non-empty string when category is not "none"');
  }

  for (const key of ['stress', 'variant']) {
    if (card[key] !== null && typeof card[key] !== 'string') {
      problems.push(`card.${key} must be a string or null`);
    }
  }
  if (card.lang !== null && card.lang !== 'es') {
    problems.push('card.lang must be "es" or null');
  }

  if (card.image !== null) {
    if (!isPlainObject(card.image)) {
      problems.push('card.image must be null or an object');
    } else {
      for (const key of Object.keys(card.image)) {
        if (!IMAGE_KEYS.includes(key)) problems.push(`card.image: unexpected key "${key}"`);
      }
      for (const key of IMAGE_KEYS) {
        if (!(key in card.image)) problems.push(`card.image: missing key "${key}"`);
      }
      if (typeof card.image.src !== 'string' || !card.image.src.startsWith('https://')) {
        problems.push('card.image.src must be a string starting with "https://"');
      }
      if (!Number.isInteger(card.image.width)) problems.push('card.image.width must be an integer');
      if (!Number.isInteger(card.image.height)) problems.push('card.image.height must be an integer');
    }
  }

  if (!isNonEmptyString(card.headline)) problems.push('card.headline must be a non-empty string');

  for (const key of ['headlineI18n', 'summaryI18n', 'bylineI18n']) {
    if (card[key] !== null && typeof card[key] !== 'string') {
      problems.push(`card.${key} must be a string or null`);
    }
  }

  if (card.href !== 'article.html') problems.push('card.href must be exactly "article.html"');

  if (card.summary !== null) {
    if (!Array.isArray(card.summary) || card.summary.length === 0) {
      problems.push('card.summary must be null or a non-empty array');
    } else {
      for (const p of validateBlocks(card.summary)) problems.push(`card.summary: ${p}`);
    }
  }

  if (!isNonEmptyString(card.source)) problems.push('card.source must be a non-empty string');

  if (typeof card.datetime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(card.datetime)) {
    problems.push('card.datetime must be an ISO 8601 string with a numeric offset');
  }

  if (!isNonEmptyString(card.timeLabel)) problems.push('card.timeLabel must be a non-empty string');

  return problems;
}

/**
 * Structurally validates a feed page's top-level shape and every card in
 * it. `expectedPage` is the page number this file is supposed to declare
 * itself as (its own filename number) -- checked so a misnamed or
 * out-of-chain file is caught, not just an internally-consistent one.
 */
export function validateFeedPage(json, expectedPage) {
  const problems = [];

  if (!isPlainObject(json)) {
    return ['feed page: not a plain object'];
  }

  for (const key of Object.keys(json)) {
    if (!FEED_PAGE_KEYS.includes(key)) problems.push(`feed page: unexpected key "${key}"`);
  }
  for (const key of FEED_PAGE_KEYS) {
    if (!(key in json)) problems.push(`feed page: missing key "${key}"`);
  }

  if (json.schema !== 1) problems.push(`feed page: schema must be 1, got ${JSON.stringify(json.schema)}`);
  if (json.page !== expectedPage) {
    problems.push(`feed page: page ${JSON.stringify(json.page)} !== expected ${expectedPage}`);
  }
  if (json.next !== null && json.next !== `feed/page-${expectedPage + 1}.json`) {
    problems.push(
      `feed page: next ${JSON.stringify(json.next)} is not null or "feed/page-${expectedPage + 1}.json"`
    );
  }

  if (!Array.isArray(json.cards) || json.cards.length === 0) {
    problems.push('feed page: cards must be a non-empty array');
  } else {
    json.cards.forEach((card, i) => {
      for (const p of validateCard(card)) problems.push(`feed page cards[${i}]: ${p}`);
    });
  }

  return problems;
}

/**
 * Pure function: renders one card record to the exact HTML shape the
 * original hand-authored markup used (element/attribute/child order fixed
 * by 01-21-PLAN.md's <context>). Every text and attribute value is escaped
 * with escapeHtml; the summary (if any) is rendered with renderSummaryHtml
 * from the already-typed blocks -- never re-parsed from markdown, since the
 * DOM this was extracted from already holds rendered HTML (01-18).
 */
export function renderCardHtml(card) {
  const attrs = [
    'data-card',
    `data-uuid="${escapeHtml(card.uuid)}"`,
    `data-category="${escapeHtml(card.category)}"`,
  ];
  if (card.stress) attrs.push(`data-stress="${escapeHtml(card.stress)}"`);
  if (card.lang) attrs.push(`lang="${escapeHtml(card.lang)}"`);
  if (card.variant) attrs.push(`data-variant="${escapeHtml(card.variant)}"`);

  const lines = [];
  lines.push(`    <article ${attrs.join(' ')}>`);
  lines.push('      <span data-stripe></span>');

  if (card.category !== 'none') {
    lines.push(`      <p data-category-name>${escapeHtml(card.categoryName)}</p>`);
  }

  if (card.image) {
    lines.push(
      `      <div data-frame><img src="${escapeHtml(card.image.src)}" width="${card.image.width}" height="${card.image.height}" loading="lazy" alt=""></div>`
    );
  }

  const headlineI18nAttr = card.headlineI18n ? ` data-i18n="${escapeHtml(card.headlineI18n)}"` : '';
  lines.push(
    `      <h3${headlineI18nAttr}><a href="${escapeHtml(card.href)}">${escapeHtml(card.headline)}</a></h3>`
  );

  if (card.summary) {
    const summaryI18nAttr = card.summaryI18n ? ` data-i18n="${escapeHtml(card.summaryI18n)}"` : '';
    lines.push(`      <div data-summary${summaryI18nAttr}>${renderSummaryHtml(card.summary)}</div>`);
  }

  const bylineI18nAttr = card.bylineI18n ? ` data-i18n="${escapeHtml(card.bylineI18n)}"` : '';
  lines.push(
    `      <p data-byline${bylineI18nAttr}><span data-source>${escapeHtml(card.source)}</span> · <time datetime="${escapeHtml(card.datetime)}">${escapeHtml(card.timeLabel)}</time></p>`
  );
  lines.push('    </article>');

  return lines.join('\n');
}

// ---- --extract mode ----

/**
 * In-page: reads every [data-grid] > article[data-card] in DOM order into
 * card records matching CARD_KEYS exactly. Summary blocks are read from the
 * already-rendered DOM (a <p> gives inline text/strong runs;
 * ul[data-key-details] > li gives items) -- never from raw markdown, which
 * no longer exists in the DOM after 01-18's conversion.
 */
function extractCardsFromDom() {
  function readInlines(el) {
    const inlines = [];
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent && node.textContent.length > 0) {
          inlines.push({ text: node.textContent });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'STRONG') {
        inlines.push({ text: node.textContent || '', strong: true });
      }
    }
    return inlines;
  }

  const cards = [];
  const articles = document.querySelectorAll('[data-grid] > article[data-card]');

  for (const article of Array.from(articles)) {
    const uuid = article.getAttribute('data-uuid');
    const category = article.getAttribute('data-category');
    const stress = article.getAttribute('data-stress');
    const lang = article.getAttribute('lang');
    const variant = article.getAttribute('data-variant');

    const categoryNameEl = article.querySelector(':scope > p[data-category-name]');
    const categoryName = categoryNameEl ? (categoryNameEl.textContent || '').trim() : null;

    const frameImg = article.querySelector(':scope > div[data-frame] > img');
    const image = frameImg
      ? {
          src: frameImg.getAttribute('src'),
          width: parseInt(frameImg.getAttribute('width') || '0', 10),
          height: parseInt(frameImg.getAttribute('height') || '0', 10),
        }
      : null;

    const h3 = article.querySelector(':scope > h3');
    const headlineI18n = h3 ? h3.getAttribute('data-i18n') : null;
    const a = h3 ? h3.querySelector('a') : null;
    const headline = a ? (a.textContent || '').trim() : '';
    const href = a ? a.getAttribute('href') : null;

    const summaryEl = article.querySelector(':scope > div[data-summary]');
    let summary = null;
    let summaryI18n = null;
    if (summaryEl) {
      summaryI18n = summaryEl.getAttribute('data-i18n');
      const blocks = [];
      for (const child of Array.from(summaryEl.children)) {
        if (child.tagName === 'P') {
          blocks.push({ type: 'p', inlines: readInlines(child) });
        } else if (child.tagName === 'UL') {
          const items = [];
          for (const li of Array.from(child.children)) {
            items.push(readInlines(li));
          }
          blocks.push({ type: 'list', items });
        }
      }
      summary = blocks;
    }

    const bylineEl = article.querySelector(':scope > p[data-byline]');
    const bylineI18n = bylineEl ? bylineEl.getAttribute('data-i18n') : null;
    const sourceEl = bylineEl ? bylineEl.querySelector('span[data-source]') : null;
    const source = sourceEl ? (sourceEl.textContent || '').trim() : '';
    const timeEl = bylineEl ? bylineEl.querySelector('time') : null;
    const datetime = timeEl ? timeEl.getAttribute('datetime') : null;
    const timeLabel = timeEl ? (timeEl.textContent || '').trim() : '';

    cards.push({
      uuid,
      category,
      categoryName,
      stress,
      lang,
      variant,
      image,
      headline,
      headlineI18n,
      summaryI18n,
      bylineI18n,
      href,
      summary,
      source,
      datetime,
      timeLabel,
    });
  }

  return cards;
}

function gitShortSha() {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function normalizeWhitespace(value) {
  // Strip HTML comments before collapsing whitespace: a handful of the
  // extracted cards (junk-image, no-summary, spanish-real) carry
  // documentation comments in the source markup that explain the fixture
  // row's provenance -- non-semantic prose about the card, not part of its
  // data model, so renderCardHtml never reproduces them and the comparison
  // must not either.
  return (value || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function runExtract() {
  if (existsSync(FIXTURE_PATH)) {
    console.error(`build-feed: ${path.relative('.', FIXTURE_PATH)} already exists — --extract is one-time only`);
    process.exit(1);
  }

  const server = await startServer({ port: 0 });
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') {
        await route.abort();
        return;
      }
      await route.fallback();
    });

    const response = await page.goto(`${server.url}/mockups/index.html`);
    if (!response || response.status() !== 200) {
      throw new Error(`build-feed: failed to load index.html for extraction (status ${response?.status()})`);
    }

    const cards = await page.evaluate(extractCardsFromDom);
    if (cards.length === 0) {
      throw new Error('build-feed: extraction found zero [data-grid] > article[data-card] elements');
    }

    // Self-verify: render each card and compare its whitespace-normalised
    // outerHTML to the live card's, via a <template> parse in-page.
    const mismatches = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const renderedHtml = renderCardHtml(card);
      const comparison = await page.evaluate(
        ({ index, renderedHtml }) => {
          const articles = document.querySelectorAll('[data-grid] > article[data-card]');
          const live = articles[index] ? articles[index].outerHTML : null;
          const template = document.createElement('template');
          template.innerHTML = renderedHtml;
          const rendered = template.content.firstElementChild ? template.content.firstElementChild.outerHTML : null;
          return { live, rendered };
        },
        { index: i, renderedHtml }
      );
      if (normalizeWhitespace(comparison.live) !== normalizeWhitespace(comparison.rendered)) {
        mismatches.push({ index: i, uuid: card.uuid, stress: card.stress });
      }
    }

    if (mismatches.length > 0) {
      console.error('build-feed: --extract render/DOM mismatch(es):');
      for (const m of mismatches) {
        console.error(`  index ${m.index} uuid=${m.uuid} stress=${m.stress ?? '(none)'}`);
      }
      process.exit(1);
    }

    const problems = [];
    cards.forEach((card, i) => {
      for (const p of validateCard(card)) problems.push(`cards[${i}]: ${p}`);
    });
    if (problems.length > 0) {
      console.error('build-feed: extracted cards failed validateCard:');
      for (const p of problems) console.error(`  ${p}`);
      process.exit(1);
    }

    const fixture = {
      schema: 1,
      source: `design/mockups/index.html [data-grid] at ${gitShortSha()}`,
      cards,
    };

    mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
    writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
    console.log(`build-feed: extracted ${cards.length} cards, zero render/DOM mismatches, to ${path.relative('.', FIXTURE_PATH)}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

// ---- default (build) mode ----

function updateIndexHtml(initialCards, hasNextPage) {
  let html = readFileSync(INDEX_PATH, 'utf8');
  const cardsHtml = initialCards.map(renderCardHtml).join('\n');

  const startIdx = html.indexOf(FEED_START);
  const endIdx = html.indexOf(FEED_END);

  if (startIdx !== -1 && endIdx !== -1) {
    const before = html.slice(0, startIdx + FEED_START.length);
    const after = html.slice(endIdx);
    html = `${before}\n${cardsHtml}\n    ${after}`;
  } else {
    const gridRegionRe = /(<section data-grid aria-label="Latest">\n)([\s\S]*?)(\n {2}<\/section>)/;
    if (!gridRegionRe.test(html)) {
      throw new Error('build-feed: could not find the [data-grid] "Latest" section in index.html');
    }
    html = html.replace(gridRegionRe, (_match, open, _inner, close) => {
      return `${open}    ${FEED_START}\n${cardsHtml}\n    ${FEED_END}${close}`;
    });
  }

  if (hasNextPage) {
    if (html.includes('data-feed-controls')) {
      html = html.replace(/data-next="feed\/page-\d+\.json"/, 'data-next="feed/page-2.json"');
    } else {
      throw new Error(
        'build-feed: index.html has no [data-feed-controls] block to update — add the button/status markup first (01-21-PLAN.md Task 1, action step 4)'
      );
    }
  } else {
    html = html.replace(/[ \t]*<div data-feed-controls>[\s\S]*?<\/div>\n/, '');
  }

  writeFileSync(INDEX_PATH, html, 'utf8');
}

async function runBuild() {
  if (!existsSync(FIXTURE_PATH)) {
    console.error(`build-feed: ${path.relative('.', FIXTURE_PATH)} not found — run --extract first`);
    process.exit(1);
  }

  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  if (fixture.schema !== 1 || !Array.isArray(fixture.cards)) {
    console.error('build-feed: home-feed.json has an unexpected shape (expected { schema: 1, cards: [...] })');
    process.exit(1);
  }

  const problems = [];
  fixture.cards.forEach((card, i) => {
    for (const p of validateCard(card)) problems.push(`cards[${i}]: ${p}`);
  });
  if (problems.length > 0) {
    console.error('build-feed: home-feed.json failed validateCard:');
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }

  const initialCards = fixture.cards.slice(0, INITIAL_CARDS);
  const remaining = fixture.cards.slice(INITIAL_CARDS);

  const pageChunks = [];
  for (let i = 0; i < remaining.length; i += PAGE_SIZE) {
    pageChunks.push(remaining.slice(i, i + PAGE_SIZE));
  }

  mkdirSync(FEED_DIR, { recursive: true });

  const expectedFiles = new Set(pageChunks.map((_chunk, i) => `page-${i + 2}.json`));
  const existingFiles = readdirSync(FEED_DIR).filter((f) => /^page-\d+\.json$/.test(f));
  const stale = existingFiles.filter((f) => !expectedFiles.has(f));
  if (stale.length > 0) {
    console.error('build-feed: stale feed page file(s) found — delete these manually and re-run:');
    for (const f of stale) console.error(`  design/mockups/feed/${f}`);
    process.exit(1);
  }

  pageChunks.forEach((chunk, i) => {
    const pageNumber = i + 2;
    const next = i + 1 < pageChunks.length ? `feed/page-${pageNumber + 1}.json` : null;
    const json = { schema: 1, page: pageNumber, next, cards: chunk };
    writeFileSync(path.join(FEED_DIR, `page-${pageNumber}.json`), JSON.stringify(json, null, 2) + '\n', 'utf8');
  });

  updateIndexHtml(initialCards, pageChunks.length > 0);

  console.log(
    `build-feed: ${initialCards.length} initial card(s) on index.html, ${pageChunks.length} feed page(s), ${remaining.length} card(s) behind the button.`
  );
}

async function main() {
  if (process.argv.includes('--extract')) {
    await runExtract();
  } else {
    await runBuild();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error(err.stack ?? err);
    process.exit(1);
  });
}
