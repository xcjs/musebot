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
        text: 'Integrations',
        prefix: 'integrations',
        children: [
          'discord.md',
          'ollama.md',
          'swarm-ui.md',
        ]
      }
    ],
  }),
  plugins: [
    searchPlugin({
      locales: {
        '/': {
          placeholder: 'Search',
        }
      }
    }),
  ] as PluginConfig
});
