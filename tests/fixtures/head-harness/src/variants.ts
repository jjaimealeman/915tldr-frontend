// 07-01: the head-harness variant table, shared by the harness page (`pages/[variant].astro`) and
// tests/unit/head-harness.test.mjs. `props` are passed to `Base.astro` verbatim; `expectMeta` holds
// the literal head values the built HTML must carry (an array value means every occurrence, in
// order). Every variant passes a fixed `datelineEpoch` so the body never depends on the build
// clock. Lives in an imported module, not page frontmatter: frontmatter-local data referenced only
// from `getStaticPaths()` can be dropped by Astro 7.3.3's bundler (04-05).
export interface HeadVariant {
  name: string;
  props: Record<string, unknown>;
  expectMeta: Record<string, string | string[]>;
  expectAbsent?: string[];
}

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
      'og:image': 'https://dev.915tldr.com/og-image.png',
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:type': 'image/png',
      'og:image:alt': '915 TLDR — El Paso news, in brief.',
    },
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
      'og:image': 'https://dev.915tldr.com/og-image-es.png',
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:type': 'image/png',
      'og:image:alt': '915 TLDR — Noticias de El Paso, en breve.',
    },
  },
];
