import type { ResumeImageWidth } from "../../shared/resume-image"

/**
 * 私有简历资源按显示宽度转码后的变体。
 *
 * 为什么不走公开快照那套 Next 图片优化器：优化器是以服务端身份去取源图的，拿不到
 * 用户的会话 Cookie，私有资源会 401。所以这里在资源路由内部转码，鉴权仍然由会话
 * 完成，转码只是「拿到字节之后」的一步。
 *
 * 缓存键是 `资源 id @ 档位`：资源 id 是一次上传生成一次的 uuid，永不复用，因此
 * 不存在「同一 id 换了内容」的失效问题。缓存只放在进程内 —— 它只是把同一份简历
 * 重复打开时的转码开销省掉，丢失缓存最多多转一次，不影响正确性。
 */

const cache = new Map<string, Buffer>()
/** 单进程内最多缓存的变体数量；一张 640 宽的 WebP 通常 20–40 kB。 */
const maxCachedVariants = 96
/** 只转这几种位图。GIF 会在转码里丢掉后续帧，SVG 交给浏览器按矢量处理。 */
const transcodableMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
])

export interface ImageVariant {
  bytes: Buffer
  mimeType: string
}

export function isTranscodableImage(mimeType: string): boolean {
  return transcodableMimeTypes.has(mimeType.toLowerCase())
}

function remember(key: string, bytes: Buffer): void {
  cache.set(key, bytes)
  if (cache.size <= maxCachedVariants) {
    return
  }
  // Map 保持插入顺序：删掉最早的一批就等价于 FIFO 淘汰。
  for (const staleKey of cache.keys()) {
    cache.delete(staleKey)
    if (cache.size <= maxCachedVariants) {
      break
    }
  }
}

/** 清空变体缓存。测试用；运行期没有调用点。 */
export function clearImageVariantCache(): void {
  cache.clear()
}

/**
 * 把原图转成指定宽度的 WebP。
 *
 * `withoutEnlargement` 保证原图比档位窄时不会被插值放大（放大只会变糊且更大）；
 * `rotate()` 先按 EXIF 摆正，否则竖拍照片转码后会躺倒 —— 浏览器对原图会自动
 * 应用 EXIF 方向，转码后没有了这层兜底，必须在服务端补上。
 *
 * sharp 在 package.json 里是 optionalDependency（部署环境可能装不上原生二进制），
 * 所以这里按需加载并在失败时返回 null，由调用方回落到原图。
 */
export async function buildImageVariant(
  assetId: string,
  bytes: Uint8Array,
  mimeType: string,
  width: ResumeImageWidth,
): Promise<ImageVariant | null> {
  if (!isTranscodableImage(mimeType)) {
    return null
  }
  const cacheKey = `${assetId}@${width}`
  const cached = cache.get(cacheKey)
  if (cached) {
    return { bytes: cached, mimeType: "image/webp" }
  }
  const sharpModule = await import("sharp").catch(() => null)
  if (!sharpModule) {
    return null
  }
  try {
    const output = await sharpModule
      .default(Buffer.from(bytes))
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 78 })
      .toBuffer()
    remember(cacheKey, output)
    return { bytes: output, mimeType: "image/webp" }
  } catch {
    return null
  }
}
