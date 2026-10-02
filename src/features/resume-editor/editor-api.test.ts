import { afterEach, describe, expect, it, vi } from "vitest"
import {
  deleteResume,
  EditorApiError,
  listResumes,
  loadPrivateAssetBlob,
} from "./editor-api"

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("editor API", () => {
  it("unwraps successful JSON responses", async () => {
    const fetchMock = stubFetch(
      Response.json({ data: [], requestId: "request-success" }),
    )

    await expect(listResumes()).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledWith("/api/resumes", {
      cache: "no-store",
    })
  })

  it("preserves structured API errors", async () => {
    stubFetch(
      Response.json(
        {
          error: {
            code: "INVALID_DOCUMENT",
            message: "简历内容无效",
            details: { field: "profile" },
          },
          requestId: "request-error",
        },
        { status: 422 },
      ),
    )

    const error = await listResumes().catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(EditorApiError)
    expect(error).toMatchObject({
      code: "INVALID_DOCUMENT",
      message: "简历内容无效",
      details: { field: "profile" },
    })
  })

  it("maps non-JSON server errors to a stable editor error", async () => {
    stubFetch(
      new Response("Internal Server Error", {
        status: 500,
        headers: { "content-type": "text/plain" },
      }),
    )

    const error = await listResumes().catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(EditorApiError)
    expect(error).toMatchObject({
      code: "REQUEST_FAILED",
      message: "服务暂时不可用，请稍后重试",
    })
  })

  it("rejects successful responses with invalid JSON", async () => {
    stubFetch(
      new Response("Internal Server Error", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    )

    const error = await listResumes().catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(EditorApiError)
    expect(error).toMatchObject({
      code: "INVALID_RESPONSE",
      message: "服务返回格式不符合预期，请稍后重试",
    })
  })

  it("accepts successful no-content delete responses", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))

    await expect(deleteResume("resume-1")).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith("/api/resumes/resume-1", {
      method: "DELETE",
    })
  })

  it("returns private asset blobs without JSON parsing", async () => {
    stubFetch(
      new Response(new Blob(["asset-bytes"], { type: "image/png" }), {
        status: 200,
      }),
    )

    const blob = await loadPrivateAssetBlob("resume-1", "asset-1")

    expect(blob.type).toBe("image/png")
    await expect(blob.text()).resolves.toBe("asset-bytes")
  })
})
