#!/usr/bin/env node
// 首屏 LCP 分解：按资源类别“拿掉”一部分，看 LCP 到底由什么决定。
//
// 用途：在动手优化前先回答「还剩下多少可省」。例如把全部脚本请求阻断后 LCP 仍是
// 2.0 s，说明这个页面的下限是「HTML + 样式表 + 排版」，再拆 JS 不会有效果。
//
// 做法：每个场景跑 N 轮，用 Playwright 的路由拦截把目标请求 abort 掉。被 abort 的
// 请求仍然计入「页面原本会发起的请求」，所以对比的是「这些字节不再占用带宽 / 不再
// 占用主线程」的效果，而不是「资源被删除后的假页面」。abort 会让页面报资源错误，
// 这在不节流的场景下会污染测量，所以指标只在同样的节流参数下互相比较。
//
// 用法：
//   node scripts/measure-lcp-breakdown.mjs --route /workspace --runs 3
//   node scripts/measure-lcp-breakdown.mjs --route /workspace --block 7092,5989,473
//
// 预设场景：baseline（不拦）、no-script（拦住全部框架 JS）、no-css（拦住全部样式表）。

import { mkdirSync, writeFileSync } from "node:fs"
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
const runs = Number(readArg("runs", "3"))
const cpuRate = Number(readArg("cpu", "4"))
const outDir = path.join(process.cwd(), ".data", "perf", "results")

const networkProfiles = {
  none: null,
  fast3g: { latencyMs: 150, downloadKbps: 1638, uploadKbps: 768 },
  slow4g: { latencyMs: 400, downloadKbps: 409, uploadKbps: 409 },
}
const netProfileName = readArg("net", "slow4g")
const network = networkProfiles[netProfileName]
if (network === undefined) {
  console.error(`未知的网络档位：${netProfileName}（可选 none | fast3g | slow4g）`)
  process.exit(1)
}

const customBlock = (readArg("block", "") ?? "")
  .split(",")
  .map((token) => token.trim())
  .filter(Boolean)

/** 场景：name → 需要 abort 的 URL 片段列表（空列表表示不拦）。 */
const scenarios = [
  { name: "baseline", block: [], note: "不拦截" },
  { name: "no-script", block: ["/_next/static/chunks/"], note: "只剩 HTML + 样式表" },
  { name: "no-css", block: ["/_next/static/css/"], note: "样式表不参与" },
]
if (customBlock.length > 0) {
  scenarios.push({ name: "custom", block: customBlock, note: customBlock.join(",") })
}

const collectInitScript = () => {
  const state = { lcp: [], resources: [] }
  Object.defineProperty(window, "__perf", { value: state, writable: false })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) state.lcp.push(entry.startTime)
  }).observe({ type: "largest-contentful-paint", buffered: true })
}

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

const browser = await chromium.launch()

async function sampleOnce(block) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  // 只注册要拦的模式，不要用 "**/*" 全量代理：全量 route 会让每个请求都绕一次
  // Playwright 的调度，实测把 baseline 本身抬高 600 ms 以上，比要测的差异还大。
  for (const token of block) {
    const pattern = token.startsWith("/") ? `**${token}**` : `**/*${token}*`
    await page.route(pattern, (interceptor) => interceptor.abort())
  }
  await page.addInitScript(collectInitScript)
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
  const result = await page.evaluate(() => {
    const lcp = window.__perf.lcp
    const resources = performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      type: entry.initiatorType,
      bytes: entry.transferSize,
      end: entry.responseEnd,
    }))
    return {
      lcp: lcp.length ? Math.round(lcp[lcp.length - 1]) : null,
      resources,
    }
  })
  await context.close()
  return result
}

const summary = []
for (const scenario of scenarios) {
  const lcps = []
  let resources = []
  for (let round = 0; round < runs; round += 1) {
    const result = await sampleOnce(scenario.block)
    if (result.lcp !== null) lcps.push(result.lcp)
    resources = result.resources
  }
  if (lcps.length === 0) {
    console.log(`${scenario.name}: 没有采到 LCP`)
    continue
  }
  const bytesOf = (predicate) =>
    resources.filter(predicate).reduce((sum, entry) => sum + entry.bytes, 0)
  const row = {
    scenario: scenario.name,
    note: scenario.note,
    block: scenario.block,
    lcpMedian: median(lcps),
    lcpMin: Math.min(...lcps),
    lcpMax: Math.max(...lcps),
    runs: lcps,
    bytes: {
      script: bytesOf((entry) => entry.name.endsWith(".js")),
      stylesheet: bytesOf((entry) => entry.name.endsWith(".css")),
      image: bytesOf((entry) => entry.name.includes("/assets/")),
      total: bytesOf(() => true),
    },
  }
  summary.push(row)
  console.log(
    `${scenario.name.padEnd(11)} LCP 中位 ${String(row.lcpMedian).padStart(5)}ms (${row.lcpMin}-${row.lcpMax})  JS ${row.bytes.script}B  CSS ${row.bytes.stylesheet}B  图 ${row.bytes.image}B`,
  )
}

await browser.close()

mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const outPath = path.join(outDir, `lcp-breakdown-${stamp}.json`)
writeFileSync(
  outPath,
  `${JSON.stringify(
    { route, base, runs, cpuRate, net: netProfileName, scenarios: summary },
    null,
    2,
  )}\n`,
)
console.log(`\n已写入 ${path.relative(process.cwd(), outPath)}`)
