import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: we intentionally do NOT turn on `cacheComponents`. Almost every
  // PopSwap page depends on who is logged in, so the classic "pages are
  // rendered fresh on each request" model is simpler and fits better.

  images: {
    // Allow <Image> to load photos from Supabase Storage public buckets.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
