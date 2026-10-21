import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3001", headless: true, trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3001", url: "http://127.0.0.1:3001/demo", reuseExistingServer: false, timeout: 120_000,
    env: { E2E_TEST_MODE: "1", NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3001", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", CRON_SECRET: "", META_APP_ID: "", META_APP_SECRET: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" },
  },
});
