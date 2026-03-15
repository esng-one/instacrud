# InstaCRUD Docs

Documentation site for [InstaCRUD](https://instacrud.it) — a multi-tenant SaaS starter with FastAPI, Next.js, and built-in AI capabilities.

Built with [Docusaurus 3](https://docusaurus.io/) and deployed to [docs.instacrud.it](https://docs.instacrud.it).

## What's Documented

| Section                  | Topics                                                  |
|--------------------------|---------------------------------------------------------|
| **Getting Started**      | Installation, project structure, creating entities       |
| **Deployment**           | Local/ngrok, VPS, Google Cloud                          |
| **Service Configuration**| OAuth (Google & Microsoft), Turnstile, email, analytics |
| **Security**             | Overview, production mode                               |
| **Development**          | Fork & update workflow, vibecoding best practices       |

## Local Development

```bash
npm install
npm start -- --host 0.0.0.0 --port 3002
```

The site will be available at `http://localhost:3002`. Changes to `/docs` are reflected live without restarting.

## Build

```bash
npm run build
```

Generates static output into `build/`, ready for any static hosting service.

## Structure

```
docs/
├── docs/                        # Markdown content (maps to site routes)
│   ├── intro.md                 # Landing page (routeBasePath: /)
│   ├── getting-started/
│   ├── deployment/
│   ├── service-configuration/
│   ├── security/
│   └── development/
├── src/                         # React components & custom CSS
├── static/                      # Images, favicon
├── docusaurus.config.js         # Site config
└── sidebars.js                  # Navigation
```

## Licensing

The documentation content is licensed under the [Creative Commons Attribution 4.0 International License](LICENSE).

InstaCRUD and the InstaCRUD logo are trademarks of ESNG One LLC.