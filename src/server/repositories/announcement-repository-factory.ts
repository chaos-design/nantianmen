import { readResumePersistenceConfig } from "../config/resume-persistence-config"
import type { AnnouncementRepository } from "./announcement-repository"
import { FileAnnouncementRepository } from "./file-announcement-repository"
import { SupabaseAnnouncementRepository } from "./supabase-announcement-repository"

let repository: AnnouncementRepository | undefined

export function getAnnouncementRepository(): AnnouncementRepository {
  if (repository) {
    return repository
  }

  const config = readResumePersistenceConfig()
  repository =
    config.backend === "supabase"
      ? new SupabaseAnnouncementRepository(config.supabaseUrl, config.serviceRoleKey)
      : new FileAnnouncementRepository()

  return repository
}

export function setAnnouncementRepositoryForTests(
  testRepository: AnnouncementRepository | undefined,
): void {
  repository = testRepository
}
