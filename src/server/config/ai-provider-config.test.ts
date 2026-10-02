import { describe, expect, it } from "vitest"
import {
  AiProviderConfigurationError,
  readDefaultAiProviderConfig,
} from "./ai-provider-config"

describe("default AI provider config", () => {
  it("parses and normalizes a complete provider config", () => {
    expect(
      readDefaultAiProviderConfig({
        AI_MODEL_NAME: " global-model ",
        AI_BASE_URL: " https://provider.example.com/v1/// ",
        AI_API_KEY: " global-key ",
      }),
    ).toEqual({
      modelName: "global-model",
      baseUrl: "https://provider.example.com/v1",
      apiKey: "global-key",
    })
  })

  it.each([
    {},
    { AI_MODEL_NAME: "global-model" },
    {
      AI_MODEL_NAME: "global-model",
      AI_BASE_URL: "https://provider.example.com/v1",
    },
    {
      AI_MODEL_NAME: "global-model",
      AI_BASE_URL: "https://provider.example.com/v1",
      AI_API_KEY: " ",
    },
  ])("treats incomplete config as unavailable", (environment) => {
    expect(readDefaultAiProviderConfig(environment)).toBeNull()
  })

  it("rejects invalid complete config without exposing its values", () => {
    const secret = "never-print-this-provider-key"
    let thrown: unknown
    try {
      readDefaultAiProviderConfig({
        AI_MODEL_NAME: "global-model",
        AI_BASE_URL: "file:///private/provider",
        AI_API_KEY: secret,
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(AiProviderConfigurationError)
    expect(String(thrown)).not.toContain(secret)
    expect(String(thrown)).not.toContain("file:///private/provider")
  })
})
