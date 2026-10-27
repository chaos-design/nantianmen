/**
 * 放置图的宽度档位。
 *
 * 客户端按显示宽度挑一档写进 URL（`?w=960`），服务端只认这几档：任意宽度都允许
 * 会让一个 `?w=999` 的请求把缩放开销变成公开的放大器。档位同时被图片层、预载和
 * 私有资源路由共用，避免三处各写一套导致「预载地址 ≠ 实际请求」而多下一份。
 */
export const resumeImageWidths = [320, 480, 640, 960, 1280] as const

export type ResumeImageWidth = (typeof resumeImageWidths)[number]

/**
 * 显示宽度 → 档位。
 *
 * 按 2 倍像素密度取档：A4 画布上的图在 Retina 上是按 2 倍像素铺的，只按 CSS 像素
 * 取档会糊。档位本身由服务端 `withoutEnlargement` 兜底，原图比档位小的时候不会
 * 被放大，所以这不会带来多余的字节。
 */
export function resumeImageWidthFor(displayWidth: number): ResumeImageWidth {
  const target = Math.max(1, Math.round(displayWidth)) * 2
  return (
    resumeImageWidths.find((width) => width >= target) ??
    resumeImageWidths[resumeImageWidths.length - 1]
  )
}

/** 私有资源地址加上宽度档位；非私有地址原样返回。 */
export function withPrivateImageWidth(source: string, displayWidth: number): string {
  if (!source.startsWith("/api/resumes/") || displayWidth <= 0) {
    return source
  }
  const separator = source.includes("?") ? "&" : "?"
  return `${source}${separator}w=${resumeImageWidthFor(displayWidth)}`
}

/** 解析并校验 `?w=`；非法值（含越界、非整数、非档位）一律当作「不要变体」。 */
export function parseResumeImageWidth(raw: string | null): ResumeImageWidth | null {
  if (!raw) {
    return null
  }
  const width = Number(raw)
  if (!Number.isInteger(width)) {
    return null
  }
  return (resumeImageWidths as readonly number[]).includes(width)
    ? (width as ResumeImageWidth)
    : null
}
