import { describe, expect, it, vi } from "vitest"
import { InMemoryResumeAssetStorage } from "../assets/in-memory-resume-asset-storage"
import type { ResumeAssetRecord } from "../repositories/resume-repository"
import { InMemoryResumeRepository } from "../repositories/resume-repository"
import {
  detectImageMimeType,
  MAX_ASSET_BYTES,
  ResumeAssetService,
} from "./resume-asset-service"
import { type Actor, ResumeService } from "./resume-service"

const actor: Actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  isAdmin: false,
}
const otherActor: Actor = {
  userId: "00000000-0000-4000-8000-000000000002",
  isAdmin: false,
}

const pngBytes = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
)

const animatedPngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x61, 0x63, 0x54, 0x4c, 0,
  0, 0, 0,
])

const animatedWebpBytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x41, 0x4e, 0x49, 0x4d, 0,
  0, 0, 0,
])

function createAssetRecord(
  resumeId: string,
  index: number,
  byteSize = MAX_ASSET_BYTES,
): ResumeAssetRecord {
  return {
    id: `seed-asset-${index}`,
    resumeId,
    storagePath: `${resumeId}/seed-asset-${index}.png`,
    assetType: "image",
    mimeType: "image/png",
    byteSize,
    originalName: `seed-${index}.png`,
    width: 1,
    height: 1,
    createdAt: new Date(2026, 0, index + 1).toISOString(),
  }
}

function createServices() {
  const repository = new InMemoryResumeRepository()
  const storage = new InMemoryResumeAssetStorage()
  return {
    repository,
    storage,
    resumeService: new ResumeService(repository),
    assetService: new ResumeAssetService(repository, storage),
  }
}

