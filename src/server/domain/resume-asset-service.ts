import { randomUUID } from "node:crypto"
import type { ResumeImageAsset } from "../../shared/resume-schema/resume-schema"
import type { ResumeAssetStorage } from "../assets/resume-asset-storage"
import type {
  ResumeAssetRecord,
  ResumeRepository,
} from "../repositories/resume-repository"
import {
  type Actor,
  assertResumeCreationAllowed,
  assertWritableActor,
  authorizeResume,
  canViewerReadTestResume,
  DomainError,
  type EditableResume,
  isTestResume,
  type TestResumePolicy,
} from "./resume-service"

export const MAX_ASSET_BYTES = 5 * 1024 * 1024
export const MAX_ASSET_TOTAL_BYTES = 50 * 1024 * 1024
export const MAX_ASSET_DIMENSION = 6000
export const MAX_ASSETS_PER_RESUME = 20
export const MAX_UPLOAD_REQUEST_BYTES = MAX_ASSET_BYTES + 64 * 1024

type SupportedImageMimeType = ResumeImageAsset["mimeType"]

const supportedMimeTypes = new Set<SupportedImageMimeType>([
  "image/png",
  "image/jpeg",
  "image/webp",
])

const mimeTypeExtensions: Record<SupportedImageMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value)
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1000000 +
    bytes[offset + 1] * 0x10000 +
    bytes[offset + 2] * 0x100 +
    bytes[offset + 3]
  )
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] +
    bytes[offset + 1] * 0x100 +
    bytes[offset + 2] * 0x10000 +
    bytes[offset + 3] * 0x1000000
  )
}

function readUint16BigEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 0x100 + bytes[offset + 1]
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000
}

export function detectImageMimeType(bytes: Uint8Array): SupportedImageMimeType | null {
  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png"
  }
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

function readPngDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 24 || readAscii(bytes, 12, 4) !== "IHDR") {
    return null
  }
  return {
    width: readUint32BigEndian(bytes, 16),
    height: readUint32BigEndian(bytes, 20),
  }
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  )
}

function readJpegDimensions(bytes: Uint8Array): {
  width: number
  height: number
} | null {
  let offset = 2
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null
    }
    while (bytes[offset] === 0xff) {
      offset += 1
    }
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd9 || marker === 0xda) {
      return null
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue
    }
    if (offset + 2 > bytes.length) {
      return null
    }
    const segmentLength = readUint16BigEndian(bytes, offset)
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null
    }
    if (isJpegStartOfFrame(marker)) {
      if (segmentLength < 7) {
        return null
      }
      return {
        height: readUint16BigEndian(bytes, offset + 3),
        width: readUint16BigEndian(bytes, offset + 5),
      }
    }
    offset += segmentLength
  }
  return null
}

function readVp8Dimensions(bytes: Uint8Array, offset: number, length: number) {
  if (
    length < 10 ||
    offset + 10 > bytes.length ||
    bytes[offset + 3] !== 0x9d ||
    bytes[offset + 4] !== 0x01 ||
    bytes[offset + 5] !== 0x2a
  ) {
    return null
  }
  return {
    width:
      readUint16BigEndian(Uint8Array.of(bytes[offset + 7], bytes[offset + 6]), 0) &
      0x3fff,
    height:
      readUint16BigEndian(Uint8Array.of(bytes[offset + 9], bytes[offset + 8]), 0) &
      0x3fff,
  }
}

function readVp8LosslessDimensions(bytes: Uint8Array, offset: number, length: number) {
  if (length < 5 || offset + 5 > bytes.length || bytes[offset] !== 0x2f) {
    return null
  }
  const byte1 = bytes[offset + 1]
  const byte2 = bytes[offset + 2]
  const byte3 = bytes[offset + 3]
  const byte4 = bytes[offset + 4]
  return {
    width: 1 + byte1 + ((byte2 & 0x3f) << 8),
    height: 1 + ((byte2 & 0xc0) >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10),
  }
}

