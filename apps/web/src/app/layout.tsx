import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { ThemeProvider } from '@/components/ThemeProvider';
import { GlobalFooter } from '@/components/GlobalFooter';
import { Geist, Geist_Mono, Fredoka } from 'next/font/google';
import './globals.css';

// Centralized viewport settings for consistent mobile behavior across all pages (helpful in MFS approach)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const fredoka = Fredoka({
  variable: '--font-fredoka',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Scribblitz',
  description: 'Real-time multiplayer drawing game',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col bg-gray-50 text-gray-900 dark:bg-[#1E1F22] dark:text-gray-100 transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex-1 overflow-hidden flex flex-col">{children}</div>
          <GlobalFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
