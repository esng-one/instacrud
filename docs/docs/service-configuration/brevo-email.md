---
sidebar_position: 5
title: Email with Brevo
---

# Email Service with Brevo

Configure transactional email delivery for InstaCRUD using Brevo (formerly Sendinblue).

---

## Production Setup (Brevo)

### Step 1: Create Brevo Account

1. Go to [Brevo](https://www.brevo.com/)
2. Sign up for an account
3. Complete email verification

### Step 2: Generate API Key

1. Go to **SMTP & API** in settings
2. Click **API Keys**
3. Click **Generate a new API key**
4. Name it (e.g., "InstaCRUD Production")
5. Copy the API key

### Step 3: Verify Sender Domain

For better deliverability:

1. Go to **Senders, Domains & Dedicated IPs**
2. Add your domain
3. Configure DNS records (SPF, DKIM, DMARC)
4. Verify the domain

### Step 4: Configure InstaCRUD

```bash
# Backend .env
EMAIL_ENABLED=true
EMAIL_CARRIER=brevo
BREVO_API_KEY=xkeysib-your-api-key-here
EMAIL_FROM_ADDRESS=noreply@your-domain.com
EMAIL_FROM_NAME=Your App Name
```

---

## Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `EMAIL_ENABLED` | Enable/disable email sending | `false` |
| `EMAIL_CARRIER` | `file` or `brevo` | `file` |
| `EMAIL_DUMP_PATH` | Directory for file carrier | OS temp dir |
| `BREVO_API_KEY` | Brevo API key | — |
| `EMAIL_FROM_ADDRESS` | Sender email address | `noreply@yourdomain.com` |
| `EMAIL_FROM_NAME` | Sender display name | `InstaCRUD` |

---

## Testing Email Delivery

### Send Test Email

Use the Brevo dashboard to send a test email:

1. Go to **Transactional > Email**
2. Click **Send a test**
3. Enter recipient and verify delivery

### Check Email Logs

View sent emails in Brevo:

1. Go to **Transactional > Logs**
2. Filter by date or email address
3. Check delivery status

---

## Troubleshooting

### Emails Not Sending

1. Verify `EMAIL_ENABLED=true`
2. Check `EMAIL_CARRIER=brevo`
3. Confirm API key is correct
4. Check Brevo logs for errors

### Emails Going to Spam

1. Verify sender domain with SPF/DKIM/DMARC
2. Use a professional from address (not gmail/outlook)
3. Avoid spam trigger words in content
4. Build sender reputation gradually

### "Invalid API Key" Error

1. Regenerate API key in Brevo
2. Ensure no whitespace in `.env`
3. Restart backend after changes

### Rate Limits

Brevo free tier limits:
- 300 emails/day
- Upgrade for higher limits

---

## Alternative: SMTP Configuration

If you prefer SMTP over API, you can modify the mailer to use SMTP settings. Brevo provides SMTP credentials in the dashboard under **SMTP & API**.

---

## Security Best Practices

1. **Secure API keys** — Use environment variables, never commit to code
2. **Verify domains** — Complete SPF/DKIM setup
3. **Monitor bounces** — High bounce rates hurt deliverability
4. **Use dedicated IPs** — For high-volume sending (paid feature)

---

## Summary

Email configuration requires:

1. Brevo account with verified domain
2. API key from Brevo dashboard
3. Environment variables in InstaCRUD
4. DNS records for email authentication (SPF, DKIM)
