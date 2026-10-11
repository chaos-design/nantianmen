import { describe, expect, it } from "vitest"
import type { AnnouncementOverview } from "../../server/domain/announcement-service"
import type {
  Announcement,
  AnnouncementInput,
} from "../../shared/announcement/announcement-schema"
import {
  type AnnouncementRow,
  isRowDirty,
  mergeRows,
  toInput,
  toRows,
} from "./announcement-rows"

function createStoredAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: "announcement-1",
    level: "info",
    title: "标题",
    body: "正文",
    linkLabel: "",
    linkHref: "",
    enabled: true,
    sortOrder: 0,
    startsAt: null,
    endsAt: null,
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: "2026-10-05T00:00:00.000Z",
    ...overrides,
  }
}

function overviewOf(announcements: Announcement[]): AnnouncementOverview {
  return { announcements, totalCount: announcements.length }
}

function inputOf(overrides: Partial<AnnouncementInput> = {}): AnnouncementInput {
  return {
    level: "info",
    title: "标题",
    body: "正文",
    linkLabel: "",
    linkHref: "",
    enabled: true,
    sortOrder: 0,
    startsAt: null,
    endsAt: null,
    ...overrides,
  }
}

function persistedRow(
  clientId: string,
  overrides: Partial<AnnouncementRow> = {},
): AnnouncementRow {
  const saved = inputOf()
  return { clientId, id: clientId, draft: saved, saved, ...overrides }
}

function newDraftRow(clientId: string, draft: Partial<AnnouncementInput> = {}) {
  return {
    clientId,
    id: null,
    draft: inputOf({ title: "", body: "", ...draft }),
    saved: null,
  } satisfies AnnouncementRow
}

describe("announcement row helpers", () => {
  it("projects a stored announcement into an editable input", () => {
    const input = toInput(
      createStoredAnnouncement({
        level: "warning",
        title: "维护通知",
        startsAt: "2026-10-05T01:00:00.000Z",
      }),
    )

    expect(input.level).toBe("warning")
    expect(input.title).toBe("维护通知")
    expect(input.startsAt).toBe("2026-10-05T01:00:00.000Z")
  })

  it("treats a new draft and an edited announcement as dirty", () => {
    expect(isRowDirty(newDraftRow("new-1"))).toBe(true)
    expect(isRowDirty(persistedRow("announcement-1"))).toBe(false)
    expect(
      isRowDirty(
        persistedRow("announcement-1", {
          draft: inputOf({ title: "改过的标题" }),
        }),
      ),
    ).toBe(true)
  })

  it("keeps an in-progress edit when the server list comes back", () => {
    // 这是面板切到「一次只编一条」之后才暴露的路径：
    // 管理员正在编辑第 3 条，此时别处发生写操作，router.refresh() 带回来的
    // props 不能把正在编辑的草稿冲掉。服务端此时拿到的还是旧值。
    const local: AnnouncementRow[] = [
      persistedRow("announcement-1"),
      persistedRow("announcement-2"),
      persistedRow("announcement-3", {
        draft: inputOf({ title: "正在编辑的标题", body: "正在编辑的正文" }),
      }),
    ]

    const merged = mergeRows(
      overviewOf([
        createStoredAnnouncement({ id: "announcement-1" }),
        createStoredAnnouncement({ id: "announcement-2" }),
        createStoredAnnouncement({ id: "announcement-3", title: "服务端旧标题" }),
      ]),
      local,
    )

    // 关键断言：正在编辑的草稿没有被服务端值覆盖。
    expect(merged).toHaveLength(3)
    expect(merged[2].draft.title).toBe("正在编辑的标题")
    expect(merged[2].draft.body).toBe("正在编辑的正文")
    // 同一批里没人编辑的行仍然采用服务端值。
    expect(merged[0].draft.title).toBe("标题")
  })

  it("drops rows the server no longer returns", () => {
    // 列表以服务端为准：被别人删掉的行不能继续躺在面板里，
    // 否则管理员会点到一个必然 404 的条目。
    const local: AnnouncementRow[] = [
      persistedRow("announcement-1"),
      persistedRow("announcement-2"),
    ]

    const merged = mergeRows(overviewOf([createStoredAnnouncement()]), local)

    expect(merged.map((row) => row.clientId)).toEqual(["announcement-1"])
  })

  it("still lets server changes reach rows nobody is editing", () => {
    const local = [persistedRow("announcement-1"), persistedRow("announcement-2")]

    const merged = mergeRows(
      overviewOf([
        createStoredAnnouncement({ id: "announcement-1", title: "服务端新标题" }),
        createStoredAnnouncement({ id: "announcement-2" }),
      ]),
      local,
    )

    expect(merged[0].draft.title).toBe("服务端新标题")
    // 没有改动的行应当被服务端值整体接管，saved 一起更新。
    expect(merged[0].saved?.title).toBe("服务端新标题")
    expect(merged[1].saved?.title).toBe("标题")
  })

  it("adopts the server copy for a row the admin just saved unchanged", () => {
    // 保存后 draft 与 saved 相同，行不再是 dirty，下一次 refresh 会用服务端值覆盖。
    // 这里确认覆盖不会丢字段。
    const local = [persistedRow("announcement-1")]

    const merged = mergeRows(
      overviewOf([
        createStoredAnnouncement({
          id: "announcement-1",
          updatedAt: "2026-10-06T00:00:00.000Z",
          sortOrder: 42,
        }),
      ]),
      local,
    )

    expect(merged[0].draft.sortOrder).toBe(42)
    expect(merged[0].saved?.sortOrder).toBe(42)
    expect(isRowDirty(merged[0])).toBe(false)
  })

  it("starts from the server list for an untouched panel", () => {
    const rows = toRows(
      overviewOf([
        createStoredAnnouncement({ id: "announcement-1" }),
        createStoredAnnouncement({ id: "announcement-2" }),
      ]),
    )

    expect(rows.map((row) => row.clientId)).toEqual([
      "announcement-1",
      "announcement-2",
    ])
    expect(rows.every((row) => !isRowDirty(row))).toBe(true)
  })
})
