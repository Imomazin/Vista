import type { NextConfig } from "next";
import { editorialPhotography } from "./src/lib/editorial-photos";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { remotePatterns: editorialPhotography.map(photo => ({ protocol: 'https' as const, hostname: 'images.unsplash.com', pathname: new URL(photo.path).pathname, search: new URL(photo.path).search })) },
  async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]}];},
};

export default nextConfig;
