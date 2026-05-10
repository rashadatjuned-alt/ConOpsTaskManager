import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'ConOps Tasker',
  description: 'Team Task & Project Manager',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
        {/* Prevent theme flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('conops-theme');
            if (t === 'dark') document.documentElement.classList.add('dark');
          })();
        `}} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
