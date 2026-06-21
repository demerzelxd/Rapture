import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

const site = (process.env.PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rapture.example.com')).replace(/\/+$/, '');

export default defineConfig({
  site,
  integrations: [mdx()],
});
