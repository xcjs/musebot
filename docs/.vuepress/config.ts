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
    logo: '/images/musebot.jpg',
    navbar: [
      {
        text: 'Introduction',
        link: 'introduction.md'
      },
      {
        text: 'Musebot',
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
          '01-ollama.md'
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
    [
      "script",
      {},
      `\
         (function () {
          const script = document.createElement('script');
          script.defer = true;
          script.src = 'https://analytics.xcjs.com/script.js';
          script.setAttribute('data-website-id', 'f4568a0e-2305-4fcf-8efe-43bca77cbb2c');
          document.head.appendChild(script);
        })();
      `,
    ],
  ]
});
