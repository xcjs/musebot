import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'
import { slimsearchPlugin } from '@vuepress/plugin-slimsearch';
import { defineUserConfig, PluginConfig } from 'vuepress'

export default defineUserConfig({
  bundler: viteBundler(),
  lang: 'en-US',
  title: 'Musebot',
  description: 'Generative AI for Discord',
  head: [
    [
      'link', {
        rel: 'icon',
        href: '/images/musebot.jpg'
      }
    ]
  ],
  theme: defaultTheme({
    logo: '/images/musebot.jpg',
    navbar: [
      {
        text: 'Discord',
        link: '/integrations/discord/',
      },
      {
        text: 'Ollama',
        link: '/integrations/ollama/',
      },
      {
        text: 'SwarmUI',
        link: '/integrations/swarm-ui/',
      },
    ],
  }),
  plugins: [
    slimsearchPlugin({
      indexContent: true
    }),
  ] as PluginConfig
});
