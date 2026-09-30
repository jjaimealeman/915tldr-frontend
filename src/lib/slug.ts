// Extracted from `src/pages/[category]/[slug].astro` — a bug found against the real build
// (not in 03-RESEARCH.md): a plain top-level `function slugify(...)` declared inside an .astro
// frontmatter block was silently dropped by Astro 7.3.3's rolldown-based bundler when only
// referenced from `getStaticPaths()`. The compiled chunk kept the `getStaticPaths` export and
// the call site (`slugify(row.title)`) but omitted the function body entirely, producing a
// runtime `slugify is not defined` ReferenceError during `astro build`'s static-path
// generation. Moving the helper into its own module — a normal ES import, not a frontmatter
// local — resolves it (Rule 1 auto-fix).
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
