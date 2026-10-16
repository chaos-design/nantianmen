import { afterEach, describe, expect, it } from "vitest"
import { InMemoryResumeAssetStorage } from "../assets/in-memory-resume-asset-storage"
import { setResumeAssetStorageForTests } from "../assets/resume-asset-storage-factory"
import { setResumeRepositoryForTests } from "../repositories/repository-factory"
import {
  InMemoryResumeRepository,
  type ResumeAssetRecord,
} from "../repositories/resume-repository"
import { loadEditorInitialData } from "./editor-initial-data"
import { type Actor, ResumeService } from "./resume-service"

const owner: Actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  isAdmin: false,
}

function storedAssetRecord(resumeId: string, id: string): ResumeAssetRecord {
  return {
    id,
    resumeId,
    storagePath: `${resumeId}/${id}.png`,
    assetType: "image",
    mimeType: "image/png",
    byteSize: 1024,
    originalName: `${id}.png`,
    width: 800,
    height: 600,
    createdAt: new Date(2026, 0, 1).toISOString(),
  }
}

async function seedRepositoryWithStoredAsset() {
  const repository = new InMemoryResumeRepository()
  const service = new ResumeService(repository)
  const { resume } = await service.createResume(owner)
  await repository.createAsset(storedAssetRecord(resume.id, "stored-1"))
  setResumeRepositoryForTests(repository)
  setResumeAssetStorageForTests(new InMemoryResumeAssetStorage())
  return resume
}

afterEach(() => {
  setResumeRepositoryForTests(undefined)
  setResumeAssetStorageForTests(undefined)
})

describe("loadEditorInitialData", () => {
  it("merges stored assets that are not yet in the draft document", async () => {
    const resume = await seedRepositoryWithStoredAsset()
    const result = await loadEditorInitialData(resume.id, owner)
    expect(result.error).toBeNull()
    expect(result.resume?.document.resources.assets.map((a) => a.id)).toEqual([
      "stored-1",
    ])
  })

  it("reports the domain error when the resume does not exist", async () => {
    await seedRepositoryWithStoredAsset()
    const result = await loadEditorInitialData(
      "00000000-0000-4000-8000-0000000000ff",
      owner,
    )
    expect(result.resume).toBeNull()
    expect(result.error).toBe("该简历不存在，或当前登录账号没有它的编辑权限")
  })
})
