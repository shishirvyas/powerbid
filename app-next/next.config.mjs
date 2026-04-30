import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: fileURLToPath(new URL("../", import.meta.url)),
  outputFileTracingIncludes: {
    "/api/quotations/[id]/pdf": ["./public/brand/**/*"],
  },
};
export default nextConfig;
