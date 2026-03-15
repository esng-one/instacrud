---

sidebar_position: 4
title: Email Configuration
--------------------------

# Email Configuration (Hub)

InstaCRUD sends **transactional emails** for core system workflows. This page is the **central hub** for email setup and links to provider-specific guides when deeper configuration is required.

Use this page to:

* Understand **what emails InstaCRUD sends**
* Choose the **right email carrier**
* Configure **common environment variables**
* Find links to **provider-specific setup guides**

---

## What Emails InstaCRUD Sends

InstaCRUD uses email for:

* **User invitations** — inviting users to organizations
* **Password reset** — secure account recovery
* **System notifications** — important events and alerts

By default, email sending is disabled. To enable it, set:

```bash
EMAIL_ENABLED=true
```

---

## Supported Email Carriers

InstaCRUD supports multiple email carriers depending on your environment and scale.

| Carrier | Description                    | Typical Use                    |
| ------- | ------------------------------ | ------------------------------ |
| `file`  | Writes emails to local files   | Local development & testing    |
| `smtp`  | Sends via standard SMTP server | Production / self-hosted       |
| `gmail` | Sends via Gmail SMTP           | Personal projects / low volume |
| `brevo` | Sends via Brevo API            | Production / high volume       |

Choose **one carrier** using `EMAIL_CARRIER`.

---

## Quick Start (Development)

For local development, use the **file carrier**. No external services required.

```bash
EMAIL_ENABLED=true
EMAIL_CARRIER=file
EMAIL_DUMP_PATH=/tmp/instacrud_emails
EMAIL_FROM_ADDRESS=noreply@localhost
EMAIL_FROM_NAME="InstaCRUD Dev"
```

Emails will be written to files instead of being sent.

---

## Common Configuration (All Carriers)

These settings apply to **every email carrier**:

```bash
EMAIL_ENABLED=true
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME="InstaCRUD"
```

| Variable             | Description                    | Default                  |
| -------------------- | ------------------------------ | ------------------------ |
| `EMAIL_ENABLED`      | Enable / disable email sending | `false`                  |
| `EMAIL_FROM_ADDRESS` | Sender email address           | `noreply@yourdomain.com` |
| `EMAIL_FROM_NAME`    | Sender display name            | `InstaCRUD`              |

---

## Carrier Configuration Summary

Below is a **minimal reference** for each carrier. Follow the linked guides for full setup instructions.

### File Carrier

```bash
EMAIL_CARRIER=file
EMAIL_DUMP_PATH=/tmp/instacrud_emails
```

* Writes email content to files
* Best for development and testing

---

### SMTP Carrier

```bash
EMAIL_CARRIER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-api-key
SMTP_TLS=true
SMTP_SSL=false
```

* Works with SendGrid, Mailgun, SES, Postfix, etc.
* Recommended for self-hosted production

---

### Gmail Carrier

```bash
EMAIL_CARRIER=gmail
GMAIL_USERNAME=your.email@gmail.com
GMAIL_PASSWORD=your-16-char-app-password
```

* You must use a **Google App Password** — this is different from your regular Gmail password
* Google App Passwords are displayed as four groups of 4 characters (e.g., `abcd efgh ijkl mnop`).
  When pasting into `.env`, remove all spaces so it becomes a single 16-character string:
  `abcdefghijklmnop`
* Intended for testing or personal projects

**How to generate a Google App Password:**

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Go to **App passwords**
4. Select **Mail** as the app and your device, then click **Generate**
5. Copy the 16-character code (without spaces) into `GMAIL_PASSWORD`

---

### Brevo Carrier (Recommended for Production)

```bash
EMAIL_CARRIER=brevo
BREVO_API_KEY=xkeysib-your-api-key
```

Brevo requires additional setup (API keys, domain verification, deliverability tuning).

👉 **See full guide:** [Email with Brevo](./brevo-email)

---

## Email Templates

InstaCRUD includes HTML and plain-text email templates in:

```
backend/instacrud/mailer/templates/
├── invitation.html
├── invitation.txt
├── password_reset.html
└── password_reset.txt
```

### Customizing Templates

Templates use Python string formatting. Available variables depend on the email type:

**Invitation Email:**
- `{invite_url}` — Link to accept invitation
- `{organization_name}` — Inviting organization
- `{inviter_name}` — Person who sent invite

**Password Reset:**
- `{reset_url}` — Password reset link
- `{user_name}` — User's name

---

## Troubleshooting (General)

### Emails Not Sending

1. Verify `EMAIL_ENABLED=true`
2. Confirm `EMAIL_CARRIER` value
3. Restart backend after `.env` changes

### File Carrier Issues

* Check `EMAIL_DUMP_PATH` permissions
* Review backend logs for file paths

### SMTP / Gmail Issues

* Check ports (587 vs 465)
* Ensure credentials are correct

---

## Next Steps

* For production email with Brevo, continue to [Email with Brevo](./brevo-email)
* For custom providers, use the SMTP carrier
* Review templates before enabling email in production
