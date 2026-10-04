import { describe, expect, it } from "vitest"
import type { Announcement } from "../../shared/announcement/announcement-schema"
import {
  announcementDismissedStorageKey,
  dismissAnnouncement,
  filterDismissedAnnouncements,
  isAnnouncementDismissed,
  loadDismissedAnnouncements,
  maximumDismissedAnnouncementCount,
  resolveNextAnnouncementIndex,
} from "./announcement-dismissal"

function createStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key)
    },
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

function createAnnouncement(
  id: string,
  overrides: Partial<Announcement> = {},
): Announcement {
  return {
    id,
    level: "info",
    title: `公告 ${id}`,
    body: "正文",
    linkLabel: "",
    linkHref: "",
    enabled: true,
    sortOrder: 0,
    startsAt: null,
    endsAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("dismissal storage", () => {
  it("returns nothing when storage is unavailable", () => {
    expect(loadDismissedAnnouncements(null)).toEqual([])
  })

  it("survives corrupt or non-array payloads", () => {
    expect(loadDismissedAnnouncements(createStorage())).toEqual([])
    expect(
      loadDismissedAnnouncements(
        createStorage({ [announcementDismissedStorageKey]: "not-json" }),
      ),
    ).toEqual([])
    expect(
      loadDismissedAnnouncements(
        createStorage({ [announcementDismissedStorageKey]: '{"a":1}' }),
      ),
    ).toEqual([])
    expect(
      loadDismissedAnnouncements(
        createStorage({ [announcementDismissedStorageKey]: '[1,"a",null]' }),
      ),
    ).toEqual(["a"])
  })

  it("keeps working when the storage refuses to write", () => {
    const storage: Storage = {
      ...createStorage(),
      setItem: () => {
        throw new Error("quota exceeded")
      },
    }

    expect(() => dismissAnnouncement(storage, createAnnouncement("a"))).not.toThrow()
    expect(loadDismissedAnnouncements(storage)).toEqual([])
  })
})

describe("dismissAnnouncement", () => {
  it("records the announcement together with its update time", () => {
    const storage = createStorage()

    const dismissed = dismissAnnouncement(storage, createAnnouncement("a"))

    expect(dismissed).toEqual(["a@2026-10-01T00:00:00.000Z"])
    expect(loadDismissedAnnouncements(storage)).toEqual(dismissed)
  })

  it("replaces the previous record of the same announcement", () => {
    const storage = createStorage()
    dismissAnnouncement(storage, createAnnouncement("a"))
    dismissAnnouncement(
      storage,
      createAnnouncement("a", { updatedAt: "2026-10-05T00:00:00.000Z" }),
    )

    expect(loadDismissedAnnouncements(storage)).toEqual(["a@2026-10-05T00:00:00.000Z"])
  })

  it("caps the stored records and keeps the most recent ones", () => {
    const storage = createStorage()

    for (let index = 0; index < maximumDismissedAnnouncementCount + 5; index += 1) {
      dismissAnnouncement(storage, createAnnouncement(`a-${index}`))
    }

    const dismissed = loadDismissedAnnouncements(storage)
    expect(dismissed).toHaveLength(maximumDismissedAnnouncementCount)
    expect(dismissed[0]).toBe(
      `a-${maximumDismissedAnnouncementCount + 4}@2026-10-01T00:00:00.000Z`,
    )
  })

  it("does nothing when storage is unavailable", () => {
    expect(dismissAnnouncement(null, createAnnouncement("a"))).toEqual([
      "a@2026-10-01T00:00:00.000Z",
    ])
  })
})

describe("isAnnouncementDismissed", () => {
  it("matches only the exact announcement version", () => {
    const dismissed = ["a@2026-10-01T00:00:00.000Z"]

    expect(isAnnouncementDismissed(createAnnouncement("a"), dismissed)).toBe(true)
    expect(
      isAnnouncementDismissed(
        createAnnouncement("a", { updatedAt: "2026-10-09T00:00:00.000Z" }),
        dismissed,
      ),
    ).toBe(false)
    expect(isAnnouncementDismissed(createAnnouncement("b"), dismissed)).toBe(false)
  })

  it("brings an announcement back after the administrator edits it", () => {
    const original = createAnnouncement("a")
    const storage = createStorage()
    dismissAnnouncement(storage, original)

    const visible = filterDismissedAnnouncements(
      [createAnnouncement("a", { updatedAt: "2026-11-01T00:00:00.000Z" })],
      loadDismissedAnnouncements(storage),
    )

    expect(visible).toHaveLength(1)
  })
})

describe("filterDismissedAnnouncements", () => {
  it("removes every dismissed announcement", () => {
    const announcements = [createAnnouncement("a"), createAnnouncement("b")]

    expect(
      filterDismissedAnnouncements(announcements, [
        "a@2026-10-01T00:00:00.000Z",
        "b@2026-10-01T00:00:00.000Z",
      ]),
    ).toEqual([])
  })
})

describe("resolveNextAnnouncementIndex", () => {
  it("advances to the announcement that took the closed position", () => {
    const announcements = [createAnnouncement("a"), createAnnouncement("b")]

    expect(resolveNextAnnouncementIndex(announcements, 0, "a")).toBe(0)
  })

  it("keeps the current slide when the last announcement is closed", () => {
    const announcements = [createAnnouncement("a"), createAnnouncement("b")]

    expect(resolveNextAnnouncementIndex(announcements, 1, "b")).toBe(0)
  })

  it("returns zero when nothing remains", () => {
    expect(resolveNextAnnouncementIndex([createAnnouncement("a")], 0, "a")).toBe(0)
  })

  it("falls back to the current index for an unknown announcement", () => {
    const announcements = [
      createAnnouncement("a"),
      createAnnouncement("b"),
      createAnnouncement("c"),
    ]

    expect(resolveNextAnnouncementIndex(announcements, 2, "missing")).toBe(2)
  })
})
