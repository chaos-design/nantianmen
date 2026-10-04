import { requireAuthContext } from "../../../../server/auth/auth-context"
import { AnnouncementService } from "../../../../server/domain/announcement-service"
import {
  apiError,
  apiSuccess,
  getRequestId,
} from "../../../../server/http/api-response"
import { assertSameOrigin } from "../../../../server/http/request-origin"
import { getAnnouncementRepository } from "../../../../server/repositories/announcement-repository-factory"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ "announcement-id": string }>
}

// 这里只承载单条公告的更新和删除。
// 管理员的全量列表由工作台服务端组件直接下发，不开放读取端点：
// 列表内容全部来自服务端渲染的 props，权限判断落在页面边界，
// 也避免出现「按单条 ID 命名的路径却返回整个列表」这种语义错位。

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    const params = await context.params
    const body = (await request.json().catch(() => null)) as unknown
    const service = new AnnouncementService(getAnnouncementRepository())
    const announcement = await service.updateAnnouncement(
      actor,
      params["announcement-id"],
      body,
    )
    return apiSuccess({ announcement }, requestId)
  } catch (error) {
    return apiError(error, requestId)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    const params = await context.params
    const service = new AnnouncementService(getAnnouncementRepository())
    await service.deleteAnnouncement(actor, params["announcement-id"])
    return new Response(null, {
      status: 204,
      headers: { "x-request-id": requestId },
    })
  } catch (error) {
    return apiError(error, requestId)
  }
}
