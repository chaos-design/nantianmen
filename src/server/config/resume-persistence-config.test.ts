import { describe, expect, it } from "vitest"
import {
  readResumePersistenceConfig,
  ServerConfigurationError,
} from "./resume-persistence-config"

describe("resume persistence config", () => {
  it("uses the file backend only outside production", () => {
    expect(
      readResumePersistenceConfig({
        NODE_ENV: "test",
        RESUME_DATA_BACKEND: "file",
      }),
    ).toEqual({
      backend: "file",
      databasePath: ".data/resumes.json",
      assetRootDirectory: ".data/assets",
    })
    expect(() =>
      readResumePersistenceConfig({
        NODE_ENV: "production",
        RESUME_DATA_BACKEND: "file",
      }),
    ).toThrowError("必须配置为 supabase")
  })

  it("defaults to the file backend outside production", () => {
    expect(readResumePersistenceConfig({ NODE_ENV: "development" })).toEqual({
      backend: "file",
      databasePath: ".data/resumes.json",
      assetRootDirectory: ".data/assets",
    })
    expect(readResumePersistenceConfig({ NODE_ENV: "test" })).toEqual({
      backend: "file",
      databasePath: ".data/resumes.json",
      assetRootDirectory: ".data/assets",
    })
  })

  it("accepts isolated file backend paths for tests", () => {
    expect(
      readResumePersistenceConfig({
        NODE_ENV: "test",
        RESUME_DATA_BACKEND: "file",
        RESUME_FILE_DATABASE_PATH: ".data/e2e/resumes.json",
        RESUME_FILE_ASSET_DIR: ".data/e2e/assets",
      }),
    ).toEqual({
      backend: "file",
      databasePath: ".data/e2e/resumes.json",
      assetRootDirectory: ".data/e2e/assets",
    })
  })

  it("requires an explicit backend in production", () => {
    expect(() => readResumePersistenceConfig({ NODE_ENV: "production" })).toThrowError(
      "生产环境必须配置 RESUME_DATA_BACKEND",
    )
  })

  it("parses and normalizes a complete Supabase config", () => {
    expect(
      readResumePersistenceConfig({
        RESUME_DATA_BACKEND: "supabase",
        SUPABASE_URL: "https://example.supabase.co///",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    ).toEqual({
      backend: "supabase",
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "service-role-key",
      storageBucket: "resume-assets",
    })
  })

  it("accepts a custom private storage bucket", () => {
    expect(
      readResumePersistenceConfig({
        RESUME_DATA_BACKEND: "supabase",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SUPABASE_STORAGE_BUCKET: "private-resume-images",
      }),
    ).toMatchObject({
      backend: "supabase",
      storageBucket: "private-resume-images",
    })
  })

  it.each([
    {
      name: "SUPABASE_URL",
      environment: {
        RESUME_DATA_BACKEND: "supabase",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      },
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      environment: {
        RESUME_DATA_BACKEND: "supabase",
        SUPABASE_URL: "https://example.supabase.co",
      },
    },
    {
      name: "SUPABASE_STORAGE_BUCKET",
      environment: {
        RESUME_DATA_BACKEND: "supabase",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SUPABASE_STORAGE_BUCKET: " ",
      },
    },
  ])("rejects a missing or empty $name", ({ environment, name }) => {
    expect(() => readResumePersistenceConfig(environment)).toThrowError(name)
  })

  it("rejects unsupported backends and invalid Supabase urls", () => {
    expect(() =>
      readResumePersistenceConfig({ RESUME_DATA_BACKEND: "memory" }),
    ).toThrowError("RESUME_DATA_BACKEND")
    expect(() =>
      readResumePersistenceConfig({
        RESUME_DATA_BACKEND: "supabase",
        SUPABASE_URL: "ftp://example.com",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    ).toThrowError("必须使用 http 或 https")
  })

  it("never includes the service role key in configuration errors", () => {
    const secret = "never-print-this-service-role-key"
    let thrown: unknown
    try {
      readResumePersistenceConfig({
        RESUME_DATA_BACKEND: "supabase",
        SUPABASE_URL: "not-a-url",
        SUPABASE_SERVICE_ROLE_KEY: secret,
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(ServerConfigurationError)
    expect(String(thrown)).not.toContain(secret)
  })
})
