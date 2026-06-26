import { getCollection } from 'astro:content';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '../lib/site';
import { getReadingTime } from '../lib/readingTime';
import { photoThumbSrc } from '../lib/photoImages';

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

  const writing = posts.map((post) => ({
    type: 'writing',
    slug: post.id,
    title: post.data.title,
    description: post.data.description,
    url: absoluteUrl(`/blog/${post.id}/`),
    publishedAt: isoDate(post.data.date),
    updatedAt: isoDate(post.data.updated ?? post.data.date),
    tags: post.data.tags,
    readingTime: getReadingTime(post.body ?? ''),
    cover: post.data.cover ? absoluteUrl(post.data.cover) : null,
    coverAlt: post.data.coverAlt ?? null,
  }));

  const gallery = photos.map((photo) => ({
    type: 'gallery',
    slug: photo.id,
    title: photo.data.title,
    url: absoluteUrl(`/gallery/${photo.id}/`),
    image: absoluteUrl(photo.data.src),
    thumbnail: absoluteUrl(photoThumbSrc(photo)),
    width: photo.data.width,
    height: photo.data.height,
    aspectRatio: Number((photo.data.width / photo.data.height).toFixed(4)),
    location: photo.data.location,
    tone: photo.data.tone,
    alt: photo.data.alt ?? null,
    publishedAt: isoDate(photo.data.date),
  }));
  const latestContentDate = [...posts.map((post) => post.data.updated ?? post.data.date), ...photos.map((photo) => photo.data.date)]
    .sort((a, b) => b.valueOf() - a.valueOf())[0] ?? null;

  const payload = {
    site: {
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
    },
    updatedAt: latestContentDate ? isoDate(latestContentDate) : null,
    counts: {
      writing: writing.length,
      gallery: gallery.length,
      total: writing.length + gallery.length,
    },
    writing,
    gallery,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
