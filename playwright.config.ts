import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: process.env.CI
      ? "npm run start --workspace=@uln/web"
      : "npm run dev --workspace=@uln/web",
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/uln_dashboard?schema=public",
      JWT_SECRET:
        process.env.JWT_SECRET ?? "change-me-jwt-secret-min-32-chars",
      SESSION_SECRET:
        process.env.SESSION_SECRET ?? "change-me-session-secret-min-32-chars",
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
});
