import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost:3000", "10.199.125.221", "10.199.125.221:3000"],
  devIndicators: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    agentUpgrade: "security",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.skywear.in" }],
        destination: "https://skywear.in/:path*",
        permanent: true,
      },
      {
        source: "/products",
        destination: "/shop",
        permanent: true,
      },
      {
        // Only page slugs are redirected; product assets under /products/*.webp must load.
        source: "/products/:slug([^.]+)",
        destination: "/product/:slug",
        permanent: true,
      },
      {
        source: "/dashboard",
        destination: "/account",
        permanent: false,
      },
      {
        source: "/dashboard/wallet",
        destination: "/wallet",
        permanent: false,
      },
      {
        source: "/dashboard/orders",
        destination: "/account/orders",
        permanent: false,
      },
      {
        source: "/dashboard/referrals",
        destination: "/account/referrals",
        permanent: false,
      },
      {
        source: "/dashboard/payouts",
        destination: "/wallet",
        permanent: false,
      },
      {
        source: "/dashboard/profile",
        destination: "/account/settings",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/(banners|mockups|products)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.razorpay.com")',
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            // Only anti-embedding/baseline directives; scripts stay untouched so Razorpay checkout keeps working.
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=3600",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
