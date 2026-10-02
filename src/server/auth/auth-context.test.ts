import { describe, expect, it } from "vitest"
import { getOptionalAuthContext, requireAuthContext } from "./auth-context"
import { createPreviewSessionCookieValue } from "./preview-session"

const memberId = "00000000-0000-4000-8000-000000000001"
const adminId = "00000000-0000-4000-8000-000000000002"
const previewResumeId = "00000000-0000-4000-8000-000000000010"
const previewSecret = "preview-session-secret-with-enough-length"

describe("auth context", () => {
  it("builds a member from verified claims", async () => {
    await expect(
      getOptionalAuthContext({
        environment: {
          NODE_ENV: "test",
          ADMIN_USER_ID: adminId,
        },
        readClaims: async () => ({
          sub: memberId,
          email: "member@example.com",
        }),
      }),
    ).resolves.toEqual({
      userId: memberId,
      email: "member@example.com",
      isAdmin: false,
      mode: "user",
    })
  })

  it("recognizes the configured administrator", async () => {
    const context = await getOptionalAuthContext({
      environment: {
        NODE_ENV: "test",
        ADMIN_USER_ID: adminId,
      },
      readClaims: async () => ({
        sub: adminId,
        email: "admin@example.com",
      }),
    })

    expect(context?.isAdmin).toBe(true)
  })

  it("returns null when required claims are missing", async () => {
    await expect(
      getOptionalAuthContext({
        environment: { NODE_ENV: "test" },
        readClaims: async () => ({ sub: memberId }),
      }),
    ).resolves.toBeNull()
  })

  it("uses a complete non-production test identity", async () => {
    await expect(
      getOptionalAuthContext({
        environment: {
          NODE_ENV: "test",
          AUTH_TEST_USER_ID: memberId,
          AUTH_TEST_USER_EMAIL: "tester@example.com",
        },
        readClaims: async () => null,
      }),
    ).resolves.toEqual({
      userId: memberId,
      email: "tester@example.com",
      isAdmin: false,
      mode: "user",
    })
  })

  it("propagates the reserved preview resume to regular user sessions", async () => {
    await expect(
      getOptionalAuthContext({
        environment: {
          NODE_ENV: "test",
          ADMIN_USER_ID: adminId,
          PREVIEW_USER_ID: "00000000-0000-4000-8000-000000000003",
          PREVIEW_USER_EMAIL: "preview@example.com",
          PREVIEW_RESUME_ID: previewResumeId,
          PREVIEW_SESSION_SECRET: previewSecret,
        },
        readClaims: async () => ({
          sub: memberId,
          email: "member@example.com",
        }),
        readPreviewCookie: () => null,
      }),
    ).resolves.toEqual({
      userId: memberId,
      email: "member@example.com",
      isAdmin: false,
      mode: "user",
      previewResumeId,
    })
  })

  it("uses a signed non-production preview session", async () => {
    const preview = {
      userId: memberId,
      email: "preview@example.com",
      resumeId: previewResumeId,
      sessionSecret: previewSecret,
    }
    const cookieValue = createPreviewSessionCookieValue(preview)

    await expect(
      getOptionalAuthContext({
        environment: {
          NODE_ENV: "test",
          PREVIEW_USER_ID: preview.userId,
          PREVIEW_USER_EMAIL: preview.email,
          PREVIEW_RESUME_ID: preview.resumeId,
          PREVIEW_SESSION_SECRET: preview.sessionSecret,
        },
        readClaims: async () => null,
        readPreviewCookie: () => cookieValue,
      }),
    ).resolves.toEqual({
      userId: memberId,
      email: "preview@example.com",
      isAdmin: false,
      mode: "preview",
      previewResumeId,
    })
  })

  it("throws a stable error when authentication is required", async () => {
    await expect(
      requireAuthContext({
        environment: { NODE_ENV: "test" },
        readClaims: async () => null,
      }),
    ).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      status: 401,
    })
  })
})
