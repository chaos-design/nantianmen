import { describe, expect, it } from "vitest"
import { buildPublishNotice, PUBLISH_NOTICE_DURATION_MS } from "./publish-notice"

describe("buildPublishNotice", () => {
  it("reports the publication version and the publish time", () => {
    const notice = buildPublishNotice({
      publicationVersion: 7,
      publishedAt: "2026-03-04T05:06:07.000Z",
    })

    expect(notice.message).toBe("已发布版本 V7")
    expect(notice.options.description).toMatch(/^发布时间：.+/)
    expect(notice.options.description).toContain("2026")
    expect(notice.options.description).not.toBe("发布时间：")
  })

  it("stays visible for three seconds", () => {
    expect(PUBLISH_NOTICE_DURATION_MS).toBe(3000)
    expect(
      buildPublishNotice({
        publicationVersion: 1,
        publishedAt: "2026-03-04T05:06:07.000Z",
      }).options.duration,
    ).toBe(3000)
  })

  it("keeps the raw value when the publish time cannot be parsed", () => {
    const notice = buildPublishNotice({
      publicationVersion: 2,
      publishedAt: "not-a-timestamp",
    })

    expect(notice.options.description).toBe("发布时间：not-a-timestamp")
  })
})
