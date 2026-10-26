import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old 412studios.ca paths, so bookmarks and social links keep working after the switch.
  redirects() {
    return [
      { source: "/booking", destination: "/book", permanent: true },
      { source: "/booking/:path*", destination: "/book", permanent: true },
      // The admin dashboard is still the old site, which lives on at admin.412studios.ca. Temporary
      // redirect so it can change again once this site grows an admin of its own.
      { source: "/user/admin", destination: "https://admin.412studios.ca/user/admin", permanent: false },
      { source: "/user/admin/:path*", destination: "https://admin.412studios.ca/user/admin/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
