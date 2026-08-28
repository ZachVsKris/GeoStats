import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chrome-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "edge-desktop", use: { ...devices["Desktop Edge"] } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "safari-desktop", use: { ...devices["Desktop Safari"] } },
    { name: "chrome-android", use: { ...devices["Pixel 7"] } },
    { name: "safari-iphone", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/daily",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
