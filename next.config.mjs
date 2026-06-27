/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow product images from any host (mock storefronts use external URLs)
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
