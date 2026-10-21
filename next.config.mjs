/** @type {import('next').NextConfig} */
const config = {
  distDir: process.env.E2E_TEST_MODE === "1" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  cacheComponents: false,
};
export default config;
