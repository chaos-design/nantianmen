import { afterEach, describe, expect, it } from "vitest"
import { FileResumeRepository } from "./file-resume-repository"
import { getResumeRepository, setResumeRepositoryForTests } from "./repository-factory"
import { SupabaseResumeRepository } from "./supabase-resume-repository"

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
  setResumeRepositoryForTests(undefined)
  resetEnvironment()
})

describe("resume repository factory", () => {
  it("uses the file repository for the file backend", () => {
    process.env.RESUME_DATA_BACKEND = "file"

    expect(getResumeRepository()).toBeInstanceOf(FileResumeRepository)
  })

  it("uses the Supabase repository for the Supabase backend", () => {
    process.env.RESUME_DATA_BACKEND = "supabase"
    process.env.SUPABASE_URL = "https://example.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

    expect(getResumeRepository()).toBeInstanceOf(SupabaseResumeRepository)
  })
})
