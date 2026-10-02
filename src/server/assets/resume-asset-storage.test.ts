import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { FileResumeAssetStorage } from "./file-resume-asset-storage"
import { InMemoryResumeAssetStorage } from "./in-memory-resume-asset-storage"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

describe("resume asset storage", () => {
  it("stores defensive byte copies in memory", async () => {
    const storage = new InMemoryResumeAssetStorage()
    const input = new Uint8Array([1, 2, 3])

    await storage.put("resume/asset.webp", input, "image/webp")
    input[0] = 9
    const firstRead = await storage.get("resume/asset.webp")
    firstRead[1] = 8

    await expect(storage.get("resume/asset.webp")).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    )
    await expect(storage.put("resume/asset.webp", input, "image/webp")).rejects.toThrow(
      "ASSET_ALREADY_EXISTS",
    )
    await storage.delete("resume/asset.webp")
    await expect(storage.get("resume/asset.webp")).rejects.toThrow(
      "ASSET_BINARY_NOT_FOUND",
    )
  })

  it("stores local files under the configured root and rejects traversal", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "resume-assets-"))
    temporaryDirectories.push(directory)
    const storage = new FileResumeAssetStorage(directory)
    const bytes = new Uint8Array([4, 5, 6])

    await storage.put("resume-id/asset.png", bytes, "image/png")
    await expect(storage.get("resume-id/asset.png")).resolves.toEqual(bytes)
    await expect(storage.get("../outside.png")).rejects.toThrow(
      "INVALID_ASSET_STORAGE_PATH",
    )

    await storage.delete("resume-id/asset.png")
    await expect(storage.get("resume-id/asset.png")).rejects.toMatchObject({
      code: "ENOENT",
    })
  })
})
