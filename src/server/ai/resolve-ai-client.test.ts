import { describe, expect, it } from "vitest"
import type { AuthContext } from "../auth/auth-context"
import { resolveAiClient } from "./resolve-ai-client"

const member: AuthContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "member@example.com",
  isAdmin: false,
  mode: "user",
}

describe("resolve AI client", () => {
  it("uses the submitted browser provider for administrators and members", () => {
    for (const actor of [member, { ...member, isAdmin: true }]) {
      const client = resolveAiClient(actor, {
        modelName: "browser-model",
        baseUrl: "https://browser.example.com/v1/",
        apiKey: "browser-key",
      })

      expect(client.modelName).toBe("browser-model")
    }
  })

  it("requires a valid browser provider for every writable user", () => {
    for (const actor of [member, { ...member, isAdmin: true }]) {
      expect(() => resolveAiClient(actor)).toThrow(
        expect.objectContaining({ code: "AI_PROVIDER_CONFIG_REQUIRED" }),
      )
      expect(() =>
        resolveAiClient(actor, {
          modelName: "",
          baseUrl: "not-a-url",
          apiKey: "",
        }),
      ).toThrow(expect.objectContaining({ code: "AI_PROVIDER_CONFIG_INVALID" }))
    }
  })

  it("rejects Preview before resolving a provider", () => {
    expect(() =>
      resolveAiClient({
        ...member,
        mode: "preview",
        previewResumeId: "22222222-2222-4222-8222-222222222222",
      }),
    ).toThrow(expect.objectContaining({ code: "PREVIEW_READ_ONLY" }))
  })
})
