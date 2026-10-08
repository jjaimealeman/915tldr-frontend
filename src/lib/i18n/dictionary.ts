// 06-05 (D-15): the single fixed EN/ES UI dictionary every page's chrome (and, as later plans
// wire them in, every listing/article/static-page template) draws from. A flat `{ key: {en, es}
// }` map, not a general-purpose i18n library (i18next, astro-i18next, ...) — RESEARCH.md Pattern
// 5: this project's whole UI surface is ~15-20 fixed strings, and a library would bring its own
// routing/middleware opinions that could reintroduce the auto-redirect behavior D-13 forbids.
//
// Register is neutral Latin American Spanish for an El Paso-Juárez audience (`usted` forms, no
// Spain-only vocabulary), per 06-05-PLAN.md's context. `design/fixtures/spanish-stress.json`'s
// `es_real` values (Phase 1, approved component copy) are reused verbatim where they cover a
// string exactly (skip-link, theme-toggle, nav-category-label, ai-disclosure, byline, tag-chip).
//
// `t(key, lang, vars?)` never falls back silently — an unknown key or an invalid `lang` throws,
// matching this project's existing throw-on-tampering discipline (`article-url.ts`'s
// `assertMatches`/`assertLanguage`). `{name}` placeholders are replaced with plain string
// substitution; the replaced values are always inserted into the page as text by Astro's own
// escaping (never `set:html`), so this function has no HTML-injection surface of its own (T-06-20).
import { assertLanguage, type Language } from '../article-url.ts';

export interface DictionaryEntry {
  en: string;
  es: string;
}

/**
 * Every fixed UI string this project's chrome and (as later `/es` plans wire them in) templates
 * need. Keys are grouped by the page/region they belong to, matching 06-05-PLAN.md's own harvest
 * list. Every entry MUST have a non-empty `en` and `es` value — enforced by this plan's own
 * acceptance criterion (`tests/unit/i18n.test.mjs`) and verified at build time by
 * `node -e "...dictionary.ts..."` (06-05-PLAN.md's acceptance_criteria).
 */
