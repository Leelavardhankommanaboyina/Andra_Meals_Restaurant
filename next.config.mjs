/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable strict mode to prevent double mounting that causes socket reconnections
};

export default nextConfig;
