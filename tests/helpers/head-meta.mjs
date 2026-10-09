// 07-01: a small regex parser for the `<head>` of built HTML, so head-metadata tests can compare
// meta/link tags without an HTML-parser dependency (same regex style as the seo-surfaces tests).
//
// Astro escapes only `&` and `"` inside attribute values, so a value may contain a literal `<` or
// `>`. Tags are therefore matched with a quote-aware pattern (quoted values consumed as
// `"[^"]*"`), never `<meta[^>]*>`, or a title containing `>` would truncate the parse.
import { decodeEntities } from './html-text.mjs';

const TAG_BODY = '(?:"[^"]*"|\'[^\']*\'|[^>"\'])*';
const ATTR_RE = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

/** The text between `<head>` and `</head>`; throws if either is missing. */
export function headOf(html) {
  const start = html.indexOf('<head>');
  const end = html.indexOf('</head>');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('headOf: built HTML has no <head>...</head>');
  }
  return html.slice(start + '<head>'.length, end);
}

function attributesOf(tagBody) {
  const attrs = {};
  for (const m of tagBody.matchAll(ATTR_RE)) {
    const value = m[2] ?? m[3] ?? m[4];
    attrs[m[1].toLowerCase()] = value === undefined ? '' : decodeEntities(value);
  }
  return attrs;
}

function tagsNamed(headHtml, name) {
  const re = new RegExp(`<${name}\\b(${TAG_BODY})>`, 'g');
  return [...headHtml.matchAll(re)].map((m) => attributesOf(m[1]));
}

/** Every `<meta>` with `property`/`name` plus `content`, in document order, entity-decoded. */
export function parseMetaTags(headHtml) {
  const out = [];
  for (const attrs of tagsNamed(headHtml, 'meta')) {
    if (attrs.content === undefined) continue;
    if (attrs.property !== undefined) out.push({ attr: 'property', key: attrs.property, content: attrs.content });
    else if (attrs.name !== undefined) out.push({ attr: 'name', key: attrs.name, content: attrs.content });
  }
  return out;
}

/** Every `<link>` as `{ rel, href, type, sizes, hreflang }` (absent attributes are undefined). */
export function parseLinkTags(headHtml) {
  return tagsNamed(headHtml, 'link').map((a) => ({
    rel: a.rel,
    href: a.href,
    type: a.type,
    sizes: a.sizes,
    hreflang: a.hreflang,
  }));
}

/** Content of the first tag with this property/name key, or undefined. */
export function metaContent(tags, key) {
  return tags.find((t) => t.key === key)?.content;
}

/** Contents of every tag with this property/name key, in document order. */
export function metaContents(tags, key) {
  return tags.filter((t) => t.key === key).map((t) => t.content);
}
