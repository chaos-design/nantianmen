import type { EditableResume, ResumeListItem } from "../../server/domain/resume-service"
import type {
  AiOutput,
  AiProviderConfig,
  AiTask,
} from "../../shared/resume-ai/resume-ai-contract"
import type {
  ResumeDocument,
  ResumeImageAsset,
  ResumeTemplateId,
} from "../../shared/resume-schema/resume-schema"

interface ApiEnvelope<T> {
  data: T
  requestId: string
}

interface ApiErrorEnvelope {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
  requestId?: string
}

export class EditorApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "EditorApiError"
  }
}

function redirectToLogin(): void {
  if (typeof window === "undefined") {
    return
  }
  const next = `${window.location.pathname}${window.location.search}`
  window.location.assign(`/login?next=${encodeURIComponent(next)}`)
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const rawPayload = await response.text()
  let payload: (ApiEnvelope<T> & ApiErrorEnvelope) | null = null
  try {
    payload = rawPayload
      ? ((JSON.parse(rawPayload) as ApiEnvelope<T> & ApiErrorEnvelope) ?? null)
      : null
  } catch {
    payload = null
  }
  if (!response.ok) {
    const error = new EditorApiError(
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ??
        (response.status >= 500 ? "服务暂时不可用，请稍后重试" : "请求失败"),
      payload?.error?.details,
    )
    if (error.code === "AUTH_REQUIRED") {
      redirectToLogin()
    }
    throw error
  }
  if (!payload) {
    throw new EditorApiError("INVALID_RESPONSE", "服务返回格式不符合预期，请稍后重试")
  }
  return payload.data
}

async function requestApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return readApiResponse<T>(await fetch(input, init))
}

export async function listResumes(): Promise<ResumeListItem[]> {
  return requestApi("/api/resumes", { cache: "no-store" })
}

export async function createResume(
  templateId?: ResumeTemplateId,
): Promise<{ resume: EditableResume }> {
  return requestApi("/api/resumes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId }),
  })
}

export async function loadResume(resumeId: string): Promise<EditableResume> {
  return requestApi(`/api/resumes/${resumeId}`, {
    cache: "no-store",
  })
}

export async function saveResume(input: {
  resumeId: string
  version: number
  document: ResumeDocument
}): Promise<EditableResume> {
  return requestApi(`/api/resumes/${input.resumeId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expectedVersion: input.version,
      document: input.document,
    }),
  })
}

export async function deleteResume(resumeId: string): Promise<void> {
  const response = await fetch(`/api/resumes/${resumeId}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    await readApiResponse<never>(response)
  }
}

export async function deleteResumes(resumeIds: string[]): Promise<number> {
  const result = await requestApi<{ deletedCount: number }>("/api/resumes/batch", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeIds }),
  })
  return result.deletedCount
}

export async function publishResume(resumeId: string): Promise<{
  publicationId: string
  publicationVersion: number
  publicSlug: string
  shareUrl: string
}> {
  return requestApi(`/api/resumes/${resumeId}/publish`, {
    method: "POST",
  })
}

export async function listResumeAssets(resumeId: string): Promise<ResumeImageAsset[]> {
  return requestApi(`/api/resumes/${resumeId}/assets`, {
    cache: "no-store",
  })
}

export async function uploadResumeAsset(input: {
  resumeId: string
  file: File
  alt?: string
}): Promise<ResumeImageAsset> {
  const formData = new FormData()
  formData.set("file", input.file)
  if (input.alt) {
    formData.set("alt", input.alt)
  }
  return requestApi(`/api/resumes/${input.resumeId}/assets`, {
    method: "POST",
    body: formData,
  })
}

export async function deleteResumeAsset(
  resumeId: string,
  assetId: string,
): Promise<void> {
  const response = await fetch(`/api/resumes/${resumeId}/assets/${assetId}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    await readApiResponse<never>(response)
  }
}

export async function loadPrivateAssetBlob(
  resumeId: string,
  assetId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`/api/resumes/${resumeId}/assets/${assetId}`, {
    cache: "no-store",
    signal,
  })
  if (!response.ok) {
    await readApiResponse<never>(response)
  }
  return response.blob()
}

export async function generateAiContent(input: {
  resumeId: string
  task: AiTask
  document: ResumeDocument
  targetSectionId?: string | null
  providerConfig: AiProviderConfig
  promptGuidance?: string
}): Promise<{ output: AiOutput; provider: string }> {
  return requestApi(`/api/resumes/${input.resumeId}/ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task: input.task,
      document: input.document,
      targetSectionId: input.targetSectionId,
      providerConfig: input.providerConfig,
      // 未自定义导引时不传该字段，服务端回落到内置导引。
      ...(input.promptGuidance ? { promptGuidance: input.promptGuidance } : {}),
    }),
  })
}

export async function testAiProvider(
  providerConfig: AiProviderConfig,
): Promise<{ ok: true; provider: string }> {
  return requestApi("/api/ai/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ providerConfig }),
  })
}

let defaultAiProviderConfigRequest: Promise<AiProviderConfig | null> | null = null

export function loadDefaultAiProviderConfig(): Promise<AiProviderConfig | null> {
  if (!defaultAiProviderConfigRequest) {
    defaultAiProviderConfigRequest = requestApi<{
      providerConfig: AiProviderConfig | null
    }>("/api/ai/default-config", {
      cache: "no-store",
    })
      .then((result) => result.providerConfig)
      .catch((error) => {
        defaultAiProviderConfigRequest = null
        throw error
      })
  }
  return defaultAiProviderConfigRequest
}
