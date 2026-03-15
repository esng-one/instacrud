// @ts-check
import { themes as prismThemes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Instacrud Docs',
  tagline: 'Project documentation',

  future: {
    v4: true,
  },

  // ===============================
  // Cloudflare Pages configuration
  // ===============================
  url: 'https://instacrud-docs.pages.dev',
  baseUrl: '/',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  favicon: 'img/favicon.ico',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: '',
      logo: {
        alt: 'Instacrud Logo',
        src: 'img/logo.png',
        srcDark: 'img/logo-dark.png',
      },
      items: [
        {
          href: 'https://instacrud.it',
          label: 'Why It’s Different?',
          position: 'left',
          className: 'navbar__link--no-icon',
        },
        {
          href: 'https://demo.instacrud.it',
          label: 'Live Demo',
          position: 'left',
          className: 'navbar__link--no-icon',
        },
        {
          href: 'https://esng.one',
          label: 'ESNG One',
          position: 'left',
          className: 'navbar__link--no-icon',
        },
        {
          href: 'https://github.com/esng-one/instacrud',
          label: 'instacrud',
          position: 'right',
          className: 'header-github-link',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `<div class="footer__row"><span class="footer__copyright-text">© ${new Date().getFullYear()} ESNG One LLC. All rights reserved</span><a href="https://www.linkedin.com/company/esng-one" target="_blank" rel="noopener noreferrer" class="footer__linkedin"><svg width="17" height="16" viewBox="0 0 17 16" fill="currentColor"><path d="M15.2196 0H1.99991C1.37516 0 0.875366 0.497491 0.875366 1.11936V14.3029C0.875366 14.8999 1.37516 15.4222 1.99991 15.4222H15.1696C15.7943 15.4222 16.2941 14.9247 16.2941 14.3029V1.09448C16.3441 0.497491 15.8443 0 15.2196 0ZM5.44852 13.1089H3.17444V5.7709H5.44852V13.1089ZM4.29899 4.75104C3.54929 4.75104 2.97452 4.15405 2.97452 3.43269C2.97452 2.71133 3.57428 2.11434 4.29899 2.11434C5.02369 2.11434 5.62345 2.71133 5.62345 3.43269C5.62345 4.15405 5.07367 4.75104 4.29899 4.75104ZM14.07 13.1089H11.796V9.55183C11.796 8.7061 11.771 7.58674 10.5964 7.58674C9.39693 7.58674 9.222 8.53198 9.222 9.47721V13.1089H6.94792V5.7709H9.17202V6.79076H9.19701C9.52188 6.19377 10.2466 5.59678 11.3711 5.59678C13.6952 5.59678 14.12 7.08925 14.12 9.12897V13.1089H14.07Z"/></svg><span>esng-one</span></a></div>`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  },
};

export default config;
