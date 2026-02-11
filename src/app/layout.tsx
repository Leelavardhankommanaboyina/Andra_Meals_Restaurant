import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ChunkLoadRecovery } from "@/components/providers/chunk-load-recovery";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const chunkRecoveryBootstrapScript = `
(() => {
  const KEY = 'andra-meals:chunk-load-recovery';
  const WINDOW_MS = 5 * 60 * 1000;

  const readState = () => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.source !== 'string' || typeof parsed.at !== 'number') {
        sessionStorage.removeItem(KEY);
        return null;
      }
      if (Date.now() - parsed.at > WINDOW_MS) {
        sessionStorage.removeItem(KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const writeState = (source) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ source, at: Date.now() }));
    } catch {}
  };

  const shouldHandle = (value) => {
    const text = String(value || '').toLowerCase();
    return (
      text.includes('/_next/static/chunks/') ||
      text.includes('chunkloaderror') ||
      text.includes('loading chunk') ||
      text.includes('failed to fetch dynamically imported module') ||
      text.includes('importing a module script failed')
    );
  };

  const attempt = (source) => {
    const normalized = String(source || '').trim();
    if (!normalized) return;
    const previous = readState();
    if (previous && previous.source === normalized) return;
    writeState(normalized);
    window.location.reload();
  };

  window.addEventListener('error', (event) => {
    const target = event.target;
    const source =
      (target && (target.src || target.href)) ||
      event.filename ||
      event.message ||
      '';

    if (shouldHandle(source)) {
      attempt(source);
    }
  }, true);
})();
`;

export const metadata: Metadata = {
  title: "Andra Meals - Restaurant Order Management",
  description: "Efficient restaurant order tracking and billing system",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Andra Meals",
  },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Script
          id="chunk-load-recovery-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: chunkRecoveryBootstrapScript }}
        />
        <ChunkLoadRecovery />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
