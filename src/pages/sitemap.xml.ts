import { getCollection } from 'astro:content';
import { absoluteUrl, escapeXml } from '../lib/site';

type SitemapEntry = {
  path: string;
  lastmod?: Date;
  changefreq?: 'weekly' | 'monthly' | 'yearly';
  priority?: string;
};

function renderUrl(entry: SitemapEntry) {
  const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod.toISOString().slice(0, 10)}</lastmod>` : '';
  const changefreq = entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : '';
  const priority = entry.priority ? `<priority>${entry.priority}</priority>` : '';

  return `<url>
  <loc>${escapeXml(absoluteUrl(entry.path))}</loc>
  ${lastmod}
  ${changefreq}
  ${priority}
</url>`;
}

export async function GET() {
  const posts = (await getCollection('blog'))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const photos = (await getCollection('photos'))
    .filter((photo) => !photo.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const latestPostDate = posts[0]?.data.updated ?? posts[0]?.data.date;
  const latestPhotoDate = photos[0]?.data.date;

  const entries: SitemapEntry[] = [
    { path: '/', lastmod: latestPostDate ?? latestPhotoDate, changefreq: 'weekly', priority: '1.0' },
    { path: '/blog/', lastmod: latestPostDate, changefreq: 'weekly', priority: '0.8' },
    { path: '/gallery/', lastmod: latestPhotoDate, changefreq: 'monthly', priority: '0.8' },
    { path: '/archive/', lastmod: latestPostDate ?? latestPhotoDate, changefreq: 'monthly', priority: '0.7' },
    { path: '/search/', lastmod: latestPostDate ?? latestPhotoDate, changefreq: 'monthly', priority: '0.6' },
    ...posts.map((post) => ({
      path: `/blog/${post.id}/`,
      lastmod: post.data.updated ?? post.data.date,
      changefreq: 'monthly' as const,
      priority: '0.7',
    })),
    ...photos.map((photo) => ({
      path: `/gallery/${photo.id}/`,
      lastmod: photo.data.date,
      changefreq: 'yearly' as const,
      priority: '0.6',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(renderUrl).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
