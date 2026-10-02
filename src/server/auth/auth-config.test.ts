import { describe, expect, it } from "vitest"
import { AuthConfigurationError, readAuthConfig } from "./auth-config"

const userId = "00000000-0000-4000-8000-000000000001"
const resumeId = "00000000-0000-4000-8000-000000000010"
const previewSecret = "preview-session-secret-with-enough-length"

describe("auth config", () => {
  it("parses administrator and non-production test identities", () => {
    expect(
      readAuthConfig({
        NODE_ENV: "test",
        ADMIN_USER_ID: userId,
        AUTH_TEST_USER_ID: userId,
        AUTH_TEST_USER_EMAIL: "tester@example.com",
      }),
    ).toEqual({
      adminUserId: userId,
      testUser: {
        userId,
        email: "tester@example.com",
      },
      preview: null,
    })
  })

  it("allows development without an administrator until auth is used", () => {
    expect(readAuthConfig({ NODE_ENV: "development" })).toEqual({
      adminUserId: null,
      testUser: null,
      preview: null,
    })
  })

  it("parses a complete non-production preview configuration", () => {
    expect(
      readAuthConfig({
        NODE_ENV: "test",
        PREVIEW_USER_ID: userId,
        PREVIEW_USER_EMAIL: "preview@example.com",
        PREVIEW_RESUME_ID: resumeId,
        PREVIEW_SESSION_SECRET: previewSecret,
      }),
    ).toEqual({
      adminUserId: null,
      testUser: null,
      preview: {
        userId,
        email: "preview@example.com",
        resumeId,
        sessionSecret: previewSecret,
      },
    })
  })

  it("requires a valid administrator in production", () => {
    expect(() => readAuthConfig({ NODE_ENV: "production" })).toThrow(
      AuthConfigurationError,
    )
    expect(() =>
      readAuthConfig({
        NODE_ENV: "production",
        ADMIN_USER_ID: "not-a-uuid",
      }),
    ).toThrow("ADMIN_USER_ID 必须是有效 UUID")
  })

  it("requires complete test identity configuration", () => {
    expect(() =>
      readAuthConfig({
        NODE_ENV: "test",
        AUTH_TEST_USER_ID: userId,
      }),
    ).toThrow("必须同时配置")
  })

  it("rejects test identities in production", () => {
    expect(() =>
      readAuthConfig({
        NODE_ENV: "production",
        ADMIN_USER_ID: userId,
        AUTH_TEST_USER_ID: userId,
        AUTH_TEST_USER_EMAIL: "tester@example.com",
      }),
    ).toThrow("生产环境禁止配置 AUTH_TEST_*")
  })

  it("requires complete preview configuration", () => {
    expect(() =>
      readAuthConfig({
        NODE_ENV: "test",
        PREVIEW_USER_ID: userId,
      }),
    ).toThrow("PREVIEW_* 配置必须同时提供")
  })
})
