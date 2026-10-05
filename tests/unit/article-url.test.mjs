// 06-02 Task 1: TDD RED/GREEN suite for the language dimension added to
// src/lib/article-url.ts — LANGUAGES, isLanguage, assertLanguage, SPANISH_PREFIX,
// languageOfPath, localizedPath and articlePath's new 4th (language) parameter. No imports from
// src/lib/server/ anywhere in article-url.ts; this suite exercises only the pure, Worker-safe
// module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGES,
  SPANISH_PREFIX,
  isLanguage,
  assertLanguage,
  languageOfPath,
  localizedPath,
  articlePath,
} from '../../src/lib/article-url.ts';

const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

// ---------------------------------------------------------------------------
// LANGUAGES / isLanguage / assertLanguage
// ---------------------------------------------------------------------------

test('LANGUAGES: is the closed two-member enum', () => {
  assert.deepEqual(LANGUAGES, ['en', 'es']);
});

test('isLanguage: true for "en" and "es", false for anything else', () => {
  assert.equal(isLanguage('en'), true);
  assert.equal(isLanguage('es'), true);
  assert.equal(isLanguage('fr'), false);
  assert.equal(isLanguage('ES'), false);
  assert.equal(isLanguage('es '), false);
  assert.equal(isLanguage(null), false);
  assert.equal(isLanguage(undefined), false);
});

test('assertLanguage: returns the value for "en"/"es", throws naming the value otherwise', () => {
  assert.equal(assertLanguage('en'), 'en');
  assert.equal(assertLanguage('es'), 'es');
  assert.throws(() => assertLanguage('fr'), /article-url: invalid language: "fr"/);
  assert.throws(() => assertLanguage('ES'), /article-url: invalid language: "ES"/);
  assert.throws(() => assertLanguage(''), /article-url: invalid language: ""/);
});

// ---------------------------------------------------------------------------
// languageOfPath (D-13: derived from the path alone, case-sensitive, exact first segment)
// ---------------------------------------------------------------------------

test('languageOfPath: "/es" and "/es/..." are Spanish', () => {
  assert.equal(languageOfPath('/es'), 'es');
  assert.equal(languageOfPath('/es/'), 'es');
  assert.equal(languageOfPath('/es/tag/a'), 'es');
  assert.equal(languageOfPath(`/es/crime/x-${UUID}`), 'es');
});

test('languageOfPath: a shared-prefix-but-different-first-segment path is English (I18N-04 adjacency)', () => {
  assert.equal(languageOfPath('/escuela/a'), 'en');
  assert.equal(languageOfPath('/es-mx/a'), 'en');
  assert.equal(languageOfPath('/ES/a'), 'en');
  assert.equal(languageOfPath('/ES'), 'en');
});

test('languageOfPath: ordinary English paths are English', () => {
  assert.equal(languageOfPath('/'), 'en');
  assert.equal(languageOfPath('/crime'), 'en');
  assert.equal(languageOfPath(`/crime/x-${UUID}`), 'en');
});

// ---------------------------------------------------------------------------
// localizedPath
// ---------------------------------------------------------------------------

test('localizedPath: prefixes an English path with /es for "es"', () => {
  assert.equal(localizedPath(`/crime/x-${UUID}`, 'es'), `${SPANISH_PREFIX}/crime/x-${UUID}`);
});

test('localizedPath: "/" + "es" is bare "/es" (no double slash)', () => {
  assert.equal(localizedPath('/', 'es'), '/es');
});

test('localizedPath: returns the path unchanged for "en"', () => {
  assert.equal(localizedPath(`/crime/x-${UUID}`, 'en'), `/crime/x-${UUID}`);
});

test('localizedPath: throws on an invalid language', () => {
  assert.throws(() => localizedPath('/crime/x', 'fr'), /article-url: invalid language: "fr"/);
});

test('localizedPath: throws on a path that is not already /es-free (never double-prefixes)', () => {
  assert.throws(
    () => localizedPath('/es/crime/x', 'es'),
    /article-url: path is not an English path/
  );
});

test('localizedPath: throws on a non-absolute path', () => {
  assert.throws(() => localizedPath('crime/x', 'en'), /article-url: invalid path/);
});

// ---------------------------------------------------------------------------
// articlePath's new 4th parameter
// ---------------------------------------------------------------------------

test('articlePath: defaults to English when language is omitted', () => {
  assert.equal(articlePath('crime', 'x', UUID), `/crime/x-${UUID}`);
});

test('articlePath: language "es" produces the /es-prefixed canonical', () => {
  assert.equal(articlePath('crime', 'x', UUID, 'es'), `/es/crime/x-${UUID}`);
});

test('articlePath: localizedPath(articlePath(...)) === articlePath(..., "es") — single source of truth for the /es canonical', () => {
  const english = articlePath('crime', 'x', UUID);
  assert.equal(localizedPath(english, 'es'), articlePath('crime', 'x', UUID, 'es'));
});

test('articlePath: an invalid language throws, naming the value, before any path is built', () => {
  assert.throws(
    () => articlePath('crime', 'x', UUID, 'fr'),
    /article-url: invalid language: "fr"/
  );
});