function readWebpDimensions(bytes: Uint8Array): {
  width: number
  height: number
} | null {
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const chunkType = readAscii(bytes, offset, 4)
    const chunkLength = readUint32LittleEndian(bytes, offset + 4)
    const payloadOffset = offset + 8
    if (payloadOffset + chunkLength > bytes.length) {
      return null
    }
    if (chunkType === "VP8X" && chunkLength >= 10) {
      return {
        width: 1 + readUint24LittleEndian(bytes, payloadOffset + 4),
        height: 1 + readUint24LittleEndian(bytes, payloadOffset + 7),
      }
    }
    if (chunkType === "VP8 ") {
      return readVp8Dimensions(bytes, payloadOffset, chunkLength)
    }
    if (chunkType === "VP8L") {
      return readVp8LosslessDimensions(bytes, payloadOffset, chunkLength)
    }
    offset = payloadOffset + chunkLength + (chunkLength % 2)
  }
  return null
}

function readImageDimensions(
  bytes: Uint8Array,
  mimeType: SupportedImageMimeType,
): { width: number; height: number } | null {
  switch (mimeType) {
    case "image/png":
      return readPngDimensions(bytes)
    case "image/jpeg":
      return readJpegDimensions(bytes)
    case "image/webp":
      return readWebpDimensions(bytes)
  }
}

function isAnimatedPng(bytes: Uint8Array): boolean {
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const chunkLength = readUint32BigEndian(bytes, offset)
    const chunkType = readAscii(bytes, offset + 4, 4)
    if (chunkType === "acTL") {
      return true
    }
    const nextOffset = offset + 12 + chunkLength
    if (nextOffset <= offset || nextOffset > bytes.length) {
      return false
    }
    offset = nextOffset
  }
  return false
}

function isAnimatedWebp(bytes: Uint8Array): boolean {
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const chunkType = readAscii(bytes, offset, 4)
    const chunkLength = readUint32LittleEndian(bytes, offset + 4)
    if (chunkType === "ANIM") {
      return true
    }
    if (
      chunkType === "VP8X" &&
      offset + 8 < bytes.length &&
      (bytes[offset + 8] & 0x02) !== 0
    ) {
      return true
    }
    const nextOffset = offset + 8 + chunkLength + (chunkLength % 2)
    if (nextOffset <= offset || nextOffset > bytes.length) {
      return false
    }
    offset = nextOffset
  }
  return false
}

function sanitizeOriginalName(
  originalName: string,
  mimeType: SupportedImageMimeType,
): string {
  const leafName = originalName.replaceAll("\\", "/").split("/").at(-1) ?? ""
  const safeName = Array.from(leafName)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint >= 32 && codePoint !== 127
    })
    .join("")
    .trim()
    .slice(0, 255)
  return safeName || `image.${mimeTypeExtensions[mimeType]}`
}

function validateImage(
  bytes: Uint8Array,
  providedMimeType: string,
): {
  mimeType: SupportedImageMimeType
  width: number
  height: number
} {
  if (bytes.byteLength === 0) {
    throw new DomainError("ASSET_EMPTY", "图片文件不能为空", 422)
  }
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    throw new DomainError("ASSET_TOO_LARGE", "单个图片不能超过 5 MB", 413)
  }
  if (!supportedMimeTypes.has(providedMimeType as SupportedImageMimeType)) {
    throw new DomainError(
      "ASSET_TYPE_UNSUPPORTED",
      "仅支持 PNG、JPEG 和 WebP 图片",
      415,
    )
  }

  const detectedMimeType = detectImageMimeType(bytes)
  if (!detectedMimeType || detectedMimeType !== providedMimeType) {
    throw new DomainError(
      "ASSET_SIGNATURE_INVALID",
      "图片内容与声明的文件类型不一致",
      415,
    )
  }
  if (
    (detectedMimeType === "image/png" && isAnimatedPng(bytes)) ||
    (detectedMimeType === "image/webp" && isAnimatedWebp(bytes))
  ) {
    throw new DomainError("ASSET_ANIMATED", "不支持动画图片", 415)
  }

  const dimensions = readImageDimensions(bytes, detectedMimeType)
  if (!dimensions) {
    throw new DomainError("ASSET_IMAGE_INVALID", "无法解析图片尺寸", 422)
  }
  const { width, height } = dimensions
  if (
    !width ||
    !height ||
    width > MAX_ASSET_DIMENSION ||
    height > MAX_ASSET_DIMENSION
  ) {
    throw new DomainError(
      "ASSET_DIMENSIONS_INVALID",
      "图片尺寸必须在 1×1 到 6000×6000 像素之间",
      422,
    )
  }

  return { mimeType: detectedMimeType, width, height }
}

