#!/usr/bin/env node
// LCP 实验室：对指定路由做多次冷缓存采样，输出 LCP / FCP / TTFB 中位数与 LCP 元素。
//
// 用法（先启动被测服务器，dev 或 next start 均可）：
//   node scripts/measure-lcp.mjs --base http://127.0.0.1:3210 --runs 5 --cpu 4 --net fast3g
//
// 路由来源：默认读取 .data/perf/perf-fixtures.json（由 scripts/seed-perf-fixtures.mjs 生成），
// 展开 /workspace、/editor/{resumeId}、/r/{publicSlug} 三条路由；也可用 --routes 覆盖。
//
// 节流：
//   --cpu N      CPU 节流倍数（CDP Emulation.setCPUThrottlingRate），0 或省略 = 不节流
//   --net NAME   fast3g | slow4g | none（默认 fast3g）
// 每次采样使用全新浏览器上下文（冷缓存），取中位数；同时输出单次明细便于排查。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { chromium } from "@playwright/test"

const args = process.argv.slice(2)
function readArg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  if (index === -1 || index + 1 >= args.length) return fallback
  return args[index + 1]
}

const base = readArg("base", "http://127.0.0.1:3210").replace(/\/$/, "")
const runs = Number(readArg("runs", "5"))
const cpuRate = Number(readArg("cpu", "4"))
const netProfileName = readArg("net", "fast3g")
const label = readArg("label", "")
// 可选注入会话 cookie（name=value），例如 preview 身份用于生产构建测量。
const cookieArg = readArg("cookie", "")
const outDir = path.join(process.cwd(), ".data", "perf", "results")

const networkProfiles = {
  none: null,
  // 近似 Chrome DevTools「Fast 3G」预设。
  fast3g: { latencyMs: 150, downloadKbps: 1638, uploadKbps: 768 },
  // 近似 Lighthouse「Slow 4G」预设。
  slow4g: { latencyMs: 400, downloadKbps: 409, uploadKbps: 409 },
}
const networkProfile = networkProfiles[netProfileName]
if (networkProfile === undefined) {
  console.error(`未知的网络档位：${netProfileName}（可选 none | fast3g | slow4g）`)
  process.exit(1)
}

const fixturesPath = path.join(process.cwd(), ".data", "perf", "perf-fixtures.json")
let routes = []
const routesArgIndex = args.indexOf("--routes")
if (routesArgIndex !== -1 && args[routesArgIndex + 1]) {
  routes = args[routesArgIndex + 1].split(",").map((route) => route.trim())
} else if (existsSync(fixturesPath)) {
  const fixtures = JSON.parse(readFileSync(fixturesPath, "utf8"))
  routes = ["/workspace", `/editor/${fixtures.resumeId}`, `/r/${fixtures.publicSlug}`]
} else {
  console.error(
    `找不到 ${fixturesPath}，请先运行 scripts/seed-perf-fixtures.mjs 或用 --routes 指定路由`,
  )
  process.exit(1)
}

/** 在页面里安装性能采集：LCP / FCP / 资源时序，必须在导航前注入。 */
const collectInitScript = `
  window.__perf = { lcp: [], fcp: null, ttfb: null }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const element = entry.element
        window.__perf.lcp.push({
          startTime: entry.startTime,
          size: entry.size,
          url: entry.url || "",
          tag: element ? element.tagName.toLowerCase() : "",
          className: element ? String(element.className).slice(0, 120) : "",
          text: element ? String(element.textContent ?? "").trim().slice(0, 40) : "",
        })
      }
    }).observe({ type: "largest-contentful-paint", buffered: true })
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") window.__perf.fcp = entry.startTime
      }
    }).observe({ type: "paint", buffered: true })
  } catch {}
`

