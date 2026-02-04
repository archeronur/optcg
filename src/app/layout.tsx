import './globals.css'
import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import React from 'react'

export const metadata: Metadata = {
  title: 'One Piece Proxy Print',
  description: 'Professional proxy printing tool for One Piece Trading Card Game cards',
  themeColor: '#ff8c00',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {/* Cloudflare Pages: Early mobile detection script - runs before hydration */}
        <Script
          id="mobile-detection"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                function detectMobile() {
                  const width = window.innerWidth;
                  const isTouchDevice = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
                  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
                  const isMobile = width <= 768 || (isTouchDevice && isMobileUserAgent && width <= 1024);
                  
                  if (isMobile) {
                    document.documentElement.classList.add('is-mobile');
                    if (document.body) {
                      document.body.classList.add('is-mobile');
                    }
                  }
                }
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', detectMobile);
                } else {
                  detectMobile();
                }
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  )
}
