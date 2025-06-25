import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Lixx',
  tagline: '✨ 在代码与文字间编织梦想，用技术点亮生活的每一个瞬间',
  favicon: 'img/lixx-favicon.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://www.lixx.cn',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Lixxcn', // Usually your GitHub org/user name.
  projectName: 'lixxcn.github.io', // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/Lixxcn/lixxcn.github.io/tree/main/',
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/Lixxcn/lixxcn.github.io/tree/main/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      // title: 'Lixx',
      logo: {
        alt: 'Lixx Logo',
        src: 'img/Lixx_Blog_day_1.png',
        srcDark: 'img/Lixx_Blog_dark_1.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: '知识库',
        },
        { to: '/blog', label: '随想录', position: 'left' },
        { to: '/about', label: '自画像', position: 'left' },
        {
          href: 'https://github.com/Lixxcn',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '知识库',
          items: [
            {
              label: '知识库入口',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: '社交',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/Lixxcn',
            },
          ],
        },
        {
          title: '更多',
          items: [
            {
              label: '随想录',
              to: '/blog',
            },
            {
              label: '自画像',
              to: '/about',
            },
            {
              label: '网站源码',
              href: 'https://github.com/Lixxcn/lixxcn.github.io',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Lixx. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    algolia: {
      // Algolia 提供的应用 ID
      appId: '1MKJ9P3XPH',

      // 公共 API 密钥：可以安全地提交
      apiKey: '3bc6479ab7c3748ea66abf06bfa1abbc',

      indexName: 'lixx',

      // 可选：请参阅下面的文档部分
      contextualSearch: true,

      // 可选：指定在哪些域上导航应通过 window.location 而不是 history.push 进行。当我们的 Algolia 配置抓取多个文档站点并且我们希望使用 window.location.href 导航到它们时，这很有用。
      externalUrlRegex: 'external\\.com|domain\\.com',

      // 可选：替换来自 Algolia 的项目 URL 的部分内容。当对使用不同 baseUrl 的多个部署使用相同的搜索索引时很有用。您可以在 `from` 参数中使用正则表达式或字符串。例如：localhost:3000 与 myCompany.com/docs
      // replaceSearchResultPathname: {
      //   from: '/docs/', // or as RegExp: /\/docs\//
      //   to: '/',
      // },

      // 可选：Algolia 搜索参数
      searchParameters: {},

      // 可选：默认启用的搜索页面的路径（`false` 可禁用）
      searchPagePath: 'search',

      // 可选：是否在 Docsearch 上启用 insights 功能（默认为 `false`）
      insights: true,

      //... 其他 Algolia 参数
    },
  } satisfies Preset.ThemeConfig,

  plugins: [
    // [
    //   require.resolve("@easyops-cn/docusaurus-search-local"),
    //   /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
    //   ({
    //     // ... Your options.
    //     // `hashed` is recommended as long-term-cache of index file is possible.
    //     hashed: true,

    //     // For Docs using Chinese, it is recomended to set:
    //     language: ["en", "zh"],

    //     // If you're using `noIndex: true`, set `forceIgnoreNoIndex` to enable local index:
    //     forceIgnoreNoIndex: true,
    //   }),
    // ],
  ],

  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.24/dist/katex.min.css',
      type: 'text/css',
      integrity:
        'sha384-odtC+0UGzzFL/6PNoE8rX/SPcQDXBJ+uRepguP4QkPCm2LBxH3FA3y+fKSiJ+AmM',
      crossorigin: 'anonymous',
    },
  ],
};

export default config;