export const DICTIONARY = {
  // --- Header / nav / footer chrome (Base.astro) ---
  skipLink: { en: 'Skip to content', es: 'Saltar la navegación' },
  navLabel: { en: 'Sections', es: 'Secciones' },
  tagline: { en: 'El Paso news, in brief', es: 'Noticias de El Paso, en breve' },
  datelinePlace: { en: 'El Paso, Texas', es: 'El Paso, Texas' },
  themeToggleLabel: { en: 'Dark theme', es: 'Tema oscuro' },
  /** The switch LINK label shown on a page of the given language — i.e. `t('switchLabel', 'en')`
   * is what an English page shows ("Español", inviting the reader to the Spanish pair), and
   * `t('switchLabel', 'es')` is what a Spanish page shows ("English") (D-12). */
  switchLabel: { en: 'Español', es: 'English' },
  /** Same inversion as `switchLabel`, for the article-level switcher (D-12): the label shown on
   * an English article invites the reader to "Leer en español"; on a Spanish article, "Read in
   * English". */
  articleSwitchLabel: { en: 'Leer en español', es: 'Read in English' },
  footerChangelog: { en: 'Changelog', es: 'Registro de cambios' },
  footerContact: { en: 'Contact', es: 'Contacto' },
  footerAbout: { en: 'About', es: 'Acerca de' },
  footerPrivacy: { en: 'Privacy', es: 'Privacidad' },
  footerTerms: { en: 'Terms', es: 'Términos' },
  footerAttribution: {
    en: 'Summaries of reporting by KTSM, KVIA and other El Paso outlets — always credited, always linked',
    es: 'Resúmenes de la cobertura de KTSM, KVIA y otros medios de El Paso — siempre acreditados, siempre enlazados',
  },
  creditPrefix: { en: 'Site by', es: 'Sitio por' },
  newTabCue: { en: ' (opens in a new tab)', es: ' (se abre en una pestaña nueva)' },

  // --- Article chrome (AI disclosure, attribution, tags, rail — I18N-09, D-07) ---
  aiDisclosure: {
    en: 'This summary was written by AI from reporting by {source}.',
    es: 'Este resumen fue redactado por IA a partir de la cobertura de {source}.',
  },
  aiDisclosureLink: {
    en: 'It may leave out detail — read the original story.',
    es: 'Puede omitir detalles — lea la nota original.',
  },
  attributionLabel: { en: 'Original reporting:', es: 'Reportaje original:' },
  /** 06-09 (Task 2): the breadcrumb's first item on every page — `/es` pages pass Spanish
   * names/paths for ALL three BreadcrumbList items, this one included. */
  home: { en: 'Home', es: 'Inicio' },
  tagsSectionHeading: { en: 'Tags', es: 'Etiquetas' },
  railMoreIn: { en: 'More in {category}', es: 'Más en {category}' },
  railEarlier: { en: 'Earlier', es: 'Anteriores' },
  railMoreStoriesLabel: { en: 'More stories', es: 'Más historias' },
  railLatestHeading: { en: 'Latest Stories', es: 'Últimas noticias' },
  railLatestAriaLabel: { en: 'Latest stories', es: 'Últimas noticias' },
  /** D-07: shown on the ENGLISH page of a Spanish-origin article, next to the source link. */
  originallySpanish: {
    en: 'Originally reported in Spanish',
    es: 'Reportado originalmente en español',
  },
  /** D-05: shown on the `/es` URL of an article whose Spanish version doesn't exist yet or was
   * held by the grounding check — English content serves instead with this note. The `en` value
   * is never rendered (the note itself only ever appears on a Spanish page) but is required for
   * this dictionary's own non-empty-both-languages contract. */
  fallbackNote: {
    en: 'Not yet available in Spanish.',
    es: 'No disponible en español todavía.',
  },

  // --- Home (src/pages/index.astro / src/pages/es/index.astro) ---
  homeTitle: {
    en: '915 TLDR - El Paso News, Simplified',
    es: '915 TLDR - Noticias de El Paso, simplificadas',
  },
  homeDescription: {
    en: 'AI-powered local news for El Paso. Get the TLDR on what matters in the Sun City. News from El Paso Matters, KTSM, and more.',
    es: 'Noticias locales de El Paso con inteligencia artificial. El resumen de lo que importa en la Ciudad del Sol. Noticias de El Paso Matters, KTSM y más.',
  },
  homeGridLabel: { en: 'Latest', es: 'Lo último' },

  // --- Category index pages ---
  categoryPageTitle: { en: '{category} News - El Paso', es: 'Noticias de {category} - El Paso' },
  categoryPageDescription: {
    en: 'Latest {categoryLower} news from El Paso, Texas. AI-summarized local news from multiple sources.',
    es: 'Últimas noticias de {categoryLower} de El Paso, Texas. Noticias locales resumidas con inteligencia artificial de múltiples fuentes.',
  },
  allSections: { en: 'All sections', es: 'Todas las secciones' },
  emptyStateCategory: { en: 'No {category} stories yet.', es: 'Aún no hay historias de {category}.' },
  storyCountSingular: { en: 'story', es: 'historia' },
  storyCountPlural: { en: 'stories', es: 'historias' },
  latestInCategory: { en: 'Latest in {category}', es: 'Lo último en {category}' },

  // --- Tag pages ---
  tagPageTitle: { en: '{tag} News - El Paso', es: 'Noticias de {tag} - El Paso' },
  tagPageDescription: {
    en: 'El Paso news articles about {tag}. Browse all articles tagged with this topic.',
    es: 'Artículos de noticias de El Paso sobre {tag}. Explora todos los artículos con esta etiqueta.',
  },
  storiesTaggedLabel: { en: 'Stories tagged {tag}', es: 'Historias etiquetadas {tag}' },
  tagStoryCountSuffix: { en: 'with this tag', es: 'con esta etiqueta' },

  // --- Tags index (/tags) ---
  tagsPageTitle: { en: 'News Tags - El Paso Topics', es: 'Etiquetas de noticias - Temas de El Paso' },
  tagsPageDescription: {
    en: 'Browse all news tags and topics from El Paso news. Find articles by subject matter.',
    es: 'Explora todas las etiquetas y temas de las noticias de El Paso. Encuentra artículos por tema.',
  },
  browseTags: { en: 'Browse Tags', es: 'Explorar etiquetas' },
  exploreTopics: {
    en: 'Explore {count} topics covered in El Paso news.',
    es: 'Explora {count} temas cubiertos en las noticias de El Paso.',
  },

  // --- Source pages ---
  sourcePageTitle: { en: '{source} - El Paso News', es: '{source} - Noticias de El Paso' },
  sourcePageDescription: {
    en: 'Latest news from {source}. AI-summarized articles from this El Paso news source.',
    es: 'Últimas noticias de {source}. Artículos resumidos con inteligencia artificial de esta fuente de El Paso.',
  },
  visitWebsite: { en: 'Visit website', es: 'Visitar sitio web' },
  latestFromSource: { en: 'Latest from {source}', es: 'Lo último de {source}' },

  // --- 404 ---
  notFoundTitle: { en: 'Page not found — 915 TLDR', es: 'Página no encontrada — 915 TLDR' },
  notFoundHeading: { en: 'Page not found', es: 'Página no encontrada' },
  notFoundBody: {
    en: "The page you're looking for doesn't exist, may have moved, or the link may be out of date.",
    es: 'La página que buscas no existe, puede haberse movido o el enlace puede estar desactualizado.',
  },
  recentStoriesHeading: { en: 'Recent stories', es: 'Historias recientes' },
  suggestionsHeading: { en: 'You might be looking for', es: 'Quizás estés buscando' },

  // --- Changelog ---
  changelogTitle: { en: 'Changelog — 915 TLDR', es: 'Registro de cambios — 915 TLDR' },
  changelogDescription: {
    en: '915 TLDR is built in the open. Every change, in plain English, newest first.',
    es: '915 TLDR se construye abiertamente. Cada cambio, de más reciente a más antiguo.',
  },
  changelogHeading: { en: 'Changelog', es: 'Registro de cambios' },
  changelogLede: {
    en: '915 TLDR is built in the open. Every change, in plain English, newest first.',
    es: '915 TLDR se construye abiertamente. Cada cambio, de más reciente a más antiguo.',
  },
  /** D-17: a one-line note, shown only on `/es/changelog`, that entries themselves stay in
   * English. The `en` value is never rendered, same contract as `fallbackNote` above. */
  changelogEnglishNote: {
    en: 'Build notes are published in English.',
    es: 'Las notas de la versión se publican en inglés.',
  },

  // --- Static pages (titles only — About/Privacy/Terms/Contact body copy is D-16's
  // human-reviewed Spanish prose, not drawn from this fixed dictionary) ---
  aboutPageTitle: { en: 'About 915 TLDR', es: 'Acerca de 915 TLDR' },
  privacyPageTitle: { en: 'Privacy Policy - 915 TLDR', es: 'Política de privacidad - 915 TLDR' },
  termsPageTitle: { en: 'Terms of Service - 915 TLDR', es: 'Términos de servicio - 915 TLDR' },
  contactPageTitle: { en: '915 TLDR — Contact', es: '915 TLDR — Contacto' },

  // --- Umami opt-out utility pages (/opt-out, /es/opt-out — noindex, owner bookmarks them) ---
  // Spanish: Claude-drafted, NOT human-reviewed. Neutral Latin American Spanish, usted forms.
  optOutPageTitle: { en: 'Analytics opt-out - 915 TLDR', es: 'Exclusión de estadísticas - 915 TLDR' },
  optOutPageDescription: {
    en: 'Stop your own visits from being counted in 915 TLDR analytics on this device.',
    es: 'Evite que sus propias visitas se cuenten en las estadísticas de 915 TLDR desde este dispositivo.',
  },
  optOutHeading: { en: 'Analytics opt-out', es: 'Exclusión de estadísticas' },
  optOutIntro: {
    en: '915 TLDR counts page views with Umami, a self-hosted tool that sets no cookies. If you run or test this site, you can stop your visits on this device from being counted.',
    es: '915 TLDR cuenta las visitas con Umami, una herramienta alojada por nosotros que no usa cookies. Si usted administra o prueba este sitio, puede evitar que sus visitas desde este dispositivo se cuenten.',
  },
  optOutChecking: { en: 'Checking this browser…', es: 'Revisando este navegador…' },
  optOutStatusCounted: {
    en: 'Your visits on this device ARE being counted.',
    es: 'Sus visitas desde este dispositivo SÍ se están contando.',
  },
  optOutStatusOptedOut: {
    en: 'Your visits on this device are NOT being counted.',
    es: 'Sus visitas desde este dispositivo NO se están contando.',
  },
  optOutStatusUnavailable: {
    en: 'This browser is blocking site storage, so this setting cannot be read or changed here.',
    es: 'Este navegador bloquea el almacenamiento del sitio, por lo que aquí no se puede leer ni cambiar este ajuste.',
  },
  optOutButtonStop: { en: 'Stop counting my visits', es: 'Dejar de contar mis visitas' },
  optOutButtonResume: { en: 'Count my visits again', es: 'Volver a contar mis visitas' },
  optOutScope: {
    en: 'This only affects this browser on this site. Clearing site data, using private browsing, or switching to another browser or device resets it, and you will need to visit this page again there. Each web address (for example 915tldr.com and dev.915tldr.com) keeps its own setting. No cookies are used; the setting is a single flag stored in this browser.',
    es: 'Esto solo afecta a este navegador en este sitio. Si borra los datos del sitio, usa la navegación privada o cambia de navegador o de dispositivo, el ajuste se restablece y deberá visitar esta página de nuevo allí. Cada dirección web (por ejemplo 915tldr.com y dev.915tldr.com) conserva su propio ajuste. No se usan cookies; el ajuste es una sola marca guardada en este navegador.',
  },
  optOutNoScript: {
    en: 'This page needs JavaScript to read and change the setting.',
    es: 'Esta página necesita JavaScript para leer y cambiar el ajuste.',
  },

  // --- RSS ---
  rssFeedTitle: { en: '915 TLDR', es: '915 TLDR' },
} as const satisfies Record<string, DictionaryEntry>;

export type DictionaryKey = keyof typeof DICTIONARY;

/**
 * Looks up `key` for `lang`, substituting any `{name}`-style placeholders from `vars`. Throws,
 * naming the offending value, on an unknown key or an invalid `lang` — this is a UI-string
 * lookup over a closed, fixed set, not a user-data accessor that should ever silently fall back.
 */
export function t(key: DictionaryKey, lang: unknown, vars?: Record<string, string>): string {
  if (!Object.prototype.hasOwnProperty.call(DICTIONARY, key)) {
    throw new Error(`dictionary: unknown key: ${JSON.stringify(key)}`);
  }
  const validLang: Language = assertLanguage(lang);
  let value: string = DICTIONARY[key][validLang];
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(replacement);
    }
  }
  return value;
}
