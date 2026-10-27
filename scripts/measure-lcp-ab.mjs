#!/usr/bin/env node
// 交错 A/B 测量：两个端口轮流测同一路由，抵消机器随时间漂移。
//
// 为什么需要它：单端口「先测基线、再测优化」的隐患是两次测量之间机器可能变热、
// 变忙。同一份代码隔十分钟复测，实测能差 150–250 ms（约 10–15%），小改动会被
// 这个漂移完全淹没。这里改成每轮 A、B 相邻各测一次，最后取中位数与配对差。
//
// 用法（两个端口分别跑改动前 / 改动后的构建）：
//   node scripts/measure-lcp-ab.mjs \
//     --a http://127.0.0.1:3211 --b http://127.0.0.1:3210 --runs 5 --net slow4g
//
// 路由默认取 .data/perf/perf-fixtures.json 展开的三条首屏路由，可用 --routes 覆盖。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { chromium } from "@playwright/test"

const args = process.argv.slice(2)
function readArg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  if (index === -1 || index + 1 >= args.length) return fallback
  return args[index + 1]
}

const baseA = readArg("a", "http://127.0.0.1:3211").replace(/\/$/, "")
const baseB = readArg("b", "http://127.0.0.1:3210").replace(/\/$/, "")
const runs = Number(readArg("runs", "5"))
const cpuRate = Number(readArg("cpu", "4"))
const netProfileName = readArg("net", "slow4g")
const label = readArg("label", "ab")
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

const fixturesPath = path.join(process.cwd(), ".data", "perf", "perf-fixtures.json")
let routes = []
const routesIndex = args.indexOf("--routes")
if (routesIndex !== -1 && args[routesIndex + 1]) {
  routes = args[routesIndex + 1].split(",").map((route) => route.trim())
} else if (existsSync(fixturesPath)) {
  const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8"))
  routes = ["/workspace", `/editor/${fixtures.resumeId}`, `/r/${fixtures.publicSlug}`]
} else {
  console.error(`找不到 ${fixturesPath}，请先运行 scripts/seed-perf-fixtures.mjs`)
  process.exit(1)
}

const collectInitScript = () => {
  const state = { lcp: [] }
  Object.defineProperty(window, "__perf", { value: state, writable: false })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) state.lcp.push(entry.startTime)
  }).observe({ type: "largest-contentful-paint", buffered: true })
}

const browser = await chromium.launch()

async function sampleOnce(base, route) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
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

const summary = []
for (const route of routes) {
  const valuesA = []
  const valuesB = []
  const paired = []
  for (let round = 0; round < runs; round += 1) {
    const a = await sampleOnce(baseA, route)
    const b = await sampleOnce(baseB, route)
    valuesA.push(a)
    valuesB.push(b)
    paired.push(b - a)
  }
  const row = {
    route,
    before: {
      median: median(valuesA),
      min: Math.min(...valuesA),
      max: Math.max(...valuesA),
      runs: valuesA,
    },
    after: {
      median: median(valuesB),
      min: Math.min(...valuesB),
      max: Math.max(...valuesB),
      runs: valuesB,
    },
    pairedDelta: {
      median: median(paired),
      min: Math.min(...paired),
      max: Math.max(...paired),
    },
  }
  row.deltaPercent = Number(
    (((row.after.median - row.before.median) / row.before.median) * 100).toFixed(1),
  )
  summary.push(row)
  console.log(
    `${route.padEnd(34)} 改动前 ${row.before.median}ms (${row.before.min}-${row.before.max})` +
      `  →  改动后 ${row.after.median}ms (${row.after.min}-${row.after.max})` +
      `  ${row.deltaPercent}%（配对中位差 ${row.pairedDelta.median}ms）`,
  )
}

await browser.close()
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const output = {
  label,
  measuredAt: new Date().toISOString(),
  throttling: {
    cpuRate,
    network: netProfileName,
    viewport: { width: 1280, height: 720 },
  },
  runs,
  pages: summary,
}
writeFileSync(
  path.join(outDir, `lcp-ab-${stamp}-${label}.json`),
  `${JSON.stringify(output, null, 2)}\n`,
)
console.log(`\n已写入 ${path.join(outDir, `lcp-ab-${stamp}-${label}.json`)}`)
