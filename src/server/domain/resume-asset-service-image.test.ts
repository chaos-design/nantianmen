import { describe, expect, it } from "vitest"
import { InMemoryResumeAssetStorage } from "../assets/in-memory-resume-asset-storage"
import { InMemoryResumeRepository } from "../repositories/resume-repository"
import { ResumeAssetService } from "./resume-asset-service"
import { type Actor, ResumeService } from "./resume-service"

/**
 * 这些解析器直接从上传字节里读尺寸，决定了 A4 画布上的占位大小和
 * `MAX_ASSET_DIMENSION` 是否生效，必须用真实字节布局覆盖，
 * 不能只测 PNG 魔数识别。
 */

const actor: Actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  isAdmin: false,
}

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0))
}

/** 大端 16 位无符号整数。 */
function uint16Be(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff]
}

/** 大端 32 位无符号整数，PNG chunk 长度与 IHDR 尺寸用它。 */
function uint32Be(value: number): number[] {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/** 小端 32 位无符号整数，RIFF 与 WebP chunk 长度用它。 */
function uint32Le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]
}

/** 小端 24 位无符号整数，VP8X 用它存 24 位宽高。 */
function uint24Le(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff]
}

function webpChunk(type: string, payload: number[]): number[] {
  const chunk = [...ascii(type), ...uint32Le(payload.length), ...payload]
  // RIFF 规定 chunk 按偶数字节对齐，奇数长度补一个填充字节。
  return chunk.length % 2 === 0 ? chunk : [...chunk, 0]
}

function webpBytes(chunks: number[][]): Uint8Array {
  const body = [...ascii("WEBP"), ...chunks.flat()]
  const riff = [...ascii("RIFF"), ...uint32Le(body.length), ...body]
  return new Uint8Array(riff)
}

/** 构造带 SOF 段的最小 JPEG，width/height 写入 SOF 负载。 */
function jpegBytes(options: {
  width: number
  height: number
  sofMarker?: number
  segmentLength?: number
  leadingSegments?: number[][]
}): Uint8Array {
  const segmentLength = options.segmentLength ?? 17
  const sofMarker = options.sofMarker ?? 0xc0
  const sof = [
    0xff,
    sofMarker,
    ...uint16Be(segmentLength),
    0x08, // 采样精度
    ...uint16Be(options.height),
    ...uint16Be(options.width),
    0x03, // 颜色分量数
    ...new Array(9).fill(0),
  ]
  return new Uint8Array([
    0xff,
    0xd8, // SOI
    ...(options.leadingSegments ?? []).flat(),
    ...sof,
  ])
}

function pngBytes(width: number, height: number, extra: number[] = []): Uint8Array {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...uint32Be(13),
    ...ascii("IHDR"),
    ...uint32Be(width),
    ...uint32Be(height),
    0x08,
    0x06,
    0x00,
    0x00,
    0x00,
    ...extra,
  ])
}

async function upload(bytes: Uint8Array, mimeType: string) {
  const repository = new InMemoryResumeRepository()
  const storage = new InMemoryResumeAssetStorage()
  const resumeService = new ResumeService(repository)
  const assetService = new ResumeAssetService(repository, storage)
  const created = await resumeService.createResume(actor)
  return assetService.uploadAsset({
    resumeId: created.resume.id,
    actor,
    originalName: "probe.bin",
    providedMimeType: mimeType,
    bytes,
  })
}

async function expectRejection(
  bytes: Uint8Array,
  mimeType: string,
  code: string,
): Promise<void> {
  await expect(upload(bytes, mimeType)).rejects.toMatchObject({ code })
}

