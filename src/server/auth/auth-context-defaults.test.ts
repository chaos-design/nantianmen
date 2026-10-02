import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * 覆盖 `readSupabaseClaims` 与 `readRequestPreviewCookie` 这两个默认读取器。
 * 它们只在调用方不注入替身时执行，必须替换模块依赖才能进入。
 * 配置缺失要原样抛出（属于部署问题），其余异常统一收敛成 503。
 */
const getClaims = vi.fn()
const createClient = vi.fn(async () => ({
  auth: {
    getClaims,
  },
}))
const cookieStore = { get: vi.fn() }

vi.mock("../../lib/supabase/server", () => ({
  createClient: () => createClient(),
}))

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}))

const { getOptionalAuthContext } = await import("./auth-context")

const memberId = "00000000-0000-4000-8000-000000000001"

beforeEach(() => {
  getClaims.mockReset()
  createClient.mockClear()
  cookieStore.get.mockReset()
})

describe("default Supabase claims reader", () => {
  it("returns the verified claims when the session is valid", async () => {
    getClaims.mockResolvedValue({
      error: null,
      data: { claims: { sub: memberId, email: "member@example.com" } },
    })

    await expect(
      getOptionalAuthContext({ environment: { NODE_ENV: "test" } }),
    ).resolves.toEqual({
      userId: memberId,
      email: "member@example.com",
      isAdmin: false,
      mode: "user",
    })
  })

  it("returns null when Supabase reports an error", async () => {
    getClaims.mockResolvedValue({ error: { message: "invalid" }, data: null })

    await expect(
      getOptionalAuthContext({ environment: { NODE_ENV: "test" } }),
    ).resolves.toBeNull()
  })

  it("returns null when no claims are attached to the session", async () => {
    getClaims.mockResolvedValue({ error: null, data: { claims: null } })

    await expect(
      getOptionalAuthContext({ environment: { NODE_ENV: "test" } }),
    ).resolves.toBeNull()
  })

  it("rethrows missing public configuration so misdeployment stays visible", async () => {
    createClient.mockRejectedValueOnce(
      new Error("缺少公共 Supabase 配置：NEXT_PUBLIC_SUPABASE_URL"),
    )

    await expect(
      getOptionalAuthContext({ environment: { NODE_ENV: "test" } }),
    ).rejects.toThrow("缺少公共 Supabase 配置")
  })

  it("collapses any other client failure into a 503", async () => {
    createClient.mockRejectedValueOnce(new Error("network down"))

    await expect(
      getOptionalAuthContext({ environment: { NODE_ENV: "test" } }),
    ).rejects.toMatchObject({
      code: "AUTH_PROVIDER_UNAVAILABLE",
      status: 503,
    })
  })
})

describe("default preview cookie reader", () => {
  // 只有配置了 PREVIEW_* 时才会去读 cookie，这里必须完整配置四项。
  const previewEnvironment = {
    NODE_ENV: "test",
    PREVIEW_USER_ID: memberId,
    PREVIEW_USER_EMAIL: "preview@example.com",
    PREVIEW_RESUME_ID: "00000000-0000-4000-8000-000000000010",
    PREVIEW_SESSION_SECRET: "preview-session-secret-with-enough-length",
  }

  it("reads the preview cookie from the request cookie store", async () => {
    cookieStore.get.mockReturnValue({ value: "not-a-valid-signature" })
    getClaims.mockResolvedValue({
      error: null,
      data: { claims: { sub: memberId, email: "member@example.com" } },
    })

    // 伪造签名无法通过校验，最终回落到普通用户身份，而不是建立 Preview 会话。
    await expect(
      getOptionalAuthContext({ environment: previewEnvironment }),
    ).resolves.toMatchObject({ mode: "user" })
    expect(cookieStore.get).toHaveBeenCalledWith("resume-preview-session")
  })

  it("falls back to an absent cookie without throwing", async () => {
    cookieStore.get.mockReturnValue(undefined)
    getClaims.mockResolvedValue({
      error: null,
      data: { claims: { sub: memberId, email: "member@example.com" } },
    })

    await expect(
      getOptionalAuthContext({ environment: previewEnvironment }),
    ).resolves.toMatchObject({ mode: "user" })
  })
})
