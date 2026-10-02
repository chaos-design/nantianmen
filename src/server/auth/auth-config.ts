type Environment = Readonly<Record<string, string | undefined>>

export interface AuthConfig {
  adminUserId: string | null
  testUser: {
    userId: string
    email: string
  } | null
  preview: {
    userId: string
    email: string
    resumeId: string
    sessionSecret: string
  } | null
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class AuthConfigurationError extends Error {
  readonly code = "AUTH_CONFIG_INVALID"
  readonly status = 500

  constructor(message: string) {
    super(message)
    this.name = "AuthConfigurationError"
  }
}

function readOptionalValue(environment: Environment, name: string): string | null {
  return environment[name]?.trim() || null
}

function assertUuid(value: string, name: string): void {
  if (!uuidPattern.test(value)) {
    throw new AuthConfigurationError(`服务端配置 ${name} 必须是有效 UUID`)
  }
}

export function readAuthConfig(environment: Environment = process.env): AuthConfig {
  const adminUserId = readOptionalValue(environment, "ADMIN_USER_ID")
  const testUserId = readOptionalValue(environment, "AUTH_TEST_USER_ID")
  const testUserEmail = readOptionalValue(environment, "AUTH_TEST_USER_EMAIL")
  const previewUserId = readOptionalValue(environment, "PREVIEW_USER_ID")
  const previewUserEmail = readOptionalValue(environment, "PREVIEW_USER_EMAIL")
  const previewResumeId = readOptionalValue(environment, "PREVIEW_RESUME_ID")
  const previewSessionSecret = readOptionalValue(environment, "PREVIEW_SESSION_SECRET")
  const isProduction = environment.NODE_ENV === "production"

  if (adminUserId) {
    assertUuid(adminUserId, "ADMIN_USER_ID")
  }
  if (isProduction && !adminUserId) {
    throw new AuthConfigurationError("生产环境缺少服务端配置：ADMIN_USER_ID")
  }
  if (Boolean(testUserId) !== Boolean(testUserEmail)) {
    throw new AuthConfigurationError(
      "AUTH_TEST_USER_ID 与 AUTH_TEST_USER_EMAIL 必须同时配置",
    )
  }
  if (isProduction && (testUserId || testUserEmail)) {
    throw new AuthConfigurationError("生产环境禁止配置 AUTH_TEST_*")
  }
  if (testUserId) {
    assertUuid(testUserId, "AUTH_TEST_USER_ID")
  }
  const previewValues = [
    previewUserId,
    previewUserEmail,
    previewResumeId,
    previewSessionSecret,
  ]
  const hasAnyPreviewValue = previewValues.some(Boolean)
  const hasCompletePreviewConfig = previewValues.every(Boolean)
  if (hasAnyPreviewValue && !hasCompletePreviewConfig) {
    throw new AuthConfigurationError("PREVIEW_* 配置必须同时提供")
  }
  if (previewUserId) {
    assertUuid(previewUserId, "PREVIEW_USER_ID")
  }
  if (previewResumeId) {
    assertUuid(previewResumeId, "PREVIEW_RESUME_ID")
  }
  if (previewSessionSecret && previewSessionSecret.length < 32) {
    throw new AuthConfigurationError("PREVIEW_SESSION_SECRET 至少需要 32 个字符")
  }

  return {
    adminUserId,
    testUser:
      testUserId && testUserEmail
        ? {
            userId: testUserId,
            email: testUserEmail,
          }
        : null,
    preview:
      previewUserId && previewUserEmail && previewResumeId && previewSessionSecret
        ? {
            userId: previewUserId,
            email: previewUserEmail,
            resumeId: previewResumeId,
            sessionSecret: previewSessionSecret,
          }
        : null,
  }
}
