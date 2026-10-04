import { describe, expect, it } from "vitest"
import {
  announcementInputSchema,
  announcementSchema,
  createEmptyAnnouncementInput,
  isAnnouncementVisibleAt,
  maximumAnnouncementCount,
} from "./announcement-schema"

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    ...createEmptyAnnouncementInput(),
    title: "系统维护通知",
    body: "今晚 23:00 进行数据库维护。",
    ...overrides,
  }
}

describe("announcementInputSchema", () => {
  it("accepts a complete announcement with relative dates", () => {
    const parsed = announcementInputSchema.safeParse(
      createInput({
        startsAt: "2026-10-01T00:00:00.000Z",
        endsAt: "2026-11-01T00:00:00.000Z",
      }),
    )

    expect(parsed.success).toBe(true)
  })

  it("trims surrounding whitespace on text fields", () => {
    const parsed = announcementInputSchema.parse(
      createInput({ title: "  标题  ", body: "  正文  " }),
    )

    expect(parsed.title).toBe("标题")
    expect(parsed.body).toBe("正文")
  })

  it.each([
    { title: "" },
    { title: "标题".repeat(41) },
    { body: "正文".repeat(121) },
    { linkLabel: "链".repeat(25) },
  ])("rejects out-of-range text input %o", (override) => {
    expect(announcementInputSchema.safeParse(createInput(override)).success).toBe(false)
  })

  it("rejects unknown keys", () => {
    const parsed = announcementInputSchema.safeParse({
      ...createInput(),
      internalOnly: true,
    })

    expect(parsed.success).toBe(false)
  })

  it("rejects an end time that is not after the start time", () => {
    const parsed = announcementInputSchema.safeParse(
      createInput({
        startsAt: "2026-10-10T00:00:00.000Z",
        endsAt: "2026-10-01T00:00:00.000Z",
      }),
    )

    expect(parsed.success).toBe(false)
  })

  it.each([
    { linkHref: "javascript:alert(1)", linkLabel: "点击" },
    { linkHref: "//evil.example.com", linkLabel: "点击" },
    { linkHref: "file:///etc/passwd", linkLabel: "点击" },
  ])("rejects unsafe link targets %o", (override) => {
    expect(announcementInputSchema.safeParse(createInput(override)).success).toBe(false)
  })

  it.each(["/terms", "https://example.com/notice"])(
    "accepts the safe link target %s",
    (linkHref) => {
      const parsed = announcementInputSchema.safeParse(
        createInput({ linkHref, linkLabel: "查看详情" }),
      )

      expect(parsed.success).toBe(true)
    },
  )

  it.each([{ linkHref: "/terms" }, { linkLabel: "查看详情" }])(
    "requires the link href and label to appear together %o",
    (override) => {
      expect(announcementInputSchema.safeParse(createInput(override)).success).toBe(
        false,
      )
    },
  )

  it("rejects a sort order outside the displayable range", () => {
    expect(
      announcementInputSchema.safeParse(createInput({ sortOrder: -1 })).success,
    ).toBe(false)
    expect(
      announcementInputSchema.safeParse(createInput({ sortOrder: 1000 })).success,
    ).toBe(false)
  })
})

describe("announcementSchema", () => {
  it("keeps the input refinements after extending with server fields", () => {
    const invalidLink = announcementSchema.safeParse({
      ...createInput(),
      id: "announcement-1",
      linkHref: "javascript:alert(1)",
      linkLabel: "点击",
      createdAt: "2026-10-04T00:00:00.000Z",
      updatedAt: "2026-10-04T00:00:00.000Z",
    })

    expect(invalidLink.success).toBe(false)
  })

  it("parses a stored announcement", () => {
    const parsed = announcementSchema.parse({
      ...createInput(),
      id: "announcement-1",
      createdAt: "2026-10-04T00:00:00.000Z",
      updatedAt: "2026-10-04T00:00:00.000Z",
    })

    expect(parsed.id).toBe("announcement-1")
  })
})

describe("isAnnouncementVisibleAt", () => {
  const base = { enabled: true, startsAt: null, endsAt: null }

  it("shows an enabled announcement without time bounds", () => {
    expect(isAnnouncementVisibleAt(base, new Date("2026-10-04T00:00:00.000Z"))).toBe(
      true,
    )
  })

  it("hides a disabled announcement", () => {
    expect(
      isAnnouncementVisibleAt(
        { ...base, enabled: false },
        new Date("2026-10-04T00:00:00.000Z"),
      ),
    ).toBe(false)
  })

  it("hides an announcement before its start time", () => {
    expect(
      isAnnouncementVisibleAt(
        { ...base, startsAt: "2026-10-05T00:00:00.000Z" },
        new Date("2026-10-04T00:00:00.000Z"),
      ),
    ).toBe(false)
  })

  it("hides an announcement at and after its end time", () => {
    const endAt = "2026-10-04T00:00:00.000Z"

    expect(isAnnouncementVisibleAt({ ...base, endsAt: endAt }, new Date(endAt))).toBe(
      false,
    )
    expect(
      isAnnouncementVisibleAt(
        { ...base, endsAt: endAt },
        new Date("2026-10-03T23:59:59.999Z"),
      ),
    ).toBe(true)
  })
})

describe("announcement limits", () => {
  it("caps the carousel at a reviewable amount of entries", () => {
    expect(maximumAnnouncementCount).toBe(20)
  })
})
