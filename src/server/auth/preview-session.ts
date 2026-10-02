import { createHmac, timingSafeEqual } from "node:crypto"
import type { AuthConfig } from "./auth-config"

const previewSessionTtlMs = 1000 * 60 * 60 * 8

interface PreviewSessionPayload {
  userId: string
  email: string
  resumeId: string
  expiresAt: number
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url")
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8")
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url")
}

function signaturesEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return (
    leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
  )
}

function parsePayload(rawPayload: string): PreviewSessionPayload | null {
  try {
    const payload = JSON.parse(rawPayload) as Partial<PreviewSessionPayload>
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.resumeId !== "string" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null
    }
    return {
      userId: payload.userId,
      email: payload.email,
      resumeId: payload.resumeId,
      expiresAt: payload.expiresAt,
    }
  } catch {
    return null
  }
}

export function createPreviewSessionCookieValue(
  preview: NonNullable<AuthConfig["preview"]>,
  now = Date.now(),
): string {
  const payload: PreviewSessionPayload = {
    userId: preview.userId,
    email: preview.email,
    resumeId: preview.resumeId,
    expiresAt: now + previewSessionTtlMs,
  }
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  return `${encodedPayload}.${signPayload(encodedPayload, preview.sessionSecret)}`
}

export function readPreviewSession(
  cookieValue: string | null | undefined,
  preview: AuthConfig["preview"],
  now = Date.now(),
): PreviewSessionPayload | null {
  if (!cookieValue || !preview) {
    return null
  }
  const [encodedPayload, signature, ...rest] = cookieValue.split(".")
  if (!encodedPayload || !signature || rest.length > 0) {
    return null
  }
  const expectedSignature = signPayload(encodedPayload, preview.sessionSecret)
  if (!signaturesEqual(signature, expectedSignature)) {
    return null
  }
  const payload = parsePayload(decodeBase64Url(encodedPayload))
  if (
    !payload ||
    payload.expiresAt < now ||
    payload.userId !== preview.userId ||
    payload.email !== preview.email ||
    payload.resumeId !== preview.resumeId
  ) {
    return null
  }
  return payload
}

export function getPreviewSessionMaxAgeSeconds(): number {
  return Math.floor(previewSessionTtlMs / 1000)
}
