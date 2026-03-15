---
sidebar_position: 2
title: Production Mode
---

# Production Mode

The `MODE` environment variable controls security-related behavior in InstaCRUD. This guide explains the differences between modes and what to configure before going live.

---

## Configuration

Set the mode in your `.env` file:

```bash
# === Mode ===
MODE="test"  # prod | test
```

---

## Differences Between Modes

| Feature | `MODE="test"` | `MODE="prod"` |
|---------|---------------|---------------|
| Rate Limiting | Disabled | Enabled |
| HSTS Header | Not sent | Enabled (`max-age=31536000`) |

### Rate Limiting

In production mode, authentication endpoints are rate-limited to prevent brute force attacks:

- **Sign in / Sign up**: 5 requests per minute per IP
- **AI endpoints**: 20 requests per minute per user

Rate limiting is disabled in test mode to allow automated tests to run without restrictions.

### HSTS Header

In production mode, the `Strict-Transport-Security` header is sent with all responses:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

This instructs browsers to only connect via HTTPS for one year.

---

## Enabling Production Mode

Before switching to `MODE="prod"`, ensure the following prerequisites are met:

### 1. HTTPS Configuration

The HSTS header tells browsers to only connect via HTTPS. If HTTPS is not properly configured, users will be unable to access your site.

:::warning
Setting `MODE="prod"` without HTTPS enabled will cause connection failures. The HSTS header instructs browsers to refuse non-HTTPS connections for one year.
:::

### 2. Valid SSL Certificate

Use a valid certificate from a trusted Certificate Authority:

- **Let's Encrypt** (free, automated)
- Commercial CA certificates
- Cloud provider managed certificates (AWS ACM, GCP managed SSL)

Self-signed certificates will cause browser warnings and should not be used in production.

### 3. Reverse Proxy Configuration

If using nginx, Caddy, or similar reverse proxy, ensure:

- SSL termination is configured correctly
- Headers are forwarded properly (`X-Forwarded-For`, `X-Forwarded-Proto`)
- The `ProxyHeadersMiddleware` in InstaCRUD will read these headers

---

## Production Checklist

Before going live, verify the following:

### Security Configuration

- [ ] `MODE="prod"` is set in `.env`
- [ ] HTTPS is configured and working
- [ ] SSL certificate is valid and not self-signed
- [ ] `SECRET_KEY` is set to a strong, unique value (not the default)

### Access Control

- [ ] `CORS_ALLOW_ORIGINS` is restricted to your domains (not `*`)
- [ ] Database credentials are secure (not default `test:test`)

### Bot Protection

- [ ] Cloudflare Turnstile is configured (`TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`)

### OAuth (if using social login)

- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured
- [ ] `MS_CLIENT_ID` and `MS_CLIENT_SECRET` are configured
- [ ] OAuth redirect URIs match your production domain

### Email (if using email features)

- [ ] `EMAIL_ENABLED=true`
- [ ] `EMAIL_DRIVER=brevo` (not `file`)
- [ ] `BREVO_API_KEY` is configured
- [ ] `EMAIL_FROM_ADDRESS` uses your verified domain

---

## Verifying Production Mode

After enabling production mode, verify:

1. **HTTPS works**: Navigate to `https://yourdomain.com` and confirm no certificate errors

2. **HSTS header present**: Check response headers in browser DevTools:
   ```
   Strict-Transport-Security: max-age=31536000; includeSubDomains
   ```

3. **Rate limiting active**: Attempt multiple rapid sign-in requests and confirm you receive a 429 (Too Many Requests) response after 5 attempts

---

## Troubleshooting

### Users cannot access the site after enabling prod mode

**Cause**: HSTS was enabled without proper HTTPS configuration.

**Solution**:
1. Configure HTTPS properly
2. Users may need to clear their browser's HSTS cache or wait for the cached entry to expire
3. In Chrome, visit `chrome://net-internals/#hsts` and delete the domain entry

### Rate limiting blocks legitimate users

**Cause**: Multiple users behind the same IP (corporate NAT, VPN).

**Solution**: Consider implementing user-based rate limiting for authenticated endpoints, which is already configured in InstaCRUD for AI endpoints.

---

## Summary

Production mode enables:

- Rate limiting on authentication endpoints
- HSTS header for HTTPS enforcement

Always ensure HTTPS is properly configured before enabling production mode to avoid locking users out of your application.
