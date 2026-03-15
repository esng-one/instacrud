---
sidebar_position: 3
title: Cloudflare Turnstile
---

# Protection with Cloudflare Turnstile

Protect InstaCRUD forms from bots and abuse using Cloudflare Turnstile — a privacy-friendly CAPTCHA alternative.

---

## Overview

Turnstile provides:

- **Bot protection** — Blocks automated attacks
- **Privacy-first** — No tracking or data collection
- **User-friendly** — Often invisible to legitimate users
- **Free tier** — Generous limits for most applications

---

## Step 1: Create Cloudflare Account

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Sign up or log in
3. Navigate to **Turnstile** in the sidebar

---

## Step 2: Add Site

1. Click **Add site**
2. Configure:
   - **Site name**: InstaCRUD
   - **Domains**: Add all domains where Turnstile will run
     ```
     localhost
     your-domain.com
     your-frontend.ngrok-free.app
     ```
   - **Widget mode**: Choose based on UX preference

### Widget Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Managed** | Cloudflare decides visibility | Recommended for most cases |
| **Non-interactive** | Always invisible | Best UX, may have lower security |
| **Invisible** | Challenge only when suspicious | Good balance |

3. Click **Create**

---

## Step 3: Get Keys

After creating the site, you'll receive:

- **Site Key** — Used in frontend (public)
- **Secret Key** — Used in backend (keep private)

---

## Step 4: Configure InstaCRUD

Add keys to your backend `.env` file:

```bash
# Cloudflare Turnstile
TURNSTILE_SITE_KEY=0x4AAAA...your-site-key
TURNSTILE_SECRET_KEY=0x4AAAA...your-secret-key
TURNSTILE_MODE=normal
```

### Mode Options

| Value | Description |
|-------|-------------|
| `normal` | Show visible widget |
| `invisible` | Widget hidden, challenges shown when needed |

---

## How It Works

### Frontend Flow

1. User loads sign-in/sign-up page
2. Turnstile widget renders (visible or invisible)
3. Widget generates a token on successful verification
4. Token is submitted with the form

### Backend Flow

1. Backend receives form data + Turnstile token
2. Token is verified against Cloudflare API
3. If valid, request proceeds
4. If invalid, request is rejected

---

## Protected Endpoints

InstaCRUD validates Turnstile on these endpoints when enabled:

- `/signin` — User sign-in
- `/signup` — User registration
- Password reset flows

---

## Testing

### Development Mode

For local testing, use Cloudflare's test keys:

```bash
# Always passes
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# Always fails
TURNSTILE_SITE_KEY=2x00000000000000000000AB
TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AB

# Forces interactive challenge
TURNSTILE_SITE_KEY=3x00000000000000000000FF
TURNSTILE_SECRET_KEY=3x0000000000000000000000000000000AA
```

### Disabling Turnstile

To disable Turnstile entirely (development only):

```bash
# Remove or leave empty
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

When both keys are empty, Turnstile verification is skipped.

---

## Troubleshooting

### Widget Not Appearing

- Verify domain is added to Turnstile site configuration
- Check browser console for JavaScript errors
- Ensure site key is correct

### Verification Failing

- Confirm secret key is correct
- Check that token hasn't expired (tokens valid for ~300 seconds)
- Verify domain matches configuration

### "Invalid Hostname" Error

- Add all domains to Turnstile configuration:
  - `localhost` for local development
  - ngrok domains for tunnel testing
  - Production domain

---

## Security Considerations

1. **Never expose secret key** — Only use in backend
2. **Validate server-side** — Never trust client-only validation
3. **Monitor analytics** — Review Turnstile dashboard for suspicious patterns
4. **Rate limiting** — Combine with rate limiting for defense in depth

---

## Summary

Turnstile configuration requires:

1. Cloudflare account with Turnstile site
2. Site key (frontend) and secret key (backend)
3. All domains added to Turnstile configuration
4. Environment variables in InstaCRUD
