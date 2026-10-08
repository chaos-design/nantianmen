#!/usr/bin/env node
// 体积门禁：按路由检查首屏 JS 总量（gzip），超过预算就以非零码退出。
//
// 为什么用体积而不是 Lighthouse 分数做门禁：
// - Lighthouse 的 performance 分数在 CI 共享 runner 上噪声极大，同一份代码
//   上下浮动几十点是常态，做成门禁只会得到一个需要人肉排查的假红灯。
// - 首屏 JS 总量由构建产物算出，同一份源码结果确定，红了就是真回归。
// - INP 是交互指标，lab 环境里的值是模拟值，只有真实用户 field data 的 p75
//   才有意义；仓库里目前没有 RUM 采集，这条指标无法在 CI 里判定。
//
// 口径：本脚本统计「根布局 + 该路由页面」chunk 的并集，逐个 gzip 后求和。
// 这个口径比 `pnpm build` 摘要里的 First Load JS 略严（Next 会把部分布局
// chunk 记到各路由而不是「shared by all」），两者不必相等，但同一口径跨时间
// 可比，这正是门禁需要的。
//
// 用法：先 `pnpm build`，再 `pnpm check:budget`。
// 预算是「当前实测值 + 约 10% 余量」取整到 5 kB；确认是有意增长后再显式上调。

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { gzipSync } from "node:zlib"

const buildDir = path.join(process.cwd(), ".next")
const manifestPath = path.join(buildDir, "app-build-manifest.json")

const budgets = {
  "/": 155,
  "/editor/[resume-id]": 300,
  "/editor/[resume-id]/preview": 210,
  "/editor/[resume-id]/web": 240,
  "/forgot-password": 235,
  "/login": 245,
  "/r/[public-slug]": 165,
  "/r/[public-slug]/web": 205,
  "/reset-password": 235,
  "/workspace": 280,
}

if (!existsSync(manifestPath)) {
  console.error("ERROR: 找不到 .next/app-build-manifest.json，请先运行 pnpm build")
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))

/** 路由的 chunk 集合 = 根布局 + 该路由页面，构建产物里两者分开记录。 */
function routeChunks(route) {
  const files = new Set()
  for (const key of ["/layout", `${route}/page`]) {
    for (const file of manifest.pages[key] ?? []) {
      if (file.endsWith(".js")) files.add(file)
    }
  }
  return [...files]
}

function gzipKiloBytes(file) {
  const contents = readFileSync(path.join(buildDir, file))
  return gzipSync(contents, { level: 9 }).length / 1024
}

const rows = []
for (const route of Object.keys(budgets).sort()) {
  const files = routeChunks(route)
  if (files.length === 0) {
    console.error(`ERROR: 构建产物里没有路由 ${route}，预算表可能已过期`)
    process.exit(1)
  }
  const kiloBytes = files.reduce((sum, file) => sum + gzipKiloBytes(file), 0)
  rows.push({ route, kiloBytes, budget: budgets[route] })
}

const width = Math.max(...rows.map((row) => row.route.length))
let failed = false
console.log(
  `${"route".padEnd(width)} ${"first-load-js".padStart(16)} ${"budget".padStart(9)}`,
)
for (const row of rows) {
  const over = row.kiloBytes > row.budget
  failed ||= over
  console.log(
    `${row.route.padEnd(width)} ${`${row.kiloBytes.toFixed(1)} kB`.padStart(16)} ${`${row.budget} kB`.padStart(9)}${over ? "  OVER" : ""}`,
  )
}

const layoutCss = (manifest.pages["/layout"] ?? []).filter((file) =>
  file.endsWith(".css"),
)
for (const file of layoutCss) {
  console.log(
    `\n参考：全局样式表 ${path.basename(file)} gzip ${gzipKiloBytes(file).toFixed(1)} kB，所有路由共享，当前未设门禁。`,
  )
}

if (failed) {
  console.error(
    "\n体积门禁未通过。确认是有意增长后，再显式上调 scripts/check-bundle-budget.mjs 里的预算。",
  )
  process.exit(1)
}
console.log("\n体积门禁通过。")
