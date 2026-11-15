import { defineConfig } from "@playwright/test"

const PORT = 4173
const phone = { isMobile: true, hasTouch: true }

// Runs against the production build, so a build-only breakage fails here too.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "zh-CN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // The three layouts in src/index.css, plus a short phone. 852×300 is what a phone browser leaves in landscape.
  projects: [
    { name: "desktop-chromium", use: { browserName: "chromium", viewport: { width: 1280, height: 720 } } },
    { name: "phone-upright-webkit", use: { browserName: "webkit", viewport: { width: 393, height: 745 }, ...phone } },
    { name: "phone-landscape-webkit", use: { browserName: "webkit", viewport: { width: 852, height: 300 }, ...phone } },
    { name: "small-phone-chromium", use: { browserName: "chromium", viewport: { width: 375, height: 550 }, ...phone } },
  ],
})
