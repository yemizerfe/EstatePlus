/**
 * Normalise a Wikimedia image URL to the host that actually serves pixels.
 *
 * The Commons `imageinfo` API returns thumbnails on `thumb.wikimedia.org` with
 * analytics query parameters attached. That host does not answer image requests
 * from a browser (the cards came out blank), while the identical path on
 * `upload.wikimedia.org` serves the file. Stored URLs are therefore rewritten to
 * the `upload.wikimedia.org` form, without the tracking parameters.
 */
export function normalizeCommonsImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  if (!/(^|\.)wikimedia\.org$/.test(parsed.hostname)) return url;
  if (!parsed.pathname.startsWith('/wikipedia/')) return url;

  return `https://upload.wikimedia.org${parsed.pathname}`;
}
