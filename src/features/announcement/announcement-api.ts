import type {
  Announcement,
  AnnouncementInput,
} from "../../shared/announcement/announcement-schema"

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

export class AnnouncementApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "AnnouncementApiError"
  }
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
    throw new AnnouncementApiError(
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? "请求失败，请稍后重试",
      payload?.error?.details,
    )
  }
  if (!payload) {
    throw new AnnouncementApiError("INVALID_RESPONSE", "服务返回格式不符合预期")
  }
  return payload.data
}

async function requestApi<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  return readApiResponse<T>(await fetch(input, init))
}

export async function createAnnouncement(
  input: AnnouncementInput,
): Promise<Announcement> {
  const result = await requestApi<{ announcement: Announcement }>(
    "/api/announcements",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  )
  return result.announcement
}

export async function updateAnnouncement(
  announcementId: string,
  input: AnnouncementInput,
): Promise<Announcement> {
  const result = await requestApi<{ announcement: Announcement }>(
    `/api/announcements/${announcementId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  )
  return result.announcement
}

export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const response = await fetch(`/api/announcements/${announcementId}`, {
    method: "DELETE",
  })
  if (!response.ok) {
    await readApiResponse<never>(response)
  }
}
