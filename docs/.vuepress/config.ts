import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'
import { searchPlugin } from '@vuepress/plugin-search';
import { defineUserConfig, PluginConfig } from 'vuepress'

export default defineUserConfig({
  bundler: viteBundler(),
  lang: 'en-US',
  title: 'Musebot',
  description: 'Generative AI for Discord',
  theme: defaultTheme({
  logo: '/images/musebot.svg',
  navbar: [
      {
    text: 'Introduction',
    link: 'introduction.md'
      },
      {
    text: 'User Guide',
    prefix: 'user-guide',
    children: [
          '01-getting-started.md',
          '02-chat.md',
          '03-media.md',
          '04-memory-and-privacy.md',
          '05-faq.md'
    ]
      },
      {
    text: 'Setup',
    prefix: 'musebot',
    children: [
          '01-discord.md',
          '02-configuration.md'
    ]
      },
      {
    text: 'Chat',
    prefix: 'chat',
    children: [
          '01-ollama.md',
          '02-long-term-memory.md'
    ]
      },
      {
    text: 'Media',
    prefix: 'media',
    children: [
          '01-swarm-ui.md'
    ]
      }
  ],
  sidebarDepth: 6
  }),
  plugins: [
  searchPlugin({
      locales: {
    '/': {
          placeholder: 'Search',
    }
      }
  }),
  ] as PluginConfig,

  head: [
  // Link-sharing preview. og:image must be an absolute URL; scrapers do not
  // resolve relative paths. The card is a flattened 1200x630 PNG rather than
  // logo.png, which is square and has an alpha channel that platforms
  // composite unpredictably.
  ['meta', { property: 'og:type', content: 'website' }],
  ['meta', { property: 'og:site_name', content: 'Musebot' }],
  ['meta', { property: 'og:title', content: 'Musebot' }],
  ['meta', { property: 'og:description', content: 'Generative AI for Discord' }],
  ['meta', { property: 'og:url', content: 'https://musebot.docs.xcjs.com/' }],
  ['meta', { property: 'og:image', content: 'https://musebot.docs.xcjs.com/images/og-card.png' }],
  ['meta', { property: 'og:image:type', content: 'image/png' }],
  ['meta', { property: 'og:image:width', content: '1200' }],
  ['meta', { property: 'og:image:height', content: '630' }],
  ['meta', { property: 'og:image:alt', content: 'The Musebot robot mark beside the wordmark Musebot and the tagline Generative AI for Discord' }],
  ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ['meta', { name: 'twitter:title', content: 'Musebot' }],
  ['meta', { name: 'twitter:description', content: 'Generative AI for Discord' }],
  ['meta', { name: 'twitter:image', content: 'https://musebot.docs.xcjs.com/images/og-card.png' }],
  ['meta', { name: 'theme-color', content: '#2A2E3E' }],
  [
      "script",
      {},
      `\
         (function () {
          const script = document.createElement('script');
          script.defer = true;
          script.src = 'https://analytics.xcjs.com/script.js';
          script.setAttribute('data-website-id', 'a4a304d1-472e-4aa6-9a45-220c8c736fb5');
          document.head.appendChild(script);
    })();
      `,
  ],
  ]
});
