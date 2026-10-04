import { requireAuthContext } from "../../../server/auth/auth-context"
import { AnnouncementService } from "../../../server/domain/announcement-service"
import { apiError, apiSuccess, getRequestId } from "../../../server/http/api-response"
import { assertSameOrigin } from "../../../server/http/request-origin"
import { getAnnouncementRepository } from "../../../server/repositories/announcement-repository-factory"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    await requireAuthContext()
    const service = new AnnouncementService(getAnnouncementRepository())
    const announcements = await service.listVisibleAnnouncements()
    const response = apiSuccess({ announcements }, requestId)
    response.headers.set("Cache-Control", "private, no-store")
    return response
  } catch (error) {
    const response = apiError(error, requestId)
    response.headers.set("Cache-Control", "private, no-store")
    return response
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    const body = (await request.json().catch(() => null)) as unknown
    const service = new AnnouncementService(getAnnouncementRepository())
    const announcement = await service.createAnnouncement(actor, body)
    return apiSuccess({ announcement }, requestId, 201)
  } catch (error) {
    return apiError(error, requestId)
  }
}