function toImageAsset(record: ResumeAssetRecord, alt = ""): ResumeImageAsset {
  return {
    id: record.id,
    kind: "image",
    name: record.originalName,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    width: record.width,
    height: record.height,
    alt,
  }
}

// 复制简历的新标题 = 源标题 + 「副本」，并按码点截断到 120，
// 与 document.metadata.title（max 120）保持一致。
const DUPLICATE_TITLE_SUFFIX = "副本"
const DUPLICATE_TITLE_MAX = 120

function buildDuplicateTitle(sourceTitle: string): string {
  const chars = Array.from(sourceTitle)
  const room = DUPLICATE_TITLE_MAX - DUPLICATE_TITLE_SUFFIX.length
  return [...chars.slice(0, room), ...Array.from(DUPLICATE_TITLE_SUFFIX)].join("")
}

export interface AssetBinary {
  bytes: Uint8Array
  mimeType: SupportedImageMimeType
  name: string
}

export class ResumeAssetService {
  constructor(
    private readonly repository: ResumeRepository,
    private readonly storage: ResumeAssetStorage,
    private readonly testResumePolicy: TestResumePolicy = { testUserId: null },
  ) {}

  async uploadAsset(input: {
    resumeId: string
    actor: Actor
    originalName: string
    providedMimeType: string
    bytes: Uint8Array
    alt?: string
  }): Promise<ResumeImageAsset> {
    await authorizeResume(this.repository, input.resumeId, input.actor)
    assertWritableActor(input.actor)
    if ((input.alt?.length ?? 0) > 500) {
      throw new DomainError("ASSET_ALT_TOO_LONG", "图片替代文本不能超过 500 字", 422)
    }

    const image = validateImage(input.bytes, input.providedMimeType)
    const existingAssets = await this.repository.listAssetsByResumeId(input.resumeId)
    if (existingAssets.length >= MAX_ASSETS_PER_RESUME) {
      throw new DomainError("ASSET_COUNT_EXCEEDED", "每份简历最多保存 20 个资源", 413)
    }
    const totalBytes = existingAssets.reduce(
      (sum, asset) => sum + asset.byteSize,
      input.bytes.byteLength,
    )
    if (totalBytes > MAX_ASSET_TOTAL_BYTES) {
      throw new DomainError(
        "ASSET_QUOTA_EXCEEDED",
        "每份简历的资源总量不能超过 50 MB",
        413,
      )
    }

    const assetId = randomUUID()
    const storagePath = `${input.resumeId}/${assetId}.${mimeTypeExtensions[image.mimeType]}`
    const record: ResumeAssetRecord = {
      id: assetId,
      resumeId: input.resumeId,
      storagePath,
      assetType: "image",
      mimeType: image.mimeType,
      byteSize: input.bytes.byteLength,
      originalName: sanitizeOriginalName(input.originalName, image.mimeType),
      width: image.width,
      height: image.height,
      createdAt: new Date().toISOString(),
    }

    try {
      await this.storage.put(storagePath, input.bytes, image.mimeType)
    } catch {
      throw new DomainError("ASSET_STORAGE_UNAVAILABLE", "图片存储暂时不可用", 503)
    }

    try {
      const created = await this.repository.createAsset(record)
      return toImageAsset(created, input.alt?.trim() ?? "")
    } catch {
      try {
        await this.storage.delete(storagePath)
      } catch {
        // Preserve the metadata failure as the client-facing error.
      }
      throw new DomainError("ASSET_STORAGE_UNAVAILABLE", "图片元数据保存失败", 503)
    }
  }

