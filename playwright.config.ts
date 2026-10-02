import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

const port = process.env.PLAYWRIGHT_PORT ?? "3000"
const baseURL = `http://127.0.0.1:${port}`
const webServerURL = `${baseURL}/login`
const e2eRunId = `${Date.now()}-${process.pid}`
const e2eDataRoot =
  process.env.PLAYWRIGHT_DATA_DIR ?? path.join(process.cwd(), ".data", "e2e", e2eRunId)
const authTestUserId =
  process.env.AUTH_TEST_USER_ID ?? "00000000-0000-4000-8000-000000000001"
const authTestUserEmail = process.env.AUTH_TEST_USER_EMAIL ?? "playwright@example.com"
const adminUserId = process.env.ADMIN_USER_ID ?? "00000000-0000-4000-8000-000000000002"
const previewEnv = {
  ...(process.env.PREVIEW_USER_ID
    ? { PREVIEW_USER_ID: process.env.PREVIEW_USER_ID }
    : {}),
  ...(process.env.PREVIEW_USER_EMAIL
    ? { PREVIEW_USER_EMAIL: process.env.PREVIEW_USER_EMAIL }
    : {}),
  ...(process.env.PREVIEW_RESUME_ID
    ? { PREVIEW_RESUME_ID: process.env.PREVIEW_RESUME_ID }
    : {}),
  ...(process.env.PREVIEW_SESSION_SECRET
    ? { PREVIEW_SESSION_SECRET: process.env.PREVIEW_SESSION_SECRET }
    : {}),
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  // dev 模式下 Turbopack 冷编译单个路由可达 20-40 秒，
  // 默认的 30 秒用例超时和 5 秒断言超时会把编译延迟误报成用例失败。
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: webServerURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      RESUME_DATA_BACKEND: "file",
      RESUME_FILE_DATABASE_PATH: path.join(e2eDataRoot, "resumes.json"),
      RESUME_FILE_ASSET_DIR: path.join(e2eDataRoot, "assets"),
      AUTH_TEST_USER_ID: authTestUserId,
      AUTH_TEST_USER_EMAIL: authTestUserEmail,
      ADMIN_USER_ID: adminUserId,
      ...previewEnv,
    },
  },
})
