import { afterEach, describe, expect, it } from "vitest"
import { FileResumeAssetStorage } from "./file-resume-asset-storage"
import {
  getResumeAssetStorage,
  setResumeAssetStorageForTests,
} from "./resume-asset-storage-factory"
import { SupabaseResumeAssetStorage } from "./supabase-resume-asset-storage"

const originalEnvironment = {
  RESUME_DATA_BACKEND: process.env.RESUME_DATA_BACKEND,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
}

function resetEnvironment(): void {
  for (const key of Object.keys(originalEnvironment) as Array<
    keyof typeof originalEnvironment
  >) {
    const value = originalEnvironment[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

afterEach(() => {
  setResumeAssetStorageForTests(undefined)
  resetEnvironment()
})

describe("resume asset storage factory", () => {
  it("uses local file storage for the file backend", () => {
    process.env.RESUME_DATA_BACKEND = "file"

    expect(getResumeAssetStorage()).toBeInstanceOf(FileResumeAssetStorage)
  })

  it("uses Supabase storage and configured bucket for the Supabase backend", () => {
    process.env.RESUME_DATA_BACKEND = "supabase"
    process.env.SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"
    process.env.SUPABASE_STORAGE_BUCKET = "custom-resume-assets"

    const storage = getResumeAssetStorage()

    expect(storage).toBeInstanceOf(SupabaseResumeAssetStorage)
    expect((storage as unknown as { bucket: string }).bucket).toBe(
      "custom-resume-assets",
    )
  })
})