  async listAssets(resumeId: string, actor: Actor): Promise<ResumeImageAsset[]> {
    const resume = await authorizeResume(this.repository, resumeId, actor)
    const savedAssets = new Map(
      resume.draftDocument.resources.assets.map((asset) => [asset.id, asset]),
    )
    const records = await this.repository.listAssetsByResumeId(resumeId)
    return records.map((record) =>
      toImageAsset(record, savedAssets.get(record.id)?.alt ?? ""),
    )
  }

  async deleteAsset(resumeId: string, assetId: string, actor: Actor): Promise<void> {
    await authorizeResume(this.repository, resumeId, actor)
    assertWritableActor(actor)
    const asset = await this.repository.findAssetById(assetId)
    if (!asset || asset.resumeId !== resumeId) {
      throw new DomainError("ASSET_NOT_FOUND", "图片资源不存在", 404)
    }
    if (await this.repository.isAssetReferencedByPublication(resumeId, assetId)) {
      throw new DomainError("ASSET_PUBLISHED", "该图片已被发布快照引用，不能删除", 409)
    }

    try {
      await this.repository.deleteAsset(assetId)
      await this.repository.removeAssetReferencesFromDraft(resumeId, assetId)
    } catch {
      throw new DomainError("ASSET_DELETE_FAILED", "图片资源删除失败", 503)
    }
    try {
      await this.storage.delete(asset.storagePath)
    } catch {
      // Metadata deletion makes the asset unreachable; orphan cleanup can retry later.
    }
  }

  /**
   * 复制一份简历：生成新的简历记录（标题追加「副本」、新 publicSlug、归属当前
   * 操作者），连同源简历的图片二进制与资源元数据一起复制，并同步 remap
   * 文档中 resources 的资源 id，确保副本不出现图片断链。
   *
   * 复制的是「草稿 + 图片」，发布快照是源简历独立的不可变数据，副本不带发布
   * 历史；因此副本创建后处于草稿未发布状态。
   */
  async duplicateResume(sourceResumeId: string, actor: Actor): Promise<EditableResume> {
    await authorizeResume(this.repository, sourceResumeId, actor)
    assertWritableActor(actor)
    await assertResumeCreationAllowed(this.repository, actor)

    const source = await this.repository.findResumeById(sourceResumeId)
    if (!source) {
      throw new DomainError("RESUME_NOT_FOUND", "简历不存在", 404)
    }

    const document = structuredClone(source.draftDocument)
    document.metadata.title = buildDuplicateTitle(source.title)

    // 记录每份资源的源 id，再生成副本新 id，保证后续能按源 id 查二进制。
    const sourceAssetIds = document.resources.assets.map((asset) => asset.id)
    const assetIdMapping = new Map<string, string>()
    for (let index = 0; index < document.resources.assets.length; index += 1) {
      const copiedAssetId = randomUUID()
      assetIdMapping.set(sourceAssetIds[index], copiedAssetId)
      document.resources.assets[index].id = copiedAssetId
    }
    // 图片位置通过 assetId 关联文档资源，同步换成副本资源 id。
    for (const placement of document.resources.placements) {
      const mappedId = assetIdMapping.get(placement.assetId)
      if (mappedId) {
        placement.assetId = mappedId
      }
    }

    const newResumeId = randomUUID()
    const createdRecord = await this.repository.createResume({
      id: newResumeId,
      ownerId: actor.userId,
      title: document.metadata.title,
      publicSlug: randomUUID().replaceAll("-", ""),
      document,
    })

    // 逐个复制二进制与资源元数据；任一失败都回滚已产生的副本资源、
    // 存储对象与简历记录，保证不留下半成品。
    const sourceAssets = await this.repository.listAssetsByResumeId(sourceResumeId)
    const sourceRecordById = new Map(sourceAssets.map((record) => [record.id, record]))
    const copiedStoragePaths: string[] = []
    const copiedAssetIds: string[] = []
    try {
      for (let index = 0; index < document.resources.assets.length; index += 1) {
        const documentAsset = document.resources.assets[index]
        const sourceRecord = sourceRecordById.get(sourceAssetIds[index])
        if (!sourceRecord) {
          // 源简历本就没有该图片二进制（历史断链），保留文档引用即可。
          continue
        }
        const extension = mimeTypeExtensions[documentAsset.mimeType]
        const storagePath = `${newResumeId}/${documentAsset.id}.${extension}`
        const bytes = await this.storage.get(sourceRecord.storagePath)
        await this.storage.put(storagePath, bytes, documentAsset.mimeType)
        copiedStoragePaths.push(storagePath)
        await this.repository.createAsset({
          id: documentAsset.id,
          resumeId: newResumeId,
          storagePath,
          assetType: "image",
          mimeType: documentAsset.mimeType,
          byteSize: bytes.byteLength,
          originalName: sourceRecord.originalName,
          width: sourceRecord.width,
          height: sourceRecord.height,
          createdAt: new Date().toISOString(),
        })
        copiedAssetIds.push(documentAsset.id)
      }
    } catch {
      await this.rollbackDuplicate(newResumeId, copiedAssetIds, copiedStoragePaths)
      throw new DomainError("RESUME_DUPLICATE_FAILED", "复制简历失败", 503)
    }

    return {
      id: createdRecord.id,
      title: createdRecord.title,
      publicSlug: createdRecord.publicSlug,
      document: structuredClone(createdRecord.draftDocument),
      version: createdRecord.draftVersion,
      published: Boolean(createdRecord.latestPublicationId),
      updatedAt: createdRecord.updatedAt,
    }
  }

