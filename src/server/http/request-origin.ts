export class RequestOriginError extends Error {
  readonly code = "REQUEST_ORIGIN_INVALID"
  readonly status = 403

  constructor() {
    super("请求来源无效")
    this.name = "RequestOriginError"
  }
}

function getRequestOrigin(request: Request): string {
  const requestUrl = new URL(request.url)
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    requestUrl.protocol.replace(":", "")

  return host ? new URL(`${protocol}://${host}`).origin : requestUrl.origin
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin")
  if (!origin) {
    throw new RequestOriginError()
  }

  try {
    if (new URL(origin).origin !== getRequestOrigin(request)) {
      throw new RequestOriginError()
    }
  } catch (error) {
    if (error instanceof RequestOriginError) {
      throw error
    }
    throw new RequestOriginError()
  }
}
