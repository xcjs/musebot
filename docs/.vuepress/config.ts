import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'
import { slimsearchPlugin } from '@vuepress/plugin-slimsearch';
import { defineUserConfig, PluginConfig } from 'vuepress'

export default defineUserConfig({
  bundler: viteBundler(),
  lang: 'en-US',
  title: 'Musebot',
  description: 'Generative AI - In _Your_ Discord',
  head: [
    [
      'link', {
        rel: 'icon',
        href: '/images/musebot.jpg'
      }
    ]
  ],
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  theme: defaultTheme({
    logo: 'images/musebot.jpg',
    navbar: [
      {
        text: 'Musebot',
        link: '/',
      },
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    slimsearchPlugin({
      indexContent: true
    }),
  ] as PluginConfig
});
