---
sidebar_position: 6
title: Google Analytics
---

# Google Analytics

Add Google Analytics to track user behavior and application usage in your InstaCRUD frontend.

---

## Overview

Google Analytics provides insights into:

- **User traffic** — Page views, sessions, users
- **User behavior** — Navigation paths, time on page
- **Demographics** — Location, device, browser
- **Conversions** — Sign-ups, key actions

---

## Step 1: Create Google Analytics Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Admin** (gear icon)
3. Click **Create Property**
4. Configure:
   - **Property name**: InstaCRUD
   - **Reporting time zone**: Your timezone
   - **Currency**: Your currency
5. Click **Next** and complete setup

---

## Step 2: Create Data Stream

1. Select **Web** as platform
2. Enter your website URL
3. Name the stream (e.g., "InstaCRUD Frontend")
4. Click **Create stream**
5. Copy the **Measurement ID** (starts with `G-`)

---

## Step 3: Add to Frontend

### Option A: Next.js Script Component

Add to your root layout (`frontend/src/app/layout.tsx`):

```tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Option B: Using @next/third-parties

Install the package:

```bash
npm install @next/third-parties
```

Add to layout:

```tsx
import { GoogleAnalytics } from '@next/third-parties/google';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
      <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
    </html>
  );
}
```

---

## Step 4: Configure Environment Variable

Add to your frontend environment:

```bash
# .env.local or environment variables
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## Track Custom Events

Track specific user actions:

```tsx
// Helper function
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Usage examples
trackEvent('sign_up', 'authentication', 'email');
trackEvent('create_entity', 'crud', 'client');
trackEvent('export_data', 'feature', 'csv');
```

---

## Track Page Views (App Router)

For Next.js App Router, page views are tracked automatically. For custom tracking:

```tsx
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
        page_path: pathname + (searchParams?.toString() ? `?${searchParams}` : ''),
      });
    }
  }, [pathname, searchParams]);

  return null;
}
```

---

## Privacy Considerations

### Cookie Consent

For GDPR compliance, implement cookie consent before loading Analytics:

```tsx
// Only load GA after consent
const [consent, setConsent] = useState(false);

useEffect(() => {
  const hasConsent = localStorage.getItem('analytics_consent') === 'true';
  setConsent(hasConsent);
}, []);

// Conditionally render GA script
{consent && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}
```

### IP Anonymization

GA4 anonymizes IP addresses by default. For additional privacy:

```tsx
gtag('config', 'G-XXXXXXXXXX', {
  anonymize_ip: true,
});
```

---

## Debugging

### Real-Time Reports

1. Go to Analytics dashboard
2. Click **Reports > Realtime**
3. View active users and events

### Debug Mode

Enable debug mode in browser:

```tsx
gtag('config', 'G-XXXXXXXXXX', {
  debug_mode: true,
});
```

Or use the [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) Chrome extension.

---

## Environment-Specific Setup

### Development

Disable tracking in development:

```tsx
// Only track in production
if (process.env.NODE_ENV === 'production') {
  gtag('config', process.env.NEXT_PUBLIC_GA_ID);
}
```

### Staging

Use a separate property for staging to keep data clean:

```bash
# Staging
NEXT_PUBLIC_GA_ID=G-STAGING123

# Production
NEXT_PUBLIC_GA_ID=G-PROD456
```

---

## Common Events to Track

| Event | Category | When to Fire |
|-------|----------|--------------|
| `sign_up` | authentication | User registers |
| `login` | authentication | User signs in |
| `create_entity` | crud | Entity created |
| `search` | feature | Search performed |
| `export` | feature | Data exported |
| `error` | system | Error occurs |

---

## Summary

Google Analytics integration requires:

1. GA4 property with web data stream
2. Measurement ID in frontend environment
3. Script tag in root layout
4. Custom event tracking for key actions
5. Privacy compliance (cookie consent)
