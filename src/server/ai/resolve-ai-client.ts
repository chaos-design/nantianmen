import {
  type AiProviderConfig,
  aiProviderConfigSchema,
} from "../../shared/resume-ai/resume-ai-contract"
import type { AuthContext } from "../auth/auth-context"
import { assertWritableActor, DomainError } from "../domain/resume-service"
import { type AiChatClient, OpenAiChatCompletionsClient } from "./open-ai-chat-client"

function normalizeProviderConfig(config: AiProviderConfig): AiProviderConfig {
  return {
    ...config,
    baseUrl: config.baseUrl.replace(/\/+$/, ""),
  }
}

export function resolveAiClient(
  actor: AuthContext,
  providerConfig?: AiProviderConfig,
): AiChatClient {
  assertWritableActor(actor)
  if (!providerConfig) {
    throw new DomainError("AI_PROVIDER_CONFIG_REQUIRED", "请先配置自己的大模型", 422)
  }
  const result = aiProviderConfigSchema.safeParse(providerConfig)
  if (!result.success) {
    throw new DomainError(
      "AI_PROVIDER_CONFIG_INVALID",
      "大模型配置不合法，请检查后重试",
      422,
    )
  }
  return new OpenAiChatCompletionsClient(normalizeProviderConfig(result.data))
}
