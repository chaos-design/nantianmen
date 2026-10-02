import { NextResponse } from "next/server"
import { readAuthConfig } from "../../../../server/auth/auth-config"
import {
  createPreviewSessionCookieValue,
  getPreviewSessionMaxAgeSeconds,
} from "../../../../server/auth/preview-session"
import { previewSessionCookieName } from "../../../../server/auth/preview-session-cookie"
import { DomainError } from "../../../../server/domain/resume-service"
import {
  apiError,
  apiSuccess,
  getRequestId,
} from "../../../../server/http/api-response"
import { assertSameOrigin } from "../../../../server/http/request-origin"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const config = readAuthConfig()
    if (!config.preview) {
      throw new DomainError("PREVIEW_CONFIG_INVALID", "Preview 模式未配置", 500)
    }

    const response = apiSuccess(
      {
        resumeId: config.preview.resumeId,
        workspaceUrl: "/workspace",
        a4PreviewUrl: `/editor/${config.preview.resumeId}/preview`,
        webPreviewUrl: `/editor/${config.preview.resumeId}/web`,
      },
      requestId,
    )
    response.cookies.set(
      previewSessionCookieName,
      createPreviewSessionCookieValue(config.preview),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: getPreviewSessionMaxAgeSeconds(),
      },
    )
    return response
  } catch (error) {
    return apiError(error, requestId)
  }
}

export async function DELETE(request: Request) {
  const requestId = getRequestId(request)
  try {
    assertSameOrigin(request)
    const response = new NextResponse(null, {
      status: 204,
      headers: { "x-request-id": requestId },
    })
    response.cookies.set(previewSessionCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    })
    return response
  } catch (error) {
    return apiError(error, requestId)
  }
}
