import { getCollection } from 'astro:content';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '../lib/site';

function isoDate(date: Date) {
  return date.toISOString();
}

export async function GET() {
  const posts = (await getCollection('blog'))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const photos = (await getCollection('photos'))
    .filter((photo) => !photo.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const writingItems = posts.map((post) => {
    const url = absoluteUrl(`/blog/${post.id}/`);
    return {
      id: url,
      url,
      title: post.data.title,
      summary: post.data.description,
      content_text: post.data.description,
      date_published: isoDate(post.data.date),
      date_modified: isoDate(post.data.updated ?? post.data.date),
      tags: post.data.tags,
      image: post.data.cover ? absoluteUrl(post.data.cover) : undefined,
      _rapture: {
        type: 'writing',
        slug: post.id,
      },
    };
  });

  const galleryItems = photos.map((photo) => {
    const url = absoluteUrl(`/gallery/${photo.id}/`);
    return {
      id: url,
      url,
      title: photo.data.title,
      summary: `${photo.data.location} / ${photo.data.tone}`,
      content_text: (photo.body ?? '').trim() || `${photo.data.title}, ${photo.data.location}. ${photo.data.tone}.`,
      date_published: isoDate(photo.data.date),
      date_modified: isoDate(photo.data.date),
      image: absoluteUrl(photo.data.src),
      _rapture: {
        type: 'gallery',
        slug: photo.id,
        location: photo.data.location,
        tone: photo.data.tone,
        width: photo.data.width,
        height: photo.data.height,
      },
    };
  });

  const items = [...writingItems, ...galleryItems].sort((a, b) => {
    const aDate = Date.parse(a.date_modified ?? a.date_published);
    const bDate = Date.parse(b.date_modified ?? b.date_published);
    return bDate - aDate;
  });

  const payload = {
    version: 'https://jsonfeed.org/version/1.1',
    title: SITE_NAME,
    home_page_url: absoluteUrl('/'),
    feed_url: absoluteUrl('/feed.json'),
    description: SITE_DESCRIPTION,
    language: 'en',
    icon: absoluteUrl('/icon-512.png'),
    favicon: absoluteUrl('/favicon.png'),
    items,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
    },
  });
}
