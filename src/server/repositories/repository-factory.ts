import { readResumePersistenceConfig } from "../config/resume-persistence-config"
import { FileResumeRepository } from "./file-resume-repository"
import type { ResumeRepository } from "./resume-repository"
import { SupabaseResumeRepository } from "./supabase-resume-repository"

let repository: ResumeRepository | undefined

export function getResumeRepository(): ResumeRepository {
  if (repository) {
    return repository
  }

  const config = readResumePersistenceConfig()
  repository =
    config.backend === "supabase"
      ? new SupabaseResumeRepository(config.supabaseUrl, config.serviceRoleKey)
      : new FileResumeRepository(config.databasePath)

  return repository
}

export function setResumeRepositoryForTests(
  testRepository: ResumeRepository | undefined,
): void {
  repository = testRepository
}
