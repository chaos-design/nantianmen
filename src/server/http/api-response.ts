import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { AuthConfigurationError } from "../auth/auth-config"
import { AuthenticationError } from "../auth/auth-context"
import { AiProviderConfigurationError } from "../config/ai-provider-config"
import { DomainError } from "../domain/resume-service"
import { VersionConflictError } from "../repositories/resume-repository"
import { RequestOriginError } from "./request-origin"

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? randomUUID()
}

export function apiSuccess(
  data: unknown,
  requestId: string,
  status = 200,
): NextResponse {
  return NextResponse.json(
    { data, requestId },
    {
      status,
      headers: { "x-request-id": requestId },
    },
  )
}

export function apiError(error: unknown, requestId: string): NextResponse {
  if (
    error instanceof AuthenticationError ||
    error instanceof AuthConfigurationError ||
    error instanceof AiProviderConfigurationError ||
    error instanceof RequestOriginError
  ) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
        requestId,
      },
      {
        status: error.status,
        headers: { "x-request-id": requestId },
      },
    )
  }

  if (error instanceof DomainError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        requestId,
      },
      {
        status: error.status,
        headers: { "x-request-id": requestId },
      },
    )
  }

  if (error instanceof VersionConflictError) {
    return NextResponse.json(
      {
        error: {
          code: "VERSION_CONFLICT",
          message: error.message,
          details: { currentVersion: error.currentVersion },
        },
        requestId,
      },
      {
        status: 409,
        headers: { "x-request-id": requestId },
      },
    )
  }

  console.error(`[${requestId}] Unhandled API error`, error)
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "服务暂时不可用，请稍后重试",
      },
      requestId,
    },
    {
      status: 500,
      headers: { "x-request-id": requestId },
    },
  )
}