describe("ResumeAssetService", () => {
  it("detects supported magic bytes without trusting file names", () => {
    expect(detectImageMimeType(pngBytes)).toBe("image/png")
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xdb]))).toBe(
      "image/jpeg",
    )
    expect(detectImageMimeType(animatedWebpBytes)).toBe("image/webp")
    expect(detectImageMimeType(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  it("uploads validated images and protects private reads", async () => {
    const { assetService, resumeService } = createServices()
    const created = await resumeService.createResume(actor)

    await expect(
      assetService.uploadAsset({
        resumeId: created.resume.id,
        actor: otherActor,
        originalName: "portrait.png",
        providedMimeType: "image/png",
        bytes: pngBytes,
      }),
    ).rejects.toMatchObject({ code: "RESUME_NOT_FOUND", status: 404 })

    const asset = await assetService.uploadAsset({
      resumeId: created.resume.id,
      actor,
      originalName: "../../portrait.png",
      providedMimeType: "image/png",
      bytes: pngBytes,
      alt: "专业头像",
    })

    expect(asset).toMatchObject({
      kind: "image",
      name: "portrait.png",
      mimeType: "image/png",
      width: 1,
      height: 1,
      alt: "专业头像",
    })
    await expect(
      assetService.getPrivateAsset(created.resume.id, asset.id, actor),
    ).resolves.toMatchObject({
      bytes: pngBytes,
      mimeType: "image/png",
    })
    await expect(
      assetService.getPrivateAsset(created.resume.id, asset.id, otherActor),
    ).rejects.toMatchObject({ code: "RESUME_NOT_FOUND", status: 404 })
  })

  it("rejects unsupported and mismatched image content", async () => {
    const { assetService, resumeService } = createServices()
    const created = await resumeService.createResume(actor)
    const baseInput = {
      resumeId: created.resume.id,
      actor,
      originalName: "image.png",
      bytes: pngBytes,
    }

    await expect(
      assetService.uploadAsset({
        ...baseInput,
        providedMimeType: "image/svg+xml",
      }),
    ).rejects.toMatchObject({ code: "ASSET_TYPE_UNSUPPORTED", status: 415 })
    await expect(
      assetService.uploadAsset({
        ...baseInput,
        providedMimeType: "image/jpeg",
      }),
    ).rejects.toMatchObject({ code: "ASSET_SIGNATURE_INVALID", status: 415 })
    await expect(
      assetService.uploadAsset({
        ...baseInput,
        providedMimeType: "image/png",
        bytes: new Uint8Array(),
      }),
    ).rejects.toMatchObject({ code: "ASSET_EMPTY", status: 422 })
    await expect(
      assetService.uploadAsset({
        ...baseInput,
        providedMimeType: "image/png",
        bytes: new Uint8Array(MAX_ASSET_BYTES + 1),
      }),
    ).rejects.toMatchObject({ code: "ASSET_TOO_LARGE", status: 413 })
    await expect(
      assetService.uploadAsset({
        ...baseInput,
        providedMimeType: "image/png",
        bytes: new Uint8Array(pngBytes.slice(0, 12)),
      }),
    ).rejects.toMatchObject({ code: "ASSET_IMAGE_INVALID", status: 422 })
    await expect(
      assetService.uploadAsset({
        ...baseInput,
        providedMimeType: "image/png",
        bytes: animatedPngBytes,
      }),
    ).rejects.toMatchObject({ code: "ASSET_ANIMATED", status: 415 })
    await expect(
      assetService.uploadAsset({
        ...baseInput,
        providedMimeType: "image/webp",
        bytes: animatedWebpBytes,
      }),
    ).rejects.toMatchObject({ code: "ASSET_ANIMATED", status: 415 })

    const oversizedDimensions = new Uint8Array(pngBytes)
    new DataView(oversizedDimensions.buffer).setUint32(16, 6001)
    await expect(
      assetService.uploadAsset({
        ...baseInput,
        providedMimeType: "image/png",
        bytes: oversizedDimensions,
      }),
    ).rejects.toMatchObject({ code: "ASSET_DIMENSIONS_INVALID", status: 422 })
    await expect(
      assetService.uploadAsset({
        ...baseInput,
        providedMimeType: "image/png",
        alt: "x".repeat(501),
      }),
    ).rejects.toMatchObject({ code: "ASSET_ALT_TOO_LONG", status: 422 })
  })

  it("enforces per-resume asset count and byte quotas", async () => {
    const countLimited = createServices()
    const countResume = await countLimited.resumeService.createResume(actor)
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        countLimited.repository.createAsset(
          createAssetRecord(countResume.resume.id, index, 1),
        ),
      ),
    )
    await expect(
      countLimited.assetService.uploadAsset({
        resumeId: countResume.resume.id,
        actor,
        originalName: "overflow.png",
        providedMimeType: "image/png",
        bytes: pngBytes,
      }),
    ).rejects.toMatchObject({ code: "ASSET_COUNT_EXCEEDED", status: 413 })

    const byteLimited = createServices()
    const byteResume = await byteLimited.resumeService.createResume(actor)
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        byteLimited.repository.createAsset(
          createAssetRecord(byteResume.resume.id, index),
        ),
      ),
    )
    await expect(
      byteLimited.assetService.uploadAsset({
        resumeId: byteResume.resume.id,
        actor,
        originalName: "overflow.png",
        providedMimeType: "image/png",
        bytes: pngBytes,
      }),
    ).rejects.toMatchObject({ code: "ASSET_QUOTA_EXCEEDED", status: 413 })
  })

  it("restores saved alt text when listing assets", async () => {
    const { assetService, resumeService } = createServices()
    const created = await resumeService.createResume(actor)
    const asset = await assetService.uploadAsset({
      resumeId: created.resume.id,
      actor,
      originalName: "",
      providedMimeType: "image/png",
      bytes: pngBytes,
    })
    expect(asset.name).toBe("image.png")
    await resumeService.saveDraft({
      resumeId: created.resume.id,
      actor,
      expectedVersion: 1,
      document: {
        ...created.resume.document,
        resources: {
          assets: [{ ...asset, alt: "已保存替代文本" }],
          placements: [],
        },
      },
    })

    await expect(
      assetService.listAssets(created.resume.id, actor),
    ).resolves.toMatchObject([{ id: asset.id, alt: "已保存替代文本" }])
  })

  it("maps binary storage read and write failures to service errors", async () => {
    const writeFailure = createServices()
    const writeResume = await writeFailure.resumeService.createResume(actor)
    vi.spyOn(writeFailure.storage, "put").mockRejectedValueOnce(
      new Error("storage unavailable"),
    )
    await expect(
      writeFailure.assetService.uploadAsset({
        resumeId: writeResume.resume.id,
        actor,
        originalName: "portrait.png",
        providedMimeType: "image/png",
        bytes: pngBytes,
      }),
    ).rejects.toMatchObject({ code: "ASSET_STORAGE_UNAVAILABLE", status: 503 })

    const readFailure = createServices()
    const readResume = await readFailure.resumeService.createResume(actor)
    const asset = await readFailure.assetService.uploadAsset({
      resumeId: readResume.resume.id,
      actor,
      originalName: "portrait.png",
      providedMimeType: "image/png",
      bytes: pngBytes,
    })
    const [record] = await readFailure.repository.listAssetsByResumeId(
      readResume.resume.id,
    )
    await readFailure.storage.delete(record.storagePath)
    await expect(
      readFailure.assetService.getPrivateAsset(readResume.resume.id, asset.id, actor),
    ).rejects.toMatchObject({ code: "ASSET_STORAGE_UNAVAILABLE", status: 503 })
    await expect(
      readFailure.assetService.getPrivateAsset(readResume.resume.id, "missing", actor),
    ).rejects.toMatchObject({ code: "ASSET_NOT_FOUND", status: 404 })
  })

  it("rolls back binary storage when metadata persistence fails", async () => {
    const { assetService, repository, resumeService, storage } = createServices()
    const created = await resumeService.createResume(actor)
    const deleteSpy = vi.spyOn(storage, "delete")
    vi.spyOn(repository, "createAsset").mockRejectedValueOnce(
      new Error("database unavailable"),
    )

    await expect(
      assetService.uploadAsset({
        resumeId: created.resume.id,
        actor,
        originalName: "portrait.png",
        providedMimeType: "image/png",
        bytes: pngBytes,
      }),
    ).rejects.toMatchObject({ code: "ASSET_STORAGE_UNAVAILABLE", status: 503 })

    const records = await repository.listAssetsByResumeId(created.resume.id)
    expect(records).toEqual([])
    expect(deleteSpy).toHaveBeenCalledOnce()
  })

  it("preserves the metadata error when binary rollback also fails", async () => {
    const { assetService, repository, resumeService, storage } = createServices()
    const created = await resumeService.createResume(actor)
    vi.spyOn(repository, "createAsset").mockRejectedValueOnce(
      new Error("database unavailable"),
    )
    vi.spyOn(storage, "delete").mockRejectedValueOnce(new Error("storage unavailable"))

    await expect(
      assetService.uploadAsset({
        resumeId: created.resume.id,
        actor,
        originalName: "portrait.png",
        providedMimeType: "image/png",
        bytes: pngBytes,
      }),
    ).rejects.toMatchObject({ code: "ASSET_STORAGE_UNAVAILABLE", status: 503 })
  })

  it("enforces asset ownership and tolerates orphan cleanup failures", async () => {
    const { assetService, repository, resumeService, storage } = createServices()
    const owner = await resumeService.createResume(actor)
    const other = await resumeService.createResume(otherActor)
    const asset = await assetService.uploadAsset({
      resumeId: owner.resume.id,
      actor,
      originalName: "portrait.png",
      providedMimeType: "image/png",
      bytes: pngBytes,
    })

    await expect(
      assetService.deleteAsset(other.resume.id, asset.id, otherActor),
    ).rejects.toMatchObject({ code: "ASSET_NOT_FOUND", status: 404 })

    vi.spyOn(repository, "deleteAsset").mockRejectedValueOnce(
      new Error("metadata unavailable"),
    )
    await expect(
      assetService.deleteAsset(owner.resume.id, asset.id, actor),
    ).rejects.toMatchObject({ code: "ASSET_DELETE_FAILED", status: 503 })

    vi.spyOn(storage, "delete").mockRejectedValueOnce(new Error("storage unavailable"))
    await expect(
      assetService.deleteAsset(owner.resume.id, asset.id, actor),
    ).resolves.toBeUndefined()
    await expect(repository.findAssetById(asset.id)).resolves.toBeNull()
  })

  it("removes deleted assets and placements from the draft document", async () => {
    const { assetService, repository, resumeService } = createServices()
    const created = await resumeService.createResume(actor)
    const asset = await assetService.uploadAsset({
      resumeId: created.resume.id,
      actor,
      originalName: "portrait.png",
      providedMimeType: "image/png",
      bytes: pngBytes,
    })
    const saved = await resumeService.saveDraft({
      resumeId: created.resume.id,
      actor,
      expectedVersion: created.resume.version,
      document: {
        ...created.resume.document,
        resources: {
          assets: [asset],
          placements: [
            {
              id: "placement-1",
              assetId: asset.id,
              pageIndex: 0,
              x: 32,
              y: 32,
              width: 144,
              height: 144,
              zIndex: 1,
              objectFit: "cover",
              shape: "circle",
            },
          ],
        },
      },
    })

    await assetService.deleteAsset(created.resume.id, asset.id, actor)

    const updated = await resumeService.getEditableResume(created.resume.id, actor)
    expect(updated.version).toBe(saved.version)
    expect(updated.document.resources.assets).toEqual([])
    expect(updated.document.resources.placements).toEqual([])
    await expect(repository.findAssetById(asset.id)).resolves.toBeNull()
  })

  it("serves only assets referenced by the latest publication snapshot", async () => {
    const { assetService, resumeService } = createServices()
    const created = await resumeService.createResume(actor)
    const publishedAsset = await assetService.uploadAsset({
      resumeId: created.resume.id,
      actor,
      originalName: "published.png",
      providedMimeType: "image/png",
      bytes: pngBytes,
    })
    const draftOnlyAsset = await assetService.uploadAsset({
      resumeId: created.resume.id,
      actor,
      originalName: "draft-only.png",
      providedMimeType: "image/png",
      bytes: pngBytes,
    })
    const document = {
      ...created.resume.document,
      resources: {
        assets: [publishedAsset, draftOnlyAsset],
        placements: [
          {
            id: "placement-1",
            assetId: publishedAsset.id,
            pageIndex: 0,
            x: 32,
            y: 32,
            width: 144,
            height: 144,
            zIndex: 1,
            objectFit: "cover" as const,
            shape: "circle" as const,
          },
        ],
      },
    }
    await resumeService.saveDraft({
      resumeId: created.resume.id,
      actor,
      expectedVersion: 1,
      document,
    })
    const publication = await resumeService.publishResume(created.resume.id, actor)

    await expect(
      assetService.getPublicAsset(publication.resume.publicSlug, publishedAsset.id),
    ).resolves.toMatchObject({ mimeType: "image/png" })
    await expect(
      assetService.getPublicAsset(publication.resume.publicSlug, draftOnlyAsset.id),
    ).rejects.toMatchObject({ code: "ASSET_NOT_FOUND", status: 404 })

    await expect(
      assetService.deleteAsset(created.resume.id, draftOnlyAsset.id, otherActor),
    ).rejects.toMatchObject({ code: "RESUME_NOT_FOUND", status: 404 })
    await expect(
      assetService.deleteAsset(created.resume.id, draftOnlyAsset.id, actor),
    ).resolves.toBeUndefined()
    await expect(
      assetService.getPrivateAsset(created.resume.id, draftOnlyAsset.id, actor),
    ).rejects.toMatchObject({ code: "ASSET_NOT_FOUND", status: 404 })
    await expect(
      assetService.deleteAsset(created.resume.id, publishedAsset.id, actor),
    ).rejects.toMatchObject({ code: "ASSET_PUBLISHED", status: 409 })
  })
})
