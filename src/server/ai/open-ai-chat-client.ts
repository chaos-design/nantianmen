import type { AiProviderConfig } from "../../shared/resume-ai/resume-ai-contract"
import { DomainError } from "../domain/resume-service"
import type { AiChatMessage } from "./prompts/resume-ai-prompts"

type Fetcher = typeof fetch

export interface AiChatClient {
  readonly modelName: string
  complete(messages: AiChatMessage[]): Promise<string>
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)
}

export class OpenAiChatCompletionsClient implements AiChatClient {
  readonly modelName: string

  constructor(
    private readonly config: AiProviderConfig,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 25_000,
  ) {
    this.modelName = config.modelName
  }

  async complete(messages: AiChatMessage[]): Promise<string> {
    let response: Response
    try {
      response = await this.fetcher(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.modelName,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new DomainError("AI_PROVIDER_TIMEOUT", "AI 响应超时，请重试", 504)
      }
      throw new DomainError("AI_PROVIDER_FAILED", "AI 服务暂时不可用，请稍后重试", 502)
    }

    if (!response.ok) {
      throw new DomainError("AI_PROVIDER_FAILED", "AI 服务暂时不可用，请稍后重试", 502)
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new DomainError("AI_PROVIDER_FAILED", "AI 服务暂时不可用，请稍后重试", 502)
    }
    const content =
      typeof payload === "object" &&
      payload !== null &&
      "choices" in payload &&
      Array.isArray(payload.choices) &&
      typeof payload.choices[0]?.message?.content === "string"
        ? payload.choices[0].message.content.trim()
        : ""
    if (!content) {
      throw new DomainError("AI_OUTPUT_EMPTY", "AI 未返回有效内容", 502)
    }
    return content
  }
}
