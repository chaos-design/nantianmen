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
// 测试默认以普通成员身份运行。`PLAYWRIGHT_AS_ADMIN=1` 让同一套 dev server
// 以管理员身份启动，用于验证只有管理员可见可写的功能（例如公告配置）。
// 身份判定仍然只是 AUTH_TEST_USER_ID 与 ADMIN_USER_ID 的等值比较，
// 这里只决定注入哪个测试身份，不改变任何生产鉴权逻辑。
const adminUserId = process.env.ADMIN_USER_ID ?? "00000000-0000-4000-8000-000000000002"
const runAsAdmin = process.env.PLAYWRIGHT_AS_ADMIN === "1"
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
  //
  // 180 秒仍然不够：本地实测最长的「创建→编辑→发布→分享」整链路用例要 174 秒，
  // 只剩 6 秒余量。GitHub runner 未必比本地快，CI 上这条用例必然在
  // 「本地全绿、CI 超时」的边界上反复横跳。这里给到 5 分钟，
  // 真实卡死仍会被超时拦住，同时不再把编译和机器差异当成失败。
  timeout: 300_000,
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
      // Playwright 1.49 起 headless 默认走 chromium-headless-shell。无显示器的
      // Linux CI 上该构建把 media query 报成 (hover: none)，所有包在
      // @media (hover: hover) 里的悬停样式（A4 区块阴影等）永不生效，断言在
      // CI 稳定失败而本地全绿。channel: "chromium" 强制用完整 Chromium 的
      // new headless，保持与桌面一致的悬停语义；`playwright install chromium`
      // 本就会同时下载完整构建，CI 无需改动。
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port}`,
    url: webServerURL,
    reuseExistingServer: !process.env.CI,
    // 就绪探测要访问 /login，CI 上是全新 checkout 的冷启动：装依赖后第一次编译
    // 路由全靠现场 Turbopack 冷编译。探测失败会直接终结整个 job，
    // 这里放宽到 4 分钟，成本为零而收益是避免整轮重跑。
    timeout: 240_000,
    env: {
      RESUME_DATA_BACKEND: "file",
      RESUME_FILE_DATABASE_PATH: path.join(e2eDataRoot, "resumes.json"),
      RESUME_FILE_ASSET_DIR: path.join(e2eDataRoot, "assets"),
      AUTH_TEST_USER_ID: runAsAdmin ? adminUserId : authTestUserId,
      AUTH_TEST_USER_EMAIL: runAsAdmin
        ? "playwright-admin@example.com"
        : authTestUserEmail,
      ADMIN_USER_ID: adminUserId,
      ...previewEnv,
    },
  },
})