async function sampleOnce(browser, route) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  })
  if (cookieArg) {
    const separator = cookieArg.indexOf("=")
    await context.addCookies([
      {
        name: cookieArg.slice(0, separator),
        value: cookieArg.slice(separator + 1),
        domain: new URL(base).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ])
  }
  const page = await context.newPage()
  await page.addInitScript(collectInitScript)
  const cdp = await context.newCDPSession(page)
  if (cpuRate > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate })
  }
  if (networkProfile) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: networkProfile.latencyMs,
      downloadThroughput: (networkProfile.downloadKbps * 1024) / 8,
      uploadThroughput: (networkProfile.uploadKbps * 1024) / 8,
    })
  }
  const url = `${base}${route}`
  const startedAt = Date.now()
  try {
    await page.goto(url, { waitUntil: "load", timeout: 180_000 })
  } catch {
    // 单样本失败（弱机抖动导致导航超时等）记为空样本，不拖垮整轮测量。
    await context.close()
    return { route, url, durationMs: Date.now() - startedAt, error: "goto-timeout" }
  }
  // LCP 候选稳定判定：连续 1s 无新候选即认为完成，上限 20s。
  const deadline = Date.now() + 20_000
  let lastLength = -1
  let stableSince = 0
  while (Date.now() < deadline) {
    const length = await page.evaluate(() => window.__perf.lcp.length)
    if (length !== lastLength) {
      lastLength = length
      stableSince = Date.now()
    } else if (Date.now() - stableSince > 1000) {
      break
    }
    await page.waitForTimeout(200)
  }
  const perf = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0]
    const resources = performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      startTime: Math.round(entry.startTime),
      requestStart: Math.round(entry.requestStart),
      responseStart: Math.round(entry.responseStart),
      responseEnd: Math.round(entry.responseEnd),
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
    }))
    return {
      ...window.__perf,
      ttfb: navigation ? navigation.responseStart : null,
      resources,
    }
  })
  await context.close()
  const lcp = perf.lcp.at(-1) ?? null
  const assetRequests = perf.resources.filter((resource) =>
    resource.name.includes("/assets/"),
  )
  return {
    route,
    url,
    durationMs: Date.now() - startedAt,
    ttfb: perf.ttfb,
    fcp: perf.fcp,
    lcp: lcp ? lcp.startTime : null,
    lcpElement: lcp
      ? `${lcp.tag}${lcp.className ? `.${lcp.className.split(" ")[0]}` : ""}${lcp.text ? ` "${lcp.text}"` : ""}${lcp.url ? ` [${lcp.url.split("/").pop().slice(0, 40)}]` : ""}`
      : "(none)",
    lcpCandidates: perf.lcp.length,
    requestCount: perf.resources.length,
    transferKb: Math.round(
      perf.resources.reduce((sum, resource) => sum + resource.transferSize, 0) / 1024,
    ),
    assetRequests,
  }
}

function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function formatMs(value) {
  return value === null ? "-" : `${(value / 1000).toFixed(2)}s`
}

const browser = await chromium.launch()
const report = { label, base, cpuRate, net: netProfileName, runs, routes: [] }
for (const route of routes) {
  // 预热一次：dev 按需编译、磁盘缓存等一次性成本不计入采样。
  try {
    await sampleOnce(browser, route)
  } catch (warmupError) {
    console.warn(`预热失败（继续测量）: ${warmupError.message}`)
  }
  const samples = []
  for (let index = 0; index < runs; index += 1) {
    const sample = await sampleOnce(browser, route)
    if (!sample.error) {
      samples.push(sample)
      process.stdout.write(".")
    } else {
      process.stdout.write("x")
    }
  }
  if (samples.length === 0) {
    throw new Error(`路由 ${route} 全部采样失败`)
  }
  process.stdout.write("\n")
  const routeReport = {
    route,
    median: {
      ttfb: median(samples.map((sample) => sample.ttfb)),
      fcp: median(samples.map((sample) => sample.fcp)),
      lcp: median(samples.map((sample) => sample.lcp)),
      // 绘制段 = LCP − TTFB：同一样本内的浏览器侧耗时，对 dev 服务器
      // 渲染抖动免疫，是本实验室跨阶段对比的主指标。
      paintPhase: (() => {
        const pairs = samples
          .filter((sample) => sample.lcp !== null && sample.ttfb !== null)
          .map((sample) => sample.lcp - sample.ttfb)
        return median(pairs)
      })(),
    },
    samples,
  }
  report.routes.push(routeReport)
  const element = samples.at(-1).lcpElement ?? "(none)"
  console.log(
    `${route.padEnd(28)} LCP ${formatMs(routeReport.median.lcp).padStart(7)}  绘制段 ${formatMs(routeReport.median.paintPhase).padStart(7)}  TTFB ${formatMs(routeReport.median.ttfb).padStart(7)}  LCP元素 ${element}`,
  )
}
await browser.close()

mkdirSync(outDir, { recursive: true })
const suffix = label ? `-${label.replace(/\W+/g, "-")}` : ""
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const reportPath = path.join(outDir, `lcp-${stamp}${suffix}.json`)
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(`\n明细已写入 ${path.relative(process.cwd(), reportPath)}`)
