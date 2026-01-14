export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: [],

  css: ['~/assets/css/main.css'],

  // SEO & Meta
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'git-wayback - Visualize GitHub Repository Evolution',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Explore and visualize the evolution of any GitHub repository. See commits, contributors, and how projects grow over time.',
        },
        { name: 'author', content: 'git-wayback' },
        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'git-wayback' },
        {
          property: 'og:title',
          content: 'git-wayback - Visualize GitHub Repository Evolution',
        },
        {
          property: 'og:description',
          content:
            'Explore and visualize the evolution of any GitHub repository. See commits, contributors, and how projects grow over time.',
        },
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        {
          name: 'twitter:title',
          content: 'git-wayback - Visualize GitHub Repository Evolution',
        },
        {
          name: 'twitter:description',
          content:
            'Explore and visualize the evolution of any GitHub repository. See commits, contributors, and how projects grow over time.',
        },
        // SEO
        {
          name: 'keywords',
          content:
            'github, repository, visualization, git history, commits, open source, developer tools',
        },
        { name: 'robots', content: 'index, follow' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'canonical', href: 'https://git-wayback.dev' },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  // Ensure SPA-like navigation
  router: {
    options: {
      scrollBehaviorType: 'smooth',
    },
  },

  // SSR for SEO, but hydrate for SPA behavior
  ssr: true,

  // Prerender static pages for better SEO
  routeRules: {
    '/': { prerender: true },
  },

  // Nitro optimizations
  nitro: {
    prerender: {
      crawlLinks: true,
    },
    compressPublicAssets: true,
  },
})
