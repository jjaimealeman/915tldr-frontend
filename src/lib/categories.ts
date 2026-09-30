// 04-02: the fixed 8-category nav list, in the approved mockup order (design/mockups/article.html
// and design/mockups/index.html `<nav aria-label="Sections">`). This is project-level fixed
// content (PROJECT.md DSGN-04), not a D1 read — a pure module with no dependency on the
// D1-access boundary the rest of this project enforces.

export interface Category {
  slug: string;
  name: string;
}

export const CATEGORIES: readonly Category[] = [
  { slug: 'crime', name: 'Crime' },
  { slug: 'politics', name: 'Politics' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'business', name: 'Business' },
  { slug: 'education', name: 'Education' },
  { slug: 'community', name: 'Community' },
  { slug: 'health', name: 'Health' },
  { slug: 'weather', name: 'Weather' },
] as const;

export function categoryName(slug: string): string | undefined {
  return CATEGORIES.find((category) => category.slug === slug)?.name;
}

export function isKnownCategory(slug: string): boolean {
  return CATEGORIES.some((category) => category.slug === slug);
}
