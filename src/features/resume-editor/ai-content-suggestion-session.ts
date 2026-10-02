"use client"

import { z } from "zod"
import {
  type AiOutput,
  aiOutputSchema,
} from "../../shared/resume-ai/resume-ai-contract"

export type AiContentImprovementOutput = Extract<AiOutput, { type: "improve-content" }>

export interface AiContentSuggestionSession {
  output: AiContentImprovementOutput
  provider: string
  appliedTargetKeys: string[]
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const storedSessionSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.string().min(1).max(200),
    resumeId: z.string().min(1).max(200),
    output: aiOutputSchema,
    provider: z.string().trim().min(1).max(160),
    appliedTargetKeys: z.array(z.string().min(1).max(500)).max(20),
  })
  .strict()

export function getAiContentSuggestionSessionStorageKey(
  ownerId: string,
  resumeId: string,
): string {
  return `resume-ai:content-suggestions:v1:${ownerId}:${resumeId}`
}

function getSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function readAiContentSuggestionSession(
  ownerId: string,
  resumeId: string,
  storage: StorageLike | null = getSessionStorage(),
): AiContentSuggestionSession | null {
  if (!storage) {
    return null
  }
  try {
    const rawSession = storage.getItem(
      getAiContentSuggestionSessionStorageKey(ownerId, resumeId),
    )
    if (!rawSession) {
      return null
    }
    const result = storedSessionSchema.safeParse(JSON.parse(rawSession))
    if (
      !result.success ||
      result.data.ownerId !== ownerId ||
      result.data.resumeId !== resumeId ||
      result.data.output.type !== "improve-content"
    ) {
      return null
    }
    return {
      output: result.data.output,
      provider: result.data.provider,
      appliedTargetKeys: [...new Set(result.data.appliedTargetKeys)],
    }
  } catch {
    return null
  }
}

export function saveAiContentSuggestionSession(
  ownerId: string,
  resumeId: string,
  session: AiContentSuggestionSession,
  storage: StorageLike | null = getSessionStorage(),
): void {
  if (!storage) {
    return
  }
  try {
    const storedSession = storedSessionSchema.parse({
      version: 1,
      ownerId,
      resumeId,
      output: session.output,
      provider: session.provider,
      appliedTargetKeys: [...new Set(session.appliedTargetKeys)],
    })
    if (storedSession.output.type !== "improve-content") {
      return
    }
    storage.setItem(
      getAiContentSuggestionSessionStorageKey(ownerId, resumeId),
      JSON.stringify(storedSession),
    )
  } catch {
    // Session storage is optional; in-memory state remains authoritative.
  }
}
