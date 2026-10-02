"use client"

import { z } from "zod"
import {
  type AiProviderConfig,
  aiProviderConfigSchema,
} from "../../shared/resume-ai/resume-ai-contract"

export function getBrowserAiConfigStorageKey(ownerId: string): string {
  return `resume-ai:provider:v1:${ownerId}`
}

const browserAiConfigSchema = aiProviderConfigSchema.extend({
  version: z.literal(1),
})

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function getLocalStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage
}

export function readBrowserAiConfig(
  ownerId: string,
  storage: StorageLike | null = getLocalStorage(),
): AiProviderConfig | null {
  if (!storage) {
    return null
  }
  try {
    const value = storage.getItem(getBrowserAiConfigStorageKey(ownerId))
    if (!value) {
      return null
    }
    const result = browserAiConfigSchema.safeParse(JSON.parse(value))
    if (!result.success) {
      return null
    }
    return {
      modelName: result.data.modelName,
      baseUrl: result.data.baseUrl.replace(/\/+$/, ""),
      apiKey: result.data.apiKey,
    }
  } catch {
    return null
  }
}

export function saveBrowserAiConfig(
  ownerId: string,
  config: AiProviderConfig,
  storage: StorageLike | null = getLocalStorage(),
): AiProviderConfig {
  const parsed = aiProviderConfigSchema.parse(config)
  const normalized = {
    ...parsed,
    baseUrl: parsed.baseUrl.replace(/\/+$/, ""),
  }
  storage?.setItem(
    getBrowserAiConfigStorageKey(ownerId),
    JSON.stringify({ version: 1, ...normalized }),
  )
  return normalized
}

export function clearBrowserAiConfig(
  ownerId: string,
  storage: StorageLike | null = getLocalStorage(),
): void {
  storage?.removeItem(getBrowserAiConfigStorageKey(ownerId))
}