describe("image header parsing", () => {
  describe("PNG", () => {
    it("reads width and height from IHDR", async () => {
      const asset = await upload(pngBytes(120, 45), "image/png")
      expect(asset.width).toBe(120)
      expect(asset.height).toBe(45)
    })

    it("treats a zero dimension as invalid", async () => {
      await expectRejection(pngBytes(0, 45), "image/png", "ASSET_DIMENSIONS_INVALID")
    })

    it("rejects headers whose IHDR chunk is missing or truncated", async () => {
      await expectRejection(
        pngBytes(10, 10).slice(0, 12),
        "image/png",
        "ASSET_IMAGE_INVALID",
      )
      await expectRejection(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
        "ASSET_IMAGE_INVALID",
      )
    })

    it("rejects dimensions beyond the A4 canvas limit", async () => {
      await expectRejection(
        pngBytes(6001, 100),
        "image/png",
        "ASSET_DIMENSIONS_INVALID",
      )
    })

    it("detects animated PNG through the acTL chunk", async () => {
      // 手工构造：acTL 必须紧跟在签名之后，否则扫描器读到的第一个 chunk 仍是 IHDR。
      const animated = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...uint32Be(8),
        ...ascii("acTL"),
        ...new Array(8).fill(0),
      ])
      await expectRejection(animated, "image/png", "ASSET_ANIMATED")
    })

    it("stops scanning a PNG whose chunk length runs past the buffer", async () => {
      // 声明一个远超剩余长度的 chunk，解析器必须放弃而不是死循环。
      const truncated = pngBytes(20, 20, [
        ...uint32Be(0xffff),
        ...ascii("IDAT"),
        ...new Array(4).fill(0),
      ])
      const asset = await upload(truncated, "image/png")
      expect(asset.width).toBe(20)
    })
  })

  describe("JPEG", () => {
    it("reads dimensions from the first SOF segment", async () => {
      const asset = await upload(jpegBytes({ width: 800, height: 600 }), "image/jpeg")
      expect(asset.width).toBe(800)
      expect(asset.height).toBe(600)
    })

    it("accepts every progressive and arithmetic SOF marker", async () => {
      for (const marker of [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7]) {
        const asset = await upload(
          jpegBytes({ width: 64, height: 32, sofMarker: marker }),
          "image/jpeg",
        )
        expect(asset.width).toBe(64)
      }
      for (const marker of [0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]) {
        const asset = await upload(
          jpegBytes({ width: 64, height: 32, sofMarker: marker }),
          "image/jpeg",
        )
        expect(asset.height).toBe(32)
      }
    })

    it("skips APP and restart markers that precede the frame header", async () => {
      const app0 = [0xff, 0xe0, ...uint16Be(16), ...new Array(14).fill(0)]
      const asset = await upload(
        jpegBytes({ width: 200, height: 100, leadingSegments: [app0] }),
        "image/jpeg",
      )
      expect(asset.width).toBe(200)
    })

    it("skips standalone TEM and RSTn markers that carry no length", async () => {
      const asset = await upload(
        jpegBytes({
          width: 128,
          height: 64,
          leadingSegments: [
            [0xff, 0x01],
            [0xff, 0xd0],
          ],
        }),
        "image/jpeg",
      )
      expect(asset.width).toBe(128)
    })

    it("rejects a stream whose marker bytes are not 0xff prefixed", async () => {
      // 签名合法，APP0 段长度也合法，但下一个 marker 位置不是 0xff，扫描器必须放弃。
      await expectRejection(
        new Uint8Array([
          0xff,
          0xd8, // SOI
          0xff,
          0xe0, // APP0
          ...uint16Be(4),
          ...uint16Be(0),
          0x00, // 期望这里是 0xff，实际不是
          ...new Array(16).fill(0),
        ]),
        "image/jpeg",
        "ASSET_IMAGE_INVALID",
      )
    })

    it("stops at end-of-image and start-of-scan markers", async () => {
      for (const marker of [0xd9, 0xda]) {
        await expectRejection(
          new Uint8Array([0xff, 0xd8, 0xff, marker, ...new Array(20).fill(0)]),
          "image/jpeg",
          "ASSET_IMAGE_INVALID",
        )
      }
    })

    it("rejects segment lengths that are too small or run past the buffer", async () => {
      await expectRejection(
        jpegBytes({ width: 10, height: 10, segmentLength: 0 }),
        "image/jpeg",
        "ASSET_IMAGE_INVALID",
      )
      await expectRejection(
        jpegBytes({ width: 10, height: 10, segmentLength: 0xffff }),
        "image/jpeg",
        "ASSET_IMAGE_INVALID",
      )
    })

    it("rejects a frame header whose declared length cannot hold dimensions", async () => {
      await expectRejection(
        jpegBytes({ width: 10, height: 10, segmentLength: 5 }),
        "image/jpeg",
        "ASSET_IMAGE_INVALID",
      )
    })

    it("rejects a stream that ends before any frame header", async () => {
      await expectRejection(
        new Uint8Array([0xff, 0xd8, 0xff, 0xc0]),
        "image/jpeg",
        "ASSET_IMAGE_INVALID",
      )
    })

    it("rejects a truncated length field", async () => {
      await expectRejection(
        new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00]),
        "image/jpeg",
        "ASSET_IMAGE_INVALID",
      )
    })
  })

  describe("WebP", () => {
    it("reads extended dimensions from a VP8X chunk", async () => {
      const bytes = webpBytes([
        webpChunk("VP8X", [
          0x10, // 动画标记位留空
          ...new Array(3).fill(0),
          ...uint24Le(1919),
          ...uint24Le(1079),
        ]),
      ])
      const asset = await upload(bytes, "image/webp")
      expect(asset.width).toBe(1920)
      expect(asset.height).toBe(1080)
    })

    it("reads lossy dimensions from a VP8 chunk", async () => {
      const bytes = webpBytes([
        webpChunk("VP8 ", [
          0x00,
          0x00,
          0x00,
          0x9d,
          0x01,
          0x2a, // 关键帧同步码
          0x40,
          0x00, // 小端 16 位宽度 = 0x0040 = 64
          0x20,
          0x00, // 小端 16 位高度 = 0x0020 = 32
        ]),
      ])
      const asset = await upload(bytes, "image/webp")
      expect(asset.width).toBe(64)
      expect(asset.height).toBe(32)
    })

    it("reads lossless dimensions from a VP8L chunk", async () => {
      const bytes = webpBytes([webpChunk("VP8L", [0x2f, 0x2f, 0x00, 0x00, 0x00])])
      const asset = await upload(bytes, "image/webp")
      // 1 + 0x2f + ((0x00 & 0x3f) << 8) = 48；高度按位域拆解后为 1。
      expect(asset.width).toBe(48)
      expect(asset.height).toBe(1)
    })

    it("skips chunks that precede the image payload", async () => {
      const bytes = webpBytes([
        webpChunk("ICCP", [...new Array(4).fill(0)]),
        webpChunk("VP8X", [
          0x00,
          ...new Array(3).fill(0),
          ...uint24Le(99),
          ...uint24Le(49),
        ]),
      ])
      const asset = await upload(bytes, "image/webp")
      expect(asset.width).toBe(100)
      expect(asset.height).toBe(50)
    })

    it("rejects VP8 chunks without the keyframe sync code", async () => {
      const bytes = webpBytes([webpChunk("VP8 ", [...new Array(12).fill(0)])])
      await expectRejection(bytes, "image/webp", "ASSET_IMAGE_INVALID")
    })

    it("rejects VP8L chunks without the lossless signature byte", async () => {
      const bytes = webpBytes([webpChunk("VP8L", [...new Array(6).fill(0)])])
      await expectRejection(bytes, "image/webp", "ASSET_IMAGE_INVALID")
    })

    it("rejects VP8 and VP8L chunks shorter than their headers", async () => {
      await expectRejection(
        webpBytes([webpChunk("VP8 ", [...new Array(4).fill(0)])]),
        "image/webp",
        "ASSET_IMAGE_INVALID",
      )
      await expectRejection(
        webpBytes([webpChunk("VP8L", [0x2f, 0x00, 0x00])]),
        "image/webp",
        "ASSET_IMAGE_INVALID",
      )
    })

    it("rejects a chunk whose declared length runs past the buffer", async () => {
      const bytes = webpBytes([
        [...ascii("VP8X"), ...uint32Le(4096), ...new Array(4).fill(0)],
      ])
      await expectRejection(bytes, "image/webp", "ASSET_IMAGE_INVALID")
    })

    it("rejects a stream with no image payload chunk", async () => {
      await expectRejection(
        webpBytes([webpChunk("EXIF", [...new Array(4).fill(0)])]),
        "image/webp",
        "ASSET_IMAGE_INVALID",
      )
    })

    it("detects animation through the ANIM chunk", async () => {
      const bytes = webpBytes([
        webpChunk("VP8X", [
          0x00,
          ...new Array(3).fill(0),
          ...uint24Le(9),
          ...uint24Le(9),
        ]),
        webpChunk("ANIM", [...new Array(6).fill(0)]),
      ])
      await expectRejection(bytes, "image/webp", "ASSET_ANIMATED")
    })

    it("detects animation through the VP8X flags bit", async () => {
      const bytes = webpBytes([
        webpChunk("VP8X", [
          0x02, // 动画标记位
          ...new Array(3).fill(0),
          ...uint24Le(9),
          ...uint24Le(9),
        ]),
      ])
      await expectRejection(bytes, "image/webp", "ASSET_ANIMATED")
    })

    it("stops scanning a WebP whose chunk length runs past the buffer", async () => {
      const bytes = webpBytes([
        webpChunk("VP8X", [
          0x00,
          ...new Array(3).fill(0),
          ...uint24Le(9),
          ...uint24Le(9),
        ]),
        [...ascii("JUNK"), ...uint32Le(0xffff), ...new Array(4).fill(0)],
      ])
      const asset = await upload(bytes, "image/webp")
      expect(asset.width).toBe(10)
    })
  })

  describe("declared type and content agreement", () => {
    it("rejects content whose signature disagrees with the declared type", async () => {
      await expectRejection(pngBytes(10, 10), "image/webp", "ASSET_SIGNATURE_INVALID")
      await expectRejection(
        webpBytes([
          webpChunk("VP8X", [
            0x00,
            ...new Array(3).fill(0),
            ...uint24Le(9),
            ...uint24Le(9),
          ]),
        ]),
        "image/png",
        "ASSET_SIGNATURE_INVALID",
      )
    })
  })
})
