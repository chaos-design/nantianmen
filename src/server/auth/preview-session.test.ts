import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import type { AuthConfig } from "./auth-config"
import {
  createPreviewSessionCookieValue,
  getPreviewSessionMaxAgeSeconds,
  readPreviewSession,
} from "./preview-session"

/**
 * Preview 会话是签名 Cookie，校验失败必须一律回落到 null，
 * 绝不能因为签名不匹配而放行。
 */
const preview: NonNullable<AuthConfig["preview"]> = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "preview@example.com",
  resumeId: "00000000-0000-4000-8000-000000000010",
  sessionSecret: "preview-session-secret-with-enough-length",
}

const now = Date.UTC(2026, 0, 1)

function decodePayload(cookieValue: string): Record<string, unknown> {
  const [encodedPayload] = cookieValue.split(".")
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
}

function sign(payload: Record<string, unknown>, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  )
  const signature = signPayload(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

function signPayload(payload: string, secret: string): string {
  // 与实现保持一致的 HMAC-SHA256 签名。
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

describe("preview session cookie", () => {
  it("round-trips a freshly created session", () => {
    const cookieValue = createPreviewSessionCookieValue(preview, now)

    expect(readPreviewSession(cookieValue, preview, now)).toEqual({
      userId: preview.userId,
      email: preview.email,
      resumeId: preview.resumeId,
      expiresAt: now + 8 * 60 * 60 * 1000,
    })
  })

  it("exposes an eight hour max age", () => {
    expect(getPreviewSessionMaxAgeSeconds()).toBe(8 * 60 * 60)
  })

  it("returns null without a cookie or preview configuration", () => {
    expect(readPreviewSession(null, preview, now)).toBeNull()
    expect(readPreviewSession(undefined, preview, now)).toBeNull()
    expect(
      readPreviewSession("anything", null as unknown as AuthConfig["preview"], now),
    ).toBeNull()
  })

  it("rejects a tampered signature", () => {
    const cookieValue = createPreviewSessionCookieValue(preview, now)
    const [payload, signature] = cookieValue.split(".")
    const tampered = `${payload}.${signature.slice(0, -2)}AA`

    expect(readPreviewSession(tampered, preview, now)).toBeNull()
  })

  it("rejects a signature produced with a different secret", () => {
    const cookieValue = sign(
      { ...decodePayload(createPreviewSessionCookieValue(preview, now)) },
      "a-completely-different-secret-value-x",
    )

    expect(readPreviewSession(cookieValue, preview, now)).toBeNull()
  })

  it("rejects malformed cookie shapes", () => {
    expect(readPreviewSession("", preview, now)).toBeNull()
    expect(readPreviewSession("no-signature-part", preview, now)).toBeNull()
    expect(readPreviewSession(".signature-only", preview, now)).toBeNull()
    expect(readPreviewSession("payload..extra", preview, now)).toBeNull()
  })

  it("rejects an expired session", () => {
    const cookieValue = createPreviewSessionCookieValue(preview, now)
    const afterExpiry = now + 9 * 60 * 60 * 1000

    expect(readPreviewSession(cookieValue, preview, afterExpiry)).toBeNull()
  })

  it("rejects a payload that does not decode to the expected shape", () => {
    const notJson = Buffer.from("this is not json", "utf8").toString("base64url")
    expect(
      readPreviewSession(
        `${notJson}.${signPayload(notJson, preview.sessionSecret)}`,
        preview,
        now,
      ),
    ).toBeNull()

    const incomplete = {
      userId: preview.userId,
      email: preview.email,
      // 缺少 resumeId 和 expiresAt
    }
    expect(
      readPreviewSession(sign(incomplete, preview.sessionSecret), preview, now),
    ).toBeNull()

    const wrongTypes = {
      userId: preview.userId,
      email: preview.email,
      resumeId: preview.resumeId,
      expiresAt: "not-a-number",
    }
    expect(
      readPreviewSession(sign(wrongTypes, preview.sessionSecret), preview, now),
    ).toBeNull()
  })

  it("rejects a payload that does not match the configured preview identity", () => {
    const base = decodePayload(createPreviewSessionCookieValue(preview, now))

    for (const field of ["userId", "email", "resumeId"] as const) {
      const mismatched = { ...base, [field]: "00000000-0000-4000-8000-0000000000ff" }
      expect(
        readPreviewSession(sign(mismatched, preview.sessionSecret), preview, now),
      ).toBeNull()
    }
  })
})
