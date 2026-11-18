import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0C10" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "SKYWEAR | Print On Demand Streetwear & Heavyweight Apparel",
  description: "240 GSM Super-Combed Heavyweight Oversized T-Shirts and Streetwear. Designed & Printed in India.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SKYWEAR",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "SKYWEAR",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
  },
};

import { ThemeProvider } from "@/context/ThemeContext";
import { SessionProvider } from "@/context/SessionContext";
import GlobalPushPrompt from "@/components/GlobalPushPrompt";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import MobileBottomNav from "@/components/MobileBottomNav";
import PwaManager from "@/components/PwaManager";
import TawkLiveChat from "@/components/TawkLiveChat";
import GsapPageTransition from "@/components/GsapPageTransition";
import { readCustomerSession, sanitizeCustomer } from "@/lib/server/auth";
import { ensureStateLoaded, readState } from "@/lib/server/store";
import type { CustomerAccount } from "@/data/rewardsEngine";
import { DEFAULT_SUPPORT, type SupportConfig } from "@/lib/support";

async function getInitialSession(): Promise<{
  loggedIn: boolean;
  customer: CustomerAccount | null;
  support?: SupportConfig | null;
}> {
  try {
    const customerId = await readCustomerSession();
    if (!customerId) return { loggedIn: false, customer: null, support: null };
    await ensureStateLoaded();
    let customer = readState().customers.find((entry) => entry.id === customerId) ?? null;
    if (!customer) {
      await ensureStateLoaded(true);
      customer = readState().customers.find((entry) => entry.id === customerId) ?? null;
    }
    if (!customer) return { loggedIn: false, customer: null, support: null };
    return { loggedIn: true, customer: sanitizeCustomer(customer), support: readState().support };
  } catch {
    return { loggedIn: false, customer: null, support: null };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loggedIn, customer, support } = await getInitialSession();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="light"
      className="h-full antialiased light"
    >
      <body className={`min-h-full flex flex-col font-mono bg-[var(--bg-zenin)] text-[var(--text-zenin)] transition-colors duration-200${loggedIn ? " has-bottom-nav" : ""}`}>
        <Script
          id="skywear-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var p = window.location.pathname;
                  if (!p.startsWith('/admin')) {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <ThemeProvider>
          <SessionProvider initialLoggedIn={loggedIn} initialCustomer={customer}>
            <MaintenanceBanner />
            <GsapPageTransition>
              {children}
            </GsapPageTransition>
            <MobileBottomNav />
            <GlobalPushPrompt customerId={customer?.id} />
            <PwaManager />
            <TawkLiveChat customer={customer} support={support} />
            <Toaster
              position="bottom-right"
              closeButton
              richColors={false}
              toastOptions={{
                className: "zenin-toast",
                duration: 3500,
              }}
            />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
