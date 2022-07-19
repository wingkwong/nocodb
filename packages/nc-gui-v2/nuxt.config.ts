import path from 'path'
import { defineNuxtConfig } from 'nuxt'
import vueI18n from '@intlify/vite-plugin-vue-i18n'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: ['@vueuse/nuxt', 'nuxt-windicss'],

  ssr: false,

  css: [
    'virtual:windi.css',
    'virtual:windi-devtools',
    'vuetify/lib/styles/main.sass',
    '~/assets/style/fonts.css',
    '~/assets/css/global.css',
    '~/assets/style/style.css',
    '~/assets/style.css',
    '~/assets/style-v2.scss',
  ],

  meta: {
    title: 'NocoDB',
    link: [
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: './favicon-32.png',
      },
    ],
    meta: [
      { charset: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        hid: 'description',
        name: 'description',
        content: process.env.npm_package_description || '',
      },
    ],
  },

  vite: {
    css: {
      preprocessorOptions: {
        less: {
          modifyVars: { 'primary-color': '#1348ba' },
          javascriptEnabled: true,
        },
      },
    },
    plugins: [
      vueI18n({
        include: path.resolve(__dirname, './lang'),
      }),
      Icons({
        autoInstall: true,
        compiler: 'vue3',
        defaultClass: 'nc-icon',
      }),
      Components({
        resolvers: [
          AntDesignVueResolver({
            importStyle: 'less',
          }),
        ],
      }),
    ],
    define: {
      'process.env.DEBUG': 'false',
    },
    server: {
      watch: {
        usePolling: true,
      },
    },
  },
  experimental: {
    reactivityTransform: true,
    viteNode: false,
  },
})
