import './globals.css'
import type { Metadata, Viewport } from 'next'
import React from 'react'

export const metadata: Metadata = {
  title: 'One Piece Proxy Print',
  description: 'Professional proxy printing tool for One Piece Trading Card Game cards',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
