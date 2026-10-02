import { createClient } from "../../lib/supabase/server"
import { readAuthConfig } from "./auth-config"
import { readPreviewSession } from "./preview-session"
import { previewSessionCookieName } from "./preview-session-cookie"

type Environment = Readonly<Record<string, string | undefined>>
type Claims = Readonly<Record<string, unknown>>
type ClaimsReader = () => Promise<Claims | null>
type PreviewCookieReader = () => Promise<string | null> | string | null

async function readRequestPreviewCookie(): Promise<string | null> {
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  return cookieStore.get(previewSessionCookieName)?.value ?? null
}

export interface AuthContext {
  userId: string
  email: string
  isAdmin: boolean
  mode: "user" | "preview"
  previewResumeId?: string
}

export class AuthenticationError extends Error {
  constructor(
    public readonly code: "AUTH_REQUIRED" | "AUTH_PROVIDER_UNAVAILABLE",
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = "AuthenticationError"
  }
}

async function readSupabaseClaims(): Promise<Claims | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    if (error || !data?.claims) {
      return null
    }
    return data.claims
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("缺少公共 Supabase")) {
      throw error
    }
    throw new AuthenticationError(
      "AUTH_PROVIDER_UNAVAILABLE",
      "登录服务暂时不可用，请稍后重试",
      503,
    )
  }
}

export async function getOptionalAuthContext(options?: {
  environment?: Environment
  readClaims?: ClaimsReader
  readPreviewCookie?: PreviewCookieReader
}): Promise<AuthContext | null> {
  const config = readAuthConfig(options?.environment)
  if (config.preview) {
    const previewCookie = await (
      options?.readPreviewCookie ?? readRequestPreviewCookie
    )()
    const previewSession = readPreviewSession(previewCookie, config.preview)
    if (previewSession) {
      return {
        userId: previewSession.userId,
        email: previewSession.email,
        isAdmin: false,
        mode: "preview",
        previewResumeId: previewSession.resumeId,
      }
    }
  }

  if (config.testUser) {
    return {
      userId: config.testUser.userId,
      email: config.testUser.email,
      isAdmin: config.testUser.userId === config.adminUserId,
      mode: "user",
      ...(config.preview ? { previewResumeId: config.preview.resumeId } : {}),
    }
  }

  const claims = await (options?.readClaims ?? readSupabaseClaims)()
  const userId = typeof claims?.sub === "string" ? claims.sub : ""
  const email = typeof claims?.email === "string" ? claims.email.trim() : ""
  if (!userId || !email) {
    return null
  }

  return {
    userId,
    email,
    isAdmin: userId === config.adminUserId,
    mode: "user",
    ...(config.preview ? { previewResumeId: config.preview.resumeId } : {}),
  }
}

export async function requireAuthContext(options?: {
  environment?: Environment
  readClaims?: ClaimsReader
  readPreviewCookie?: PreviewCookieReader
}): Promise<AuthContext> {
  const context = await getOptionalAuthContext(options)
  if (!context) {
    throw new AuthenticationError("AUTH_REQUIRED", "请先登录后再继续", 401)
  }
  return context
}
