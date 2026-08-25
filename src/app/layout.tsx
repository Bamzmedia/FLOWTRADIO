import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEOTRADIO | Next-Gen Perpetuals",
  description: "Trade crypto perpetuals with zero gas fees and deep liquidity.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NEOTRADIO",
  },
};

export const viewport: Viewport = {
  themeColor: "#050B14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { LocalizationProvider } from "@/components/LocalizationContext";
import { WalletProvider } from "@/components/WalletContext";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <LocalizationProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </LocalizationProvider>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(
                function(registration) { console.log('ServiceWorker registration successful'); },
                function(err) { console.log('ServiceWorker registration failed: ', err); }
              );
            });
          }
        `}} />
      </body>
    </html>
  );
}
