export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Nette URL-slug: “Audi RS3 Sportback” → “audi-rs3-sportback”. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' en ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 80 && SLUG_RE.test(slug)
}
