// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://mcp-tool-shop-org.github.io',
  base: '/world-forge',
  integrations: [
    starlight({
      title: 'World Forge',
      description: '2D world authoring studio handbook',
      favicon: '/favicon.svg',
      logo: {
        src: './src/assets/logo.png',
        alt: 'World Forge',
        replacesTitle: false,
      },
      defaultTheme: 'dark',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/mcp-tool-shop-org/world-forge' },
      ],
      head: [
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/world-forge/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://mcp-tool-shop-org.github.io/world-forge/og-image.jpg' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://mcp-tool-shop-org.github.io/world-forge/og-image.jpg' } },
      ],
      sidebar: [
        {
          label: 'Handbook',
          autogenerate: { directory: 'handbook' },
        },
      ],
      customCss: ['./src/styles/starlight-custom.css'],
      disable404Route: true,
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
