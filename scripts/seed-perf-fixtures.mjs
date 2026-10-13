#!/usr/bin/env node
// 为 LCP 实验室准备固定测试数据：
//   1. 生成一张真实尺寸的竖版人像照片（SVG feTurbulence 纹理 + 渐变，JPEG 约 100 kB）。
//   2. 走公开 API 创建简历 → 上传照片 → 写入文档（资产 + 首页放置）→ 发布。
//   3. 把 resumeId / publicSlug / assetId 写入 .data/perf/perf-fixtures.json，
//      供 scripts/measure-lcp.mjs 展开 /workspace、/editor、/r 三条路由。
//
// 放置尺寸对齐作品集式简历的主图区域（500x640），保证「大图是 LCP 元素」
// 这一图片关键路径场景被测量覆盖（图片密集模板如 portfolio-studio 的真实形态）。
//
// 前提：被测服务器已按「file 后端 + 测试身份」启动。
// 重复执行会创建新简历；需要完全干净时删除 .data/perf/resumes.json 后重启服务。

import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"

const base = (
  process.argv[2] ??
  process.env.PERF_BASE_URL ??
  "http://127.0.0.1:3210"
).replace(/\/$/, "")
const outDir = path.join(process.cwd(), ".data", "perf")
mkdirSync(outDir, { recursive: true })

const avatarSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f46e5"/>
      <stop offset="0.5" stop-color="#0ea5e9"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="600" height="800" fill="url(#bg)"/>
  <rect width="600" height="800" filter="url(#grain)"/>
  <circle cx="300" cy="300" r="150" fill="#f8fafc"/>
  <path d="M90 800 C 130 560, 470 560, 510 800 Z" fill="#f8fafc"/>
  <rect x="40" y="40" width="520" height="720" fill="none" stroke="#e0f2fe" stroke-width="8" rx="24"/>
</svg>
`

const avatarJpeg = await sharp(Buffer.from(avatarSvg)).jpeg({ quality: 82 }).toBuffer()
console.log(`照片 JPEG 生成完成：${Math.round(avatarJpeg.byteLength / 1024)} kB`)

async function api(pathname, init = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...init,
    headers: {
      Origin: base,
      ...(init.headers ?? {}),
    },
  })
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${pathname} → ${response.status}: ${await response.text()}`,
    )
  }
  return (await response.json()).data
}

const created = await api("/api/resumes", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
})
const resume = created.resume
console.log(`简历已创建：${resume.id}`)

const uploadForm = new FormData()
uploadForm.set(
  "file",
  new Blob([avatarJpeg], { type: "image/jpeg" }),
  "perf-portrait.jpg",
)
uploadForm.set("alt", "性能测试人像照")
const asset = await api(`/api/resumes/${resume.id}/assets`, {
  method: "POST",
  body: uploadForm,
})
console.log(`照片已上传：${asset.id}（${asset.width}x${asset.height}）`)

const document = structuredClone(resume.document)
document.resources.assets.push(asset)
document.resources.placements.push({
  id: "perf-portrait-placement",
  assetId: asset.id,
  pageIndex: 0,
  x: (794 - 500) / 2,
  y: 56,
  width: 500,
  height: 640,
  zIndex: 1,
  objectFit: "cover",
  shape: "rounded",
})

const saved = await api(`/api/resumes/${resume.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ expectedVersion: resume.version, document }),
})
console.log(
  `文档已保存：版本 ${saved.version}，资源 ${saved.document.resources.assets.length} 个`,
)

const publication = await api(`/api/resumes/${resume.id}/publish`, { method: "POST" })
console.log(`已发布：/r/${publication.publicSlug}`)

const fixtures = {
  resumeId: resume.id,
  publicSlug: publication.publicSlug,
  assetId: asset.id,
}
const fixturesPath = path.join(outDir, "perf-fixtures.json")
writeFileSync(fixturesPath, `${JSON.stringify(fixtures, null, 2)}\n`)
console.log(`夹具已写入 ${fixturesPath}`)
