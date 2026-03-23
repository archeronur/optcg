import type { Metadata, Viewport } from "next";
import "@/proxy-print/styles/proxy-print.css";

/** Proxy meta — mobil algılama sayfadaki useEffect ile (beforeInteractive yalnızca kök layout’ta desteklenir). */
export const metadata: Metadata = {
  title: "One Piece Proxy Print",
  description: "Professional proxy printing tool for One Piece Trading Card Game cards",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#ff8c00",
};

export default function ProxyPrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="proxy-print-root" className="proxy-print-root">
      {children}
    </div>
  );
}
