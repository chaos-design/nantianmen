import sharp from "sharp"
import { afterEach, describe, expect, it } from "vitest"
import {
  buildImageVariant,
  clearImageVariantCache,
  isTranscodableImage,
} from "./resume-image-variant"

async function sourceImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 90, b: 160 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
}

afterEach(() => {
  clearImageVariantCache()
})

describe("isTranscodableImage", () => {
  it("转位图，不碰 GIF 与 SVG", () => {
    expect(isTranscodableImage("image/jpeg")).toBe(true)
    expect(isTranscodableImage("IMAGE/PNG")).toBe(true)
    expect(isTranscodableImage("image/gif")).toBe(false)
    expect(isTranscodableImage("image/svg+xml")).toBe(false)
  })
})

describe("buildImageVariant", () => {
  it("按档位输出 WebP，且不放大原图", async () => {
    const bytes = await sourceImage(600, 800)
    const variant = await buildImageVariant("asset-1", bytes, "image/jpeg", 640)

    expect(variant?.mimeType).toBe("image/webp")
    const metadata = await sharp(variant?.bytes).metadata()
    expect(metadata.format).toBe("webp")
    expect(metadata.width).toBe(600)
    expect(metadata.height).toBe(800)
  })

  it("原图大于档位时按档位缩小", async () => {
    const bytes = await sourceImage(1600, 2000)
    const variant = await buildImageVariant("asset-2", bytes, "image/jpeg", 320)

    const metadata = await sharp(variant?.bytes).metadata()
    expect(metadata.width).toBe(320)
  })

  it("同一资源同一档位命中缓存，转第二次拿到同一份 Buffer", async () => {
    const bytes = await sourceImage(600, 800)
    const first = await buildImageVariant("asset-3", bytes, "image/jpeg", 640)
    const second = await buildImageVariant("asset-3", bytes, "image/jpeg", 640)

    expect(first).not.toBeNull()
    expect(second?.bytes).toBe(first?.bytes)
  })

  it("不同档位各自缓存，互不覆盖", async () => {
    const bytes = await sourceImage(1600, 2000)
    const small = await buildImageVariant("asset-4", bytes, "image/jpeg", 320)
    const large = await buildImageVariant("asset-4", bytes, "image/jpeg", 960)

    expect(await sharp(small?.bytes).metadata()).toMatchObject({ width: 320 })
    expect(await sharp(large?.bytes).metadata()).toMatchObject({ width: 960 })
  })

  it("不可转码的类型直接返回 null，由调用方回落到原图", async () => {
    expect(
      await buildImageVariant("asset-5", Buffer.from("gif"), "image/gif", 640),
    ).toBeNull()
  })

  it("损坏的字节解码失败时返回 null 而不是抛错", async () => {
    expect(
      await buildImageVariant(
        "asset-6",
        Buffer.from("not an image"),
        "image/jpeg",
        640,
      ),
    ).toBeNull()
  })
})
