---
sidebar_position: 2
title: VPS Deployment
---

# VPS Deployment with Let's Encrypt

Deploy InstaCRUD to a Virtual Private Server (VPS) with nginx reverse proxy and automatic SSL certificates from Let's Encrypt.

---

## Overview

This setup uses:

- **Docker Compose** — Container orchestration
- **nginx** — Reverse proxy with SSL termination
- **Certbot** — Automatic Let's Encrypt certificate management
- **MongoDB** — Database (containerized)

:::note
The VPS configuration uses `.vps` suffixed files to keep local development configuration intact.
:::

:::tip Easiest Deployment Path
The most convenient way to deploy is to run the [GitHub Actions workflow](#cicd-with-github-actions) first, then stop nginx and initialize Let's Encrypt certificates as described in [Initialize SSL Certificates](#2-initialize-ssl-certificates). This approach requires almost no manual steps.
:::

---

## Prerequisites

- VPS with Ubuntu 22.04+ (OVHcloud, Linode, Hetzner, etc.)
- Domain name pointing to your VPS IP (e.g., `demo.instacrud.it`)
- Docker and Docker Compose installed

### Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

---

## Project Structure

The VPS deployment files are included in the repository:

```
instacrud/
├── docker-compose.vps.yml      # VPS/ngrok orchestration
├── .env.vps.example            # Environment template
├── backend/
│   └── Dockerfile              # Shared (local + VPS)
├── frontend/
│   ├── Dockerfile              # Local dev
│   └── Dockerfile.vps          # VPS production (with PM2)
├── nginx/
│   ├── Dockerfile              # Multi-mode nginx
│   ├── ssl.conf.template       # SSL config (uses DOMAIN env var)
│   ├── nossl.conf              # HTTP-only config (for ngrok)
│   ├── docker-entrypoint.sh    # Config selector based on SSL_ENABLED
│   └── init-letsencrypt.sh     # Let's Encrypt initialization
└── data/
    └── certbot/                # Created on first run
        ├── conf/
        └── www/
```

---

## Environment Variables

Add these to `/etc/environment` on your VPS:

```bash
# Deployment mode (SSL for VPS with Let's Encrypt)
SSL_ENABLED="true"
DOMAIN="demo.instacrud.it"
BASE_URL="https://demo.instacrud.it"
ADMIN_EMAIL="admin@yourdomain.com"  # Legacy: Let's Encrypt no longer sends expiration notices

# Required secrets
MONGO_PASSWORD="your-secure-mongodb-password"
SECRET_KEY="your-jwt-secret-key"

# OAuth (at least one recommended)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

MS_CLIENT_ID="your-microsoft-client-id"
MS_CLIENT_SECRET="your-microsoft-client-secret"
MS_TENANT_ID="common"

# Cloudflare Turnstile (anti-bot)
TURNSTILE_SITE_KEY="your-turnstile-site-key"
TURNSTILE_SECRET_KEY="your-turnstile-secret-key"

# Optional
EMAIL_ENABLED="true"
EMAIL_DRIVER="brevo"
BREVO_API_KEY="your-brevo-api-key"
DEEP_INFRA_KEY="your-deepinfra-key"
OPEN_REGISTRATION="false"
```

See `.env.vps.example` for a complete template.

Logout and login again for changes to take effect.

---

## Deployment Steps

### 1. Clone Repository

```bash
cd /opt
git clone https://github.com/esng-one/instacrud.git instacrud
cd instacrud
```

### 2. Initialize SSL Certificates

First, edit `nginx/init-letsencrypt.sh` and set `staging=1` to test with Let's Encrypt staging servers (avoids rate limits during testing):

```bash
staging=1  # Set to 1 for testing, 0 for production
```

Then run the script:

```bash
chmod +x nginx/init-letsencrypt.sh
./nginx/init-letsencrypt.sh
```

:::warning Important
**You MUST delete `./data/certbot` before switching from staging to production.** If you skip this step, certbot will create certificates in a new directory with a `-0001` suffix, causing nginx to fail because it looks for certificates in the original path.
:::

Once everything works:

1. Delete the certbot data: `sudo rm -rf ./data/certbot`
2. Set `staging=0` in `nginx/init-letsencrypt.sh`
3. Run the script again: `./nginx/init-letsencrypt.sh`

### 3. Start All Services

```bash
# Use --profile ssl to include certbot for automatic certificate renewal
docker compose -f docker-compose.vps.yml --profile ssl up -d
```

### 4. Initialize Database

**Create root admin user:**

```bash
docker compose -f docker-compose.vps.yml exec -it backend poetry run python -m init.init
```

This will prompt for admin email, password, and name.

**Initialize AI models and tiers:**

```bash
docker compose -f docker-compose.vps.yml exec backend poetry run python -m init.init_ai_models
```

**Load sample data (optional):**

:::warning
Do not run this in production. This creates a demo admin user with a known password (`admin@test.org` / `admin123`).
:::

```bash
docker compose -f docker-compose.vps.yml exec backend poetry run python -m init.init_mock_db
```

---

## Configuration Files

### docker-compose.vps.yml

Key services:

- **mongo** — MongoDB 8 with persistent volume
- **backend** — FastAPI on port 8000 (internal)
- **frontend** — Next.js on port 3000 (internal)
- **nginx** — Reverse proxy on ports 80/443
- **certbot** — SSL certificate management

### nginx/default.conf

Routes:

| Path | Destination |
|------|-------------|
| `/api/*` | backend:8000 |
| `/signin`, `/signup` | backend:8000 |
| `/oauth/*` | backend:8000 |
| `/docs`, `/openapi.json` | backend:8000 |
| `/_next/static/*` | frontend:3000 (cached) |
| `/*` | frontend:3000 |

---

## Maintenance

### View Logs

```bash
docker compose -f docker-compose.vps.yml logs -f backend
docker compose -f docker-compose.vps.yml logs -f frontend
docker compose -f docker-compose.vps.yml logs -f nginx
```

### Update Application

```bash
cd /opt/instacrud
git pull
docker compose -f docker-compose.vps.yml build
docker compose -f docker-compose.vps.yml up -d
```

### Certificate Renewal

Certbot automatically renews certificates. To manually renew:

```bash
docker compose -f docker-compose.vps.yml run --rm certbot renew
docker compose -f docker-compose.vps.yml exec nginx nginx -s reload
```

**Verify certificate validity:**

```bash
# Check the certificate served by nginx
echo | openssl s_client -connect demo.instacrud.it:443 2>/dev/null | openssl x509 -noout -dates -issuer

# Check certificate files on disk
sudo openssl x509 -in ./data/certbot/conf/archive/demo.instacrud.it/fullchain1.pem -noout -dates -issuer

# Test renewal (dry run, does not actually renew)
docker compose -f docker-compose.vps.yml run --rm certbot renew --dry-run
```

A valid Let's Encrypt certificate will show `issuer=...Let's Encrypt...` and `notAfter` ~90 days from issuance.

### Connect to MongoDB with a Client

You can connect to the MongoDB instance from your local machine using a GUI client (MongoDB Compass, Studio 3T, etc.) via an SSH tunnel.

**1. Open an SSH tunnel from your local machine:**

```bash
ssh -L 27017:127.0.0.1:27017 your-user@demo.instacrud.it
```

Keep this terminal open — it maintains the tunnel.

**2. Connect your client using:**

```
mongodb://instacrud:<MONGO_PASSWORD>@localhost:27017/
```

This works because the `mongo` service binds port 27017 to `127.0.0.1` on the VPS. The SSH tunnel forwards your local port 27017 to the VPS localhost, so no database port is exposed to the internet.

### Database Backup

```bash
docker compose -f docker-compose.vps.yml exec mongo mongodump \
  -u instacrud -p "$MONGO_PASSWORD" --authenticationDatabase admin \
  --out /data/db/backup
```

---

## Troubleshooting

### Check service status

```bash
docker compose -f docker-compose.vps.yml ps
```

### Verify nginx config

```bash
docker compose -f docker-compose.vps.yml exec nginx nginx -t
```

### Test backend connectivity

```bash
curl https://your-domain.com/api/v1/heartbeat
```

A `401 Unauthorized` with `{"detail":"Authorization token required"}` is a positive result — it means nginx is routing to the backend correctly (the endpoint requires authentication).

---

## GitHub Environment Setup

The repository includes `.github/init_gh.sh`, a script that creates the `vps` GitHub Actions environment and populates all variables and secrets in one shot.

**Why this is best practice:**
- Keeps configuration as code — reviewable, diffable, and repeatable across forks or new team members
- Variables and secrets are separated cleanly: non-sensitive config in variables (visible in the UI), credentials in secrets (masked in logs)
- Eliminates manual click-through in GitHub settings, reducing the risk of misconfiguration or missed values

**How to use it:**

```bash
# 1. Authenticate with GitHub CLI
gh auth login

# 2. Run the script (defaults to esng-one/instacrud)
bash .github/init_gh.sh

# Or target a different repo (e.g. your own fork)
REPO=your-username/instacrud bash .github/init_gh.sh
```

The script ships with dummy placeholder values (`your-vps-password`, `your-mongo-password`, etc.). Replace them with real values before running, or update them manually in your repo under **Settings → Environments → vps** afterwards.

---

## CI/CD with GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/vps.yml`) for automated deployments.

