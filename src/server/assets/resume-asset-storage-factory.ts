import { readResumePersistenceConfig } from "../config/resume-persistence-config"
import { FileResumeAssetStorage } from "./file-resume-asset-storage"
import type { ResumeAssetStorage } from "./resume-asset-storage"
import { SupabaseResumeAssetStorage } from "./supabase-resume-asset-storage"

let storage: ResumeAssetStorage | undefined

export function getResumeAssetStorage(): ResumeAssetStorage {
  if (storage) {
    return storage
  }

  const config = readResumePersistenceConfig()
  storage =
    config.backend === "supabase"
      ? new SupabaseResumeAssetStorage(
          config.supabaseUrl,
          config.serviceRoleKey,
          config.storageBucket,
        )
      : new FileResumeAssetStorage(config.assetRootDirectory)

  return storage
}

export function setResumeAssetStorageForTests(
  testStorage: ResumeAssetStorage | undefined,
): void {
  storage = testStorage
}
