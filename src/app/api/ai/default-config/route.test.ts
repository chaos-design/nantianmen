import { afterEach, describe, expect, it, vi } from "vitest"
import { GET } from "./route"

const authState = vi.hoisted(() => ({
  authenticated: true,
  mode: "user" as "preview" | "user",
}))

vi.mock("../../../../server/auth/auth-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../server/auth/auth-context")>()
  return {
    ...actual,
    requireAuthContext: async () => {
      if (!authState.authenticated) {
        throw new actual.AuthenticationError("AUTH_REQUIRED", "请先登录后再继续", 401)
      }
      return {
        userId: "11111111-1111-4111-8111-111111111111",
        email: "member@example.com",
        isAdmin: false,
        mode: authState.mode,
        ...(authState.mode === "preview"
          ? { previewResumeId: "22222222-2222-4222-8222-222222222222" }
          : {}),
      }
    },
  }
})

afterEach(() => {
  authState.authenticated = true
  authState.mode = "user"
  vi.unstubAllEnvs()
})

function requestDefaultConfig() {
  return GET(new Request("http://localhost/api/ai/default-config"))
}

describe("default AI provider config route", () => {
  it("returns a complete configured provider without allowing caching", async () => {
    vi.stubEnv("AI_MODEL_NAME", "global-model")
    vi.stubEnv("AI_BASE_URL", "https://provider.example.com/v1/")
    vi.stubEnv("AI_API_KEY", "global-key")

    const response = await requestDefaultConfig()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    await expect(response.json()).resolves.toMatchObject({
      data: {
        providerConfig: {
          modelName: "global-model",
          baseUrl: "https://provider.example.com/v1",
          apiKey: "global-key",
        },
      },
    })
  })

  it("returns null when the global provider is incomplete", async () => {
    vi.stubEnv("AI_MODEL_NAME", "global-model")
    vi.stubEnv("AI_BASE_URL", "")
    vi.stubEnv("AI_API_KEY", "")

    const response = await requestDefaultConfig()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: { providerConfig: null },
    })
  })

  it("returns a stable error without exposing invalid configuration", async () => {
    const secret = "never-print-this-provider-key"
    vi.stubEnv("AI_MODEL_NAME", "global-model")
    vi.stubEnv("AI_BASE_URL", "file:///private/provider")
    vi.stubEnv("AI_API_KEY", secret)

    const response = await requestDefaultConfig()
    const body = JSON.stringify(await response.json())

    expect(response.status).toBe(500)
    expect(body).toContain("AI_DEFAULT_CONFIG_INVALID")
    expect(body).not.toContain(secret)
    expect(body).not.toContain("file:///private/provider")
  })

  it.each([
    { authenticated: false, mode: "user" as const, status: 401 },
    { authenticated: true, mode: "preview" as const, status: 403 },
  ])(
    "rejects anonymous and Preview access",
    async ({ authenticated, mode, status }) => {
      authState.authenticated = authenticated
      authState.mode = mode
      vi.stubEnv("AI_MODEL_NAME", "global-model")
      vi.stubEnv("AI_BASE_URL", "https://provider.example.com/v1")
      vi.stubEnv("AI_API_KEY", "global-key")

      const response = await requestDefaultConfig()
      const body = JSON.stringify(await response.json())

      expect(response.status).toBe(status)
      expect(body).not.toContain("global-key")
    },
  )
})