### Trigger

- **Release tags only** — Runs on full semantic version tags (`1.0.0`, `2.1.3`) but ignores pre-releases (`1.0.0-rc1`, `1.0.0-beta`)
- **Manual trigger** — Can also be triggered manually via `workflow_dispatch`

### Smart Installation

The workflow automatically installs dependencies only if they're not already present:

- **Git** — Installs if not found
- **Docker** — Installs via official script if not found
- **Docker Compose plugin** — Installs if not found

### Repository Handling

- **Existing installation** — If `/opt/instacrud` exists, fetches and checks out the tag
- **Fresh installation** — If not exists, clones the repository and checks out the tag

### GitHub Secrets

Configure these secrets in your repository settings (**Settings → Secrets and variables → Actions → Secrets**):

| Secret | Required | Description |
|--------|----------|-------------|
| `VPS_HOST` | ✅ | VPS IP address or hostname |
| `VPS_USERNAME` | ✅ | SSH username |
| `VPS_PASSWORD` | ✅ | SSH password |
| `VPS_PORT` | | SSH port (defaults to 22) |
| `GH_PAT` | ✅ | GitHub Personal Access Token with `repo` scope ([create one](https://github.com/settings/tokens)) |
| `SSL_ENABLED` | ✅ | Set to `true` for Prod-ready VPS with SSL (defaults to `false`) |
| `DOMAIN` | ✅ | Domain name without protocol (e.g., `demo.instacrud.it`) |
| `ADMIN_EMAIL` | | Legacy: Let's Encrypt no longer sends expiration notices |
| `MONGO_PASSWORD` | ✅ | MongoDB password |
| `SECRET_KEY` | ✅ | JWT secret key |
| `GOOGLE_CLIENT_ID` | | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | | Google OAuth secret |
| `MS_CLIENT_ID` | | Microsoft OAuth client ID |
| `MS_CLIENT_SECRET` | | Microsoft OAuth secret |
| `MS_TENANT_ID` | | Microsoft tenant ID |
| `TURNSTILE_SITE_KEY` | | Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | | Cloudflare Turnstile secret |
| `EMAIL_ENABLED` | | Enable email (`true`/`false`) |
| `EMAIL_DRIVER` | | Email driver (e.g., `brevo`) |
| `BREVO_API_KEY` | | Brevo API key |
| `DEEP_INFRA_KEY` | | DeepInfra API key for AI features |
| `OPEN_REGISTRATION` | | Allow open registration (`true`/`false`) |

### Triggering a Deployment

Create and push a release tag:

```bash
git tag 1.0.0
git push origin 1.0.0
```

The workflow will automatically deploy to your VPS.

---

## References

- [nginx-certbot](https://github.com/wmnnd/nginx-certbot) — Boilerplate for nginx with Let's Encrypt on Docker Compose
- [Next.js Docker PM2 nginx Tutorial](https://github.com/steveholgado/nextjs-docker-pm2-nginx/blob/master/TUTORIAL.md) — Docker setup for Next.js with PM2 and nginx
- [nginx for Next.js](https://steveholgado.com/nginx-for-nextjs/) — nginx configuration patterns for Next.js (defunct)

---

## Summary

This VPS deployment provides:

- Automatic HTTPS with Let's Encrypt
- nginx reverse proxy for routing
- Containerized MongoDB with persistent storage
- Automatic certificate renewal
- Production-ready logging configuration
- Environment-based secrets management