import { getResumeAssetStorage } from "../../../../../server/assets/resume-asset-storage-factory"
import { requireAuthContext } from "../../../../../server/auth/auth-context"
import {
  MAX_UPLOAD_REQUEST_BYTES,
  ResumeAssetService,
} from "../../../../../server/domain/resume-asset-service"
import { DomainError } from "../../../../../server/domain/resume-service"
import {
  apiError,
  apiSuccess,
  getRequestId,
} from "../../../../../server/http/api-response"
import { assertSameOrigin } from "../../../../../server/http/request-origin"
import { getResumeRepository } from "../../../../../server/repositories/repository-factory"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ "resume-id": string }>
}

function createService(): ResumeAssetService {
  return new ResumeAssetService(getResumeRepository(), getResumeAssetStorage())
}

export async function GET(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    const actor = await requireAuthContext()
    const params = await context.params
    const assets = await createService().listAssets(params["resume-id"], actor)
    return apiSuccess(assets, requestId)
  } catch (error) {
    return apiError(error, requestId)
  }
}

export async function POST(request: Request, context: RouteContext) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const actor = await requireAuthContext()
    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_REQUEST_BYTES) {
      throw new DomainError("ASSET_TOO_LARGE", "上传请求不能超过 5 MB", 413)
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      throw new DomainError("ASSET_FORM_INVALID", "上传表单无法解析", 422)
    }
    const file = formData.get("file")
    if (!file || typeof file === "string") {
      throw new DomainError("ASSET_FILE_MISSING", "请选择要上传的图片", 422)
    }
    const altValue = formData.get("alt")
    const alt = typeof altValue === "string" ? altValue : ""
    const params = await context.params
    const asset = await createService().uploadAsset({
      resumeId: params["resume-id"],
      actor,
      originalName: file.name,
      providedMimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
      alt,
    })
    return apiSuccess(asset, requestId, 201)
  } catch (error) {
    return apiError(error, requestId)
  }
}
