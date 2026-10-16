"use client"

import { useMemo } from "react"
import type { ResumeImageAsset } from "../../shared/resume-schema/resume-schema"

/**
 * 私有资源的同源 API 地址。
 *
 * 资源接口按会话 Cookie 鉴权，`<img>` 请求天然携带 Cookie，
 * 因此地址可以在渲染期同步派生：
 * - SSR 首帧 HTML 直接包含真实 `src`，画布图片不再等待
 *   「hydrate → fetch → blob → objectURL」的客户端瀑布；
 * - 响应带 `Cache-Control: private, max-age=3600`，重复打开同一份简历时
 *   图片直接命中 HTTP 缓存（旧的 blob 方案用 `fetch(cache: "no-store")`
 *   绕过了这层缓存）。
 */
export function privateAssetUrl(resumeId: string, assetId: string): string {
  return `/api/resumes/${encodeURIComponent(resumeId)}/assets/${encodeURIComponent(assetId)}`
}

export function buildPrivateAssetUrls(
  resumeId: string,
  assets: ResumeImageAsset[],
): Record<string, string> {
  return Object.fromEntries(
    assets.map((asset) => [asset.id, privateAssetUrl(resumeId, asset.id)]),
  )
}

export function usePrivateAssetUrls(
  resumeId: string,
  assets: ResumeImageAsset[],
): Record<string, string> {
  const assetIdsKey = assets.map((asset) => asset.id).join("|")
  return useMemo(
    () =>
      Object.fromEntries(
        assetIdsKey
          .split("|")
          .filter(Boolean)
          .map((assetId) => [assetId, privateAssetUrl(resumeId, assetId)]),
      ),
    [assetIdsKey, resumeId],
  )
}
