import { afterEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
})

describe("AI connection test route", () => {
  it("tests a user's browser provider without persisting it", async () => {
    vi.stubEnv("AUTH_TEST_USER_ID", "11111111-1111-4111-8111-111111111111")
    vi.stubEnv("AUTH_TEST_USER_EMAIL", "member@example.com")
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    )

    const response = await POST(
      new Request("http://localhost/api/ai/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
        },
        body: JSON.stringify({
          providerConfig: {
            modelName: "browser-model",
            baseUrl: "https://provider.example.com/v1",
            apiKey: "browser-key",
          },
        }),
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      data: {
        ok: true,
        provider: "browser-model",
      },
    })
  })
})
