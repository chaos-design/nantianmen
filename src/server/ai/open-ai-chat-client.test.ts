import { describe, expect, it, vi } from "vitest"
import type { AiProviderConfig } from "../../shared/resume-ai/resume-ai-contract"
import { OpenAiChatCompletionsClient } from "./open-ai-chat-client"

const config: AiProviderConfig = {
  modelName: "test-model",
  baseUrl: "https://example.com/v1",
  apiKey: "test-key",
}

const messages = [
  {
    role: "system" as const,
    content: "Return JSON.",
  },
]

describe("OpenAI Chat Completions client", () => {
  it("returns assistant content from a JSON Object request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"type":"ok"}' } }],
      }),
    )
    const client = new OpenAiChatCompletionsClient(config, fetcher)

    await expect(client.complete(messages)).resolves.toBe('{"type":"ok"}')
    expect(fetcher).toHaveBeenCalledOnce()
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe("https://example.com/v1/chat/completions")
    expect(init?.headers).toEqual({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "test-model",
      response_format: { type: "json_object" },
      messages,
    })
  })

  it("maps provider timeouts to a stable domain error", async () => {
    const timeout = new Error("timed out")
    timeout.name = "TimeoutError"
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(timeout)
    const client = new OpenAiChatCompletionsClient(config, fetcher)

    await expect(client.complete(messages)).rejects.toMatchObject({
      code: "AI_PROVIDER_TIMEOUT",
    })
  })

  it("rejects non-success and empty provider responses", async () => {
    const failedClient = new OpenAiChatCompletionsClient(
      config,
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })),
    )
    await expect(failedClient.complete(messages)).rejects.toMatchObject({
      code: "AI_PROVIDER_FAILED",
    })

    const emptyClient = new OpenAiChatCompletionsClient(
      config,
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          choices: [{ message: { content: " " } }],
        }),
      ),
    )
    await expect(emptyClient.complete(messages)).rejects.toMatchObject({
      code: "AI_OUTPUT_EMPTY",
    })
  })
})
