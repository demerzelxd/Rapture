import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const imageSource = z.string().refine((value) => {
  if (value.startsWith('/')) return true;

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, 'Use an absolute public path such as /photos/frame.jpg or a full remote URL.');

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: imageSource.optional(),
    coverAlt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const photos = defineCollection({
  loader: glob({ base: './src/content/photos', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    location: z.string(),
    date: z.coerce.date(),
    src: imageSource,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    tone: z.string(),
    alt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, photos };
