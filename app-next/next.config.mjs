/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/quotations/[id]/pdf": ["./public/brand/**/*"],
  },
};
export default nextConfig;
