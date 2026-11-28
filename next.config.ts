import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // VisTa Spider renders with open-source Playwright and Chromium: keep them out of the bundle and
  // ship the compressed Chromium build with the page-crawling route.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: { "/api/intel/pages": ["./node_modules/@sparticuz/chromium/bin/**"] },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [480, 640, 828, 1080, 1280, 1600, 1920],
    imageSizes: [96, 160, 256, 384],
    qualities: [72, 75, 78, 80],
    minimumCacheTTL: 2678400,
  },
  async headers(){return [
    {source:'/web-images/:path*',headers:[{key:'Cache-Control',value:'public, max-age=604800, stale-while-revalidate=86400'}]},
    {source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]},
  ];},
};

export default nextConfig;
