const env = import.meta.env as Record<string, string | undefined>;

const rawSiteUrl =
  env.PUBLIC_SITE_URL ??
  (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'https://rapture.example.com');

export const SITE_NAME = 'Rapture';
export const SITE_DESCRIPTION = 'A deep-sea ink universe for writing and photography.';
export const SITE_URL = rawSiteUrl.replace(/\/+$/, '');

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
