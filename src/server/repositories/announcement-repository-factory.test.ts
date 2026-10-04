import { afterEach, describe, expect, it } from "vitest"
import {
  getAnnouncementRepository,
  setAnnouncementRepositoryForTests,
} from "./announcement-repository-factory"
import { FileAnnouncementRepository } from "./file-announcement-repository"
import { SupabaseAnnouncementRepository } from "./supabase-announcement-repository"

const originalEnvironment = {
  RESUME_DATA_BACKEND: process.env.RESUME_DATA_BACKEND,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
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
  setAnnouncementRepositoryForTests(undefined)
  resetEnvironment()
})

describe("announcement repository factory", () => {
  it("uses the file repository for the file backend", () => {
    process.env.RESUME_DATA_BACKEND = "file"

    expect(getAnnouncementRepository()).toBeInstanceOf(FileAnnouncementRepository)
  })

  it("uses the Supabase repository for the Supabase backend", () => {
    process.env.RESUME_DATA_BACKEND = "supabase"
    process.env.SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

    expect(getAnnouncementRepository()).toBeInstanceOf(SupabaseAnnouncementRepository)
  })

  it("reuses the injected test repository", () => {
    const injected = getAnnouncementRepository()
    setAnnouncementRepositoryForTests(injected)

    expect(getAnnouncementRepository()).toBe(injected)
  })
})
