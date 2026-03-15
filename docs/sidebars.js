// @ts-check

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const sidebars = {
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },

    {
      type: 'category',
      label: 'Getting Started',
      collapsible: true,
      collapsed: true,
      items: [
        'getting-started/installation',
        'getting-started/project-structure',
        'getting-started/using-bruno',
        'getting-started/ollama-local-ai',
      ],
    },

    {
      type: 'category',
      label: 'User Guide',
      collapsible: true,
      collapsed: false,
      items: [
        'user-guide/user-guide-overview',
        'user-guide/clients',
        'user-guide/projects',
        'user-guide/contacts-addresses',
        'user-guide/documents',
        'user-guide/calendar',
        'user-guide/ai-assistant',
        'user-guide/search',
        'user-guide/administration',
        'user-guide/ai-models-tiers',
        'user-guide/profile',
      ],
    },

    {
      type: 'category',
      label: 'Deployment',
      collapsible: true,
      collapsed: true,
      items: [
        'deployment/local-ngrok',
        'deployment/vps',
        'deployment/google-cloud',
      ],
    },

    {
      type: 'category',
      label: 'Service Configuration',
      collapsible: true,
      collapsed: true,
      items: [
        'service-configuration/oauth-google',
        'service-configuration/oauth-microsoft',
        'service-configuration/turnstile',

        {
          type: 'category',
          label: 'Email',
          collapsible: true,
          collapsed: true,
          items: [
            'service-configuration/email-configuration',
            'service-configuration/brevo-email',
          ],
        },

        'service-configuration/google-analytics',
      ],
    },

    {
      type: 'category',
      label: 'Development',
      collapsible: true,
      collapsed: true,
      items: [
        'development/fork-and-update',
        'development/contribution-rules',
        'development/creating-entity',
        'development/vibecoding-best-practices',
        'development/auto-testing',
        'development/screenshots-for-docs',
        'development/python-only-server',
        'development/using-ai-framework',
      ],
    },

    {
      type: 'category',
      label: 'Security',
      collapsible: true,
      collapsed: true,
      items: [
        'security/overview',
        'security/production-mode',
        'security/mongo-url-encryption',
      ],
    },
  ],
};

export default sidebars;
