import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old 412studios.ca paths, so bookmarks and social links keep working after the switch.
  redirects() {
    return [
      { source: "/booking", destination: "/book", permanent: true },
      { source: "/booking/:path*", destination: "/book", permanent: true },
    ];
  },
};

export default nextConfig;
