import type { Metadata } from "next";
import { Outfit } from 'next/font/google';
import './globals.css';
import 'katex/dist/katex.min.css';
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "InstaCRUD - AI Starter for Rapid Delivery",
  description: "MVP on Day One. Persistence, auth, and AI features pre-built. Ship fast with your favorite agentic coding tools.",
};

import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';

const outfit = Outfit({
  subsets: ["latin"],
});

// Inline script to apply theme before React hydrates (prevents flash of wrong theme)
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <SidebarProvider>{children}</SidebarProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { zIndex: 9999999 },
            }}
            containerStyle={{
              zIndex: 9999999,
              top: '90px',
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
