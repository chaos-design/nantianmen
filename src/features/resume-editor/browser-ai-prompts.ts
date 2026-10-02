"use client"

import { z } from "zod"
import { type AiTask, aiTasks } from "../../shared/resume-ai/resume-ai-contract"
import {
  aiPromptGuidanceSchema,
  defaultAiSystemPrompt,
} from "../../shared/resume-ai/resume-ai-prompt-text"

/**
 * 指令以「一整块完整 prompt」保存，界面与模型看到的内容完全一致。
 *
 * 早期版本把 prompt 拆成「锁定契约 + 可编辑导引」，用户只改后半段。
 * 实际使用中这层区分毫无价值：模型看到的是拼起来的全文，
 * 用户在编辑器里看到的却是两段割裂的内容，无法判断最终发出的到底是什么。
 * 现在用户保存什么，模型就收到什么。
 */
export interface BrowserAiPrompts {
  improveContent: string
  interviewQuestions: string
}

export const emptyBrowserAiPrompts: BrowserAiPrompts = {
  improveContent: "",
  interviewQuestions: "",
}

const storedPromptsSchema = z
  .object({
    version: z.literal(3),
    improveContent: aiPromptGuidanceSchema,
    interviewQuestions: aiPromptGuidanceSchema,
  })
  .strict()

export function getBrowserAiPromptsStorageKey(ownerId: string): string {
  return `resume-ai:prompts:v3:${ownerId}`
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function getLocalStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage
}

function fieldFor(task: AiTask): keyof BrowserAiPrompts {
  return task === "improve-content" ? "improveContent" : "interviewQuestions"
}

/** 编辑器展示的内容：优先用户保存的版本，否则展示内置默认 prompt。 */
export function readPromptText(prompts: BrowserAiPrompts, task: AiTask): string {
  return prompts[fieldFor(task)] || defaultAiSystemPrompt[task]
}

/** 用户是否真的改过内容。未改过时不应产生任何本地存储。 */
export function hasCustomPrompt(prompts: BrowserAiPrompts, task: AiTask): boolean {
  const value = prompts[fieldFor(task)].trim()
  return value.length > 0 && value !== defaultAiSystemPrompt[task].trim()
}

/**
 * 发给服务端的完整 system prompt。
 * 返回 undefined 表示「完全使用内置默认值」，让服务端用同一份默认文案兜底。
 */
export function readPromptGuidance(
  prompts: BrowserAiPrompts,
  task: AiTask,
): string | undefined {
  if (!hasCustomPrompt(prompts, task)) {
    return undefined
  }
  return prompts[fieldFor(task)].trim()
}

export function updatePromptText(
  prompts: BrowserAiPrompts,
  task: AiTask,
  value: string,
): BrowserAiPrompts {
  return { ...prompts, [fieldFor(task)]: value }
}

export function readBrowserAiPrompts(
  ownerId: string,
  storage: StorageLike | null = getLocalStorage(),
): BrowserAiPrompts {
  if (!storage) {
    return { ...emptyBrowserAiPrompts }
  }
  try {
    const raw = storage.getItem(getBrowserAiPromptsStorageKey(ownerId))
    if (!raw) {
      return { ...emptyBrowserAiPrompts }
    }
    const result = storedPromptsSchema.safeParse(JSON.parse(raw))
    if (!result.success) {
      return { ...emptyBrowserAiPrompts }
    }
    return {
      improveContent: result.data.improveContent,
      interviewQuestions: result.data.interviewQuestions,
    }
  } catch {
    return { ...emptyBrowserAiPrompts }
  }
}

/**
 * 只持久化真正偏离默认值的项。
 * 两项都回到默认时直接删除整个键，清除站点数据后必然退回内置 prompt。
 */
export function saveBrowserAiPrompts(
  ownerId: string,
  prompts: BrowserAiPrompts,
  storage: StorageLike | null = getLocalStorage(),
): BrowserAiPrompts {
  const key = getBrowserAiPromptsStorageKey(ownerId)
  const normalized: BrowserAiPrompts = {
    improveContent: aiPromptGuidanceSchema.parse(prompts.improveContent).trim(),
    interviewQuestions: aiPromptGuidanceSchema.parse(prompts.interviewQuestions).trim(),
  }

  if (aiTasks.every((task) => !hasCustomPrompt(normalized, task))) {
    storage?.removeItem(key)
    return { ...emptyBrowserAiPrompts }
  }

  storage?.setItem(key, JSON.stringify({ version: 3, ...normalized }))
  return normalized
}

export function clearBrowserAiPrompts(
  ownerId: string,
  storage: StorageLike | null = getLocalStorage(),
): void {
  storage?.removeItem(getBrowserAiPromptsStorageKey(ownerId))
}

export const aiTaskLabels: Record<AiTask, string> = {
  "improve-content": "内容优化",
  "interview-questions": "面试问题",
}

export const supportedAiTasks = aiTasks