  private async rollbackDuplicate(
    newResumeId: string,
    assetIds: string[],
    storagePaths: string[],
  ): Promise<void> {
    for (const assetId of assetIds) {
      try {
        await this.repository.deleteAsset(assetId)
      } catch {
        // Metadata cleanup is best-effort; storage objects are still reclaimed below.
      }
    }
    for (const storagePath of storagePaths) {
      try {
        await this.storage.delete(storagePath)
      } catch {
        // 对象存储清理失败由孤儿回收兜底，不阻断简历记录删除。
      }
    }
    try {
      await this.repository.deleteResume(newResumeId)
    } catch {
      throw new Error("RESUME_DUPLICATE_ROLLBACK_FAILED")
    }
  }

  async getPrivateAsset(
    resumeId: string,
    assetId: string,
    actor: Actor,
  ): Promise<AssetBinary> {
    await authorizeResume(this.repository, resumeId, actor)
    const asset = await this.repository.findAssetById(assetId)
    if (!asset || asset.resumeId !== resumeId) {
      throw new DomainError("ASSET_NOT_FOUND", "图片资源不存在", 404)
    }
    return this.readAsset(asset)
  }

  async getPublicAsset(
    publicSlug: string,
    assetId: string,
    viewer?: Actor | null,
  ): Promise<AssetBinary> {
    const publicResume = await this.repository.findPublicResume(publicSlug)
    if (
      publicResume &&
      isTestResume(publicResume.resume.ownerId, this.testResumePolicy.testUserId) &&
      !canViewerReadTestResume(viewer ?? null, publicResume.resume)
    ) {
      // 与资源不存在保持一致的回退，不暴露测试简历是否发布过。
      throw new DomainError("ASSET_NOT_FOUND", "图片资源不存在", 404)
    }
    const isReferenced =
      publicResume?.publication.publishedDocument.resources.placements.some(
        (placement) => placement.assetId === assetId,
      ) ?? false
    if (!publicResume || !isReferenced) {
      throw new DomainError("ASSET_NOT_FOUND", "图片资源不存在", 404)
    }

    const asset = await this.repository.findAssetById(assetId)
    if (!asset || asset.resumeId !== publicResume.resume.id) {
      throw new DomainError("ASSET_NOT_FOUND", "图片资源不存在", 404)
    }
    return this.readAsset(asset)
  }

  private async readAsset(asset: ResumeAssetRecord): Promise<AssetBinary> {
    try {
      return {
        bytes: await this.storage.get(asset.storagePath),
        mimeType: asset.mimeType,
        name: asset.originalName,
      }
    } catch {
      throw new DomainError("ASSET_STORAGE_UNAVAILABLE", "图片存储暂时不可用", 503)
    }
  }
}
