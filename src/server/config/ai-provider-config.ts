import {
  type AiProviderConfig,
  aiProviderConfigSchema,
} from "../../shared/resume-ai/resume-ai-contract"

type Environment = Readonly<Record<string, string | undefined>>

export class AiProviderConfigurationError extends Error {
  readonly code = "AI_DEFAULT_CONFIG_INVALID"
  readonly status = 500

  constructor() {
    super("全局模型配置不可用")
    this.name = "AiProviderConfigurationError"
  }
}

export function readDefaultAiProviderConfig(
  environment: Environment = process.env,
): AiProviderConfig | null {
  const modelName = environment.AI_MODEL_NAME?.trim()
  const baseUrl = environment.AI_BASE_URL?.trim()
  const apiKey = environment.AI_API_KEY?.trim()

  if (!modelName || !baseUrl || !apiKey) {
    return null
  }

  const result = aiProviderConfigSchema.safeParse({
    modelName,
    baseUrl,
    apiKey,
  })
  if (!result.success) {
    throw new AiProviderConfigurationError()
  }

  return {
    ...result.data,
    baseUrl: result.data.baseUrl.replace(/\/+$/, ""),
  }
}
