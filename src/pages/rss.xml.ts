import { getCollection } from 'astro:content';
import { absoluteUrl, escapeXml, SITE_DESCRIPTION, SITE_NAME } from '../lib/site';

export async function GET() {
  const posts = (await getCollection('blog'))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const latestDate = posts[0]?.data.updated ?? posts[0]?.data.date ?? new Date();

  const items = posts
    .map((post) => {
      const link = absoluteUrl(`/blog/${post.id}/`);
      const pubDate = (post.data.updated ?? post.data.date).toUTCString();
      const categories = post.data.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('');

      return `<item>
  <title>${escapeXml(post.data.title)}</title>
  <link>${link}</link>
  <guid isPermaLink="true">${link}</guid>
  <pubDate>${pubDate}</pubDate>
  <description>${escapeXml(post.data.description)}</description>
  ${categories}
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(`${SITE_NAME} Writing`)}</title>
  <link>${absoluteUrl('/blog/')}</link>
  <description>${escapeXml(SITE_DESCRIPTION)}</description>
  <language>en</language>
  <lastBuildDate>${latestDate.toUTCString()}</lastBuildDate>
  ${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
    },
  });
}
