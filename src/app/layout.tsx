import "./globals.css";
import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "One Piece TCG Tools",
  description: "Event Tracker & Proxy Print for One Piece Trading Card Game",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-white antialiased">
        <I18nProvider>
          <Navbar />
          <main>{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
