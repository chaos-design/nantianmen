#!/usr/bin/env node
// CSS 归因实验：把渲染阻塞样式表里的 utilities 层「拿掉」，看 LCP 掉多少。
//
// 用途：回答「这一页还剩多少毫秒在 CSS 里」。它不改构建。用 Playwright 的路由拦截把
// `core.css` 换成删掉 `@layer utilities` 的版本，其余请求原样放行，A/B 相邻采样，
// 配对差值就是这一层 CSS 的代价。
//
// 为什么不去掉整份样式表：`measure-lcp-breakdown.mjs --block` 那种做法会让页面变成
// 无样式文档（LCP 元素都可能换人），只能回答「全部 CSS 值多少」；这里保留 theme、
// 基础排版与自有类，只拿掉 Tailwind 工具类，形态更接近「按路由裁剪 utilities」。
//
// 用法（先 pnpm build 并启动 next start）：
//   node scripts/measure-css-ab.mjs --base http://127.0.0.1:3210 --route /workspace --runs 6

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { chromium } from "@playwright/test"

const args = process.argv.slice(2)
function readArg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  if (index === -1 || index + 1 >= args.length) return fallback
  return args[index + 1]
}

const base = readArg("base", "http://127.0.0.1:3210").replace(/\/$/, "")
const route = readArg("route", "/workspace")
const runs = Number(readArg("runs", "6"))
const cpuRate = Number(readArg("cpu", "4"))
const netProfileName = readArg("net", "slow4g")
const label = readArg("label", "css-ab")
const outDir = path.join(process.cwd(), ".data", "perf", "results")

const networkProfiles = {
  none: null,
  fast3g: { latencyMs: 150, downloadKbps: 1638, uploadKbps: 768 },
  slow4g: { latencyMs: 400, downloadKbps: 409, uploadKbps: 409 },
}
const network = networkProfiles[netProfileName]
if (network === undefined) {
  console.error(`未知的网络档位：${netProfileName}（可选 none | fast3g | slow4g）`)
  process.exit(1)
}

const cssDir = path.join(process.cwd(), ".next", "static", "css")
if (!existsSync(cssDir)) {
  console.error("找不到 .next/static/css，请先运行 pnpm build")
  process.exit(1)
}
/** 带 Tailwind 的那份就是 core.css 的构建产物；按内容认，不写死 hash。 */
const cssName = readdirSync(cssDir).find(
  (name) =>
    name.endsWith(".css") &&
    readFileSync(path.join(cssDir, name), "utf8").includes("tailwindcss"),
)
if (!cssName) {
  console.error("在构建产物里找不到含 tailwindcss 的样式表")
  process.exit(1)
}
const fullCss = readFileSync(path.join(cssDir, cssName), "utf8")

/** 删掉 `@layer utilities { ... }`（按花括号配对，避免截断嵌套规则）。 */
function stripUtilities(cssText) {
  const start = cssText.indexOf("@layer utilities")
  if (start === -1) return cssText
  let depth = 0
  let end = -1
  for (let i = cssText.indexOf("{", start); i < cssText.length; i += 1) {
    if (cssText[i] === "{") depth += 1
    else if (cssText[i] === "}") {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) return cssText
  return cssText.slice(0, start) + cssText.slice(end + 1)
}

const strippedCss = stripUtilities(fullCss)
if (strippedCss === fullCss) {
  console.error("样式表里没有 @layer utilities，无法做这个对比")
  process.exit(1)
}

const browser = await chromium.launch()

async function sampleOnce(variant) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  if (variant === "stripped") {
    await page.route(`**/static/css/${cssName}`, (interceptor) =>
      interceptor.fulfill({
        status: 200,
        contentType: "text/css",
        body: strippedCss,
      }),
    )
  }
  await page.addInitScript(() => {
    window.__perf = { lcp: [] }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__perf.lcp.push(entry.startTime)
      }
    }).observe({ type: "largest-contentful-paint", buffered: true })
  })
  const cdp = await context.newCDPSession(page)
  if (cpuRate > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate })
  }
  await cdp.send("Network.enable")
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })
  if (network) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: network.latencyMs,
      downloadThroughput: (network.downloadKbps * 1024) / 8,
      uploadThroughput: (network.uploadKbps * 1024) / 8,
    })
  }
  await page.goto(`${base}${route}`, { waitUntil: "load", timeout: 180_000 })
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const value = await page.evaluate(() => {
    const list = window.__perf.lcp
    return list.length ? Math.round(list[list.length - 1]) : null
  })
  await context.close()
  return value
}

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

const full = []
const stripped = []
const paired = []
for (let round = 0; round < runs; round += 1) {
  const a = await sampleOnce("full")
  const b = await sampleOnce("stripped")
  if (a !== null && b !== null) {
    full.push(a)
    stripped.push(b)
    paired.push(b - a)
    process.stdout.write(".")
  } else {
    process.stdout.write("x")
  }
}
await browser.close()

if (paired.length === 0) {
  console.error("\n没有采到有效样本")
  process.exit(1)
}

console.log(
  `\n${route}  完整 CSS ${median(full)}ms  去掉 utilities ${median(stripped)}ms`,
)
console.log(
  `配对中位差 ${median(paired)}ms（${Math.min(...paired)} ~ ${Math.max(...paired)}）  样式表 ${cssName}`,
)
console.log(
  `CSS 原始体积 ${(Buffer.byteLength(fullCss) / 1024).toFixed(1)} kB → ${(Buffer.byteLength(strippedCss) / 1024).toFixed(1)} kB`,
)

mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const outPath = path.join(outDir, `css-ab-${stamp}-${label}.json`)
writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      label,
      route,
      base,
      runs: paired.length,
      throttling: { cpuRate, network: netProfileName },
      cssFile: cssName,
      cssBytes: {
        full: Buffer.byteLength(fullCss),
        stripped: Buffer.byteLength(strippedCss),
      },
      full: { median: median(full), runs: full },
      stripped: { median: median(stripped), runs: stripped },
      pairedDelta: {
        median: median(paired),
        min: Math.min(...paired),
        max: Math.max(...paired),
      },
    },
    null,
    2,
  )}\n`,
)
console.log(`\n明细已写入 ${path.relative(process.cwd(), outPath)}`)
