// 07-01/07-03: the head-harness variant table, shared by the harness page (`pages/[variant].astro`)
// and tests/unit/head-harness.test.mjs. `props` are passed to `Base.astro` verbatim; `expectMeta`
// holds the literal head values the built HTML must carry (an array value means every occurrence, in
// order). Every variant passes a fixed `datelineEpoch` so the body never depends on the build clock.
// Lives in an imported module, not page frontmatter: frontmatter-local data referenced only from
// `getStaticPaths()` can be dropped by Astro 7.3.3's bundler (04-05).
export interface HeadVariant {
  name: string;
  props: Record<string, unknown>;
  expectMeta: Record<string, string | string[]>;
  expectAbsent?: string[];
}

// D-17 / UI-SPEC: none of these may ever appear (X falls back to og:*, and no handle exists).
const NEVER = ['twitter:site', 'twitter:title', 'twitter:description', 'twitter:image'];

// Literal EN and ES card values (07-UI-SPEC "Head Metadata Contract"); the variants below spread
// one of these and add the page-specific keys, so each variant's full set stays literal.
const EN_CARD = {
  'og:site_name': '915 TLDR',
  'og:type': 'website',
  'og:locale': 'en_US',
  'og:locale:alternate': 'es_US',
  'og:image': 'https://dev.915tldr.com/og-image.png',
  'og:image:width': '1200',
  'og:image:height': '630',
  'og:image:type': 'image/png',
  'og:image:alt': '915 TLDR — El Paso news, in brief.',
  'twitter:card': 'summary_large_image',
  'twitter:image:alt': '915 TLDR — El Paso news, in brief.',
};

const ES_CARD = {
  'og:site_name': '915 TLDR',
  'og:type': 'website',
  'og:locale': 'es_US',
  'og:locale:alternate': 'en_US',
  'og:image': 'https://dev.915tldr.com/og-image-es.png',
  'og:image:width': '1200',
  'og:image:height': '630',
  'og:image:type': 'image/png',
  'og:image:alt': '915 TLDR — Noticias de El Paso, en breve.',
  'twitter:card': 'summary_large_image',
  'twitter:image:alt': '915 TLDR — Noticias de El Paso, en breve.',
};

// Copied literally from src/lib/i18n/dictionary.ts `homeDescription` (en), so a dictionary edit
// fails this variant loudly instead of silently moving the expectation with it.
const EN_HOME_DESCRIPTION =
  'AI-powered local news for El Paso. Get the TLDR on what matters in the Sun City. News from El Paso Matters, KTSM, and more.';

export const VARIANTS: HeadVariant[] = [
  {
    name: 'en-listing',
    props: {
      page: 'category',
      lang: 'en',
      title: 'Crime — 915 TLDR',
      description: 'Crime news from El Paso, summarised.',
      canonicalPath: '/crime',
      datelineEpoch: 1790000000,
    },
    expectMeta: {
      'og:title': 'Crime — 915 TLDR',
      'og:description': 'Crime news from El Paso, summarised.',
      'og:url': 'https://915tldr.com/crime',
      ...EN_CARD,
    },
    expectAbsent: NEVER,
  },
  {
    name: 'es-listing',
    props: {
      page: 'category',
      lang: 'es',
      title: 'Crimen — 915 TLDR',
      description: 'Noticias de crimen de El Paso, resumidas.',
      canonicalPath: '/es/crime',
      datelineEpoch: 1790000000,
    },
    expectMeta: {
      'og:title': 'Crimen — 915 TLDR',
      'og:description': 'Noticias de crimen de El Paso, resumidas.',
      'og:url': 'https://915tldr.com/es/crime',
      ...ES_CARD,
    },
    expectAbsent: NEVER,
  },
  {
    name: 'en-home',
    props: {
      page: 'home',
      lang: 'en',
      title: '915 TLDR — El Paso news, in brief',
      description: 'Home description fixture.',
      canonicalPath: '/',
      datelineEpoch: 1790000000,
    },
    expectMeta: {
      'og:title': '915 TLDR — El Paso news, in brief',
      'og:description': 'Home description fixture.',
      'og:url': 'https://915tldr.com/',
      ...EN_CARD,
    },
    expectAbsent: NEVER,
  },
  {
    // D-22: an English page with no Spanish counterpart still carries og:locale:alternate.
    name: 'en-self',
    props: {
      page: 'article',
      lang: 'en',
      title: 'Self fixture — 915 TLDR',
      description: 'An English-only page.',
      canonicalPath: '/crime/self-fixture-00000000-0000-0000-0000-000000000001',
      alternates: 'self',
      datelineEpoch: 1790000000,
    },
    expectMeta: {
      'og:title': 'Self fixture — 915 TLDR',
      'og:description': 'An English-only page.',
      'og:url': 'https://915tldr.com/crime/self-fixture-00000000-0000-0000-0000-000000000001',
      ...EN_CARD,
    },
    expectAbsent: NEVER,
  },
  {
    // D-14: noindex pages still carry the full set. alternates resolves to 'none' (noindex), and
    // og:locale:alternate is still present.
    name: 'es-noindex',
    props: {
      page: 'source',
      lang: 'es',
      title: 'KTSM — 915 TLDR',
      description: 'Historias de KTSM, resumidas.',
      canonicalPath: '/es/source/ktsm',
      noindex: true,
      datelineEpoch: 1790000000,
    },
    expectMeta: {
      'og:title': 'KTSM — 915 TLDR',
      'og:description': 'Historias de KTSM, resumidas.',
      'og:url': 'https://915tldr.com/es/source/ktsm',
      robots: 'noindex',
      ...ES_CARD,
    },
    expectAbsent: NEVER,
  },
  {
    // UI Considerations "empty": no description prop, so og:description falls back to the
    // homeDescription dictionary entry and the page has no <meta name="description">.
    name: 'en-no-description',
    props: {
      page: 'category',
      lang: 'en',
      title: 'No description — 915 TLDR',
      canonicalPath: '/no-description',
      datelineEpoch: 1790000000,
    },
    expectMeta: {
      'og:title': 'No description — 915 TLDR',
      'og:description': EN_HOME_DESCRIPTION,
      'og:url': 'https://915tldr.com/no-description',
      ...EN_CARD,
    },
    expectAbsent: [...NEVER, 'description'],
  },
  {
    // UI Considerations "error": no canonicalPath (as on the 404 page), so og:url is built from the
    // page's own path on the site origin, never the og:image origin.
    name: 'no-canonical',
    props: {
      page: 'not-found',
      lang: 'en',
      title: 'No canonical — 915 TLDR',
      description: 'A page with no canonicalPath.',
      datelineEpoch: 1790000000,
    },
    expectMeta: {
      'og:title': 'No canonical — 915 TLDR',
      'og:description': 'A page with no canonicalPath.',
      'og:url': 'https://915tldr.com/no-canonical',
      ...EN_CARD,
    },
    expectAbsent: NEVER,
  },
  {
    // T-07-01: hostile text must not leave its attribute or create an element.
    name: 'injection',
    props: {
      page: 'category',
      lang: 'en',
      title: 'Quote " & <script>alert(1)</script> — 915 TLDR',
      description: '<b>bold</b> & "quoted"',
      canonicalPath: '/injection',
      datelineEpoch: 1790000000,
    },
    expectMeta: {
      'og:title': 'Quote " & <script>alert(1)</script> — 915 TLDR',
      'og:description': '<b>bold</b> & "quoted"',
      'og:url': 'https://915tldr.com/injection',
      ...EN_CARD,
    },
    expectAbsent: NEVER,
  },
];
