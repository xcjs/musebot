import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme, DefaultThemeOptions } from '@vuepress/theme-default'
import { defineUserConfig, Theme } from 'vuepress'

export default defineUserConfig({
  bundler: viteBundler(),
  lang: 'en-US',
  // @ts-expect-error An empty base is valid despite the type information.
  base: '',
  title: 'Musebot',
  description: 'Generative AI - In _Your_ Discord',
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
  } as DefaultThemeOptions) as Theme,
});
