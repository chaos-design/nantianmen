import { requireAuthContext } from "../../../../server/auth/auth-context"
import { readDefaultAiProviderConfig } from "../../../../server/config/ai-provider-config"
import { assertWritableActor } from "../../../../server/domain/resume-service"
import {
  apiError,
  apiSuccess,
  getRequestId,
} from "../../../../server/http/api-response"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const requestId = getRequestId(request)
  try {
    const actor = await requireAuthContext()
    assertWritableActor(actor)
    const response = apiSuccess(
      {
        providerConfig: readDefaultAiProviderConfig(),
      },
      requestId,
    )
    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("Pragma", "no-cache")
    return response
  } catch (error) {
    const response = apiError(error, requestId)
    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("Pragma", "no-cache")
    return response
  }
}
