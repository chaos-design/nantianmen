import { describe, expect, it } from "vitest"
import type { AnnouncementInput } from "../../shared/announcement/announcement-schema"
import { createEmptyAnnouncementInput } from "../../shared/announcement/announcement-schema"
import type { ServerSupabaseClient } from "../supabase/supabase-client"
import { AnnouncementStoreUnavailableError } from "./announcement-repository"
import { SupabaseAnnouncementRepository } from "./supabase-announcement-repository"

function createInput(overrides: Partial<AnnouncementInput> = {}): AnnouncementInput {
  return {
    ...createEmptyAnnouncementInput(),
    title: "系统维护通知",
    body: "今晚 23:00 进行数据库维护。",
    ...overrides,
  }
}

function createRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "announcement-1",
    level: "info",
    title: "系统维护通知",
    body: "今晚 23:00 进行数据库维护。",
    link_label: "",
    link_href: "",
    enabled: true,
    sort_order: 0,
    starts_at: null,
    ends_at: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-02T00:00:00.000Z",
    ...overrides,
  }
}

/**
 * `listAnnouncements` 直接 await Supabase 的查询构建器，
 * 而构建器是 thenable，替身必须复现同一个 await 语义。
 */
interface QueryResult {
  data: unknown
  error: unknown
}

function createListQuery(
  result: QueryResult,
  onOrder?: (column: string, ascending: boolean) => void,
) {
  const query = {
    select: () => query,
    order: (column: string, options: { ascending: boolean }) => {
      onOrder?.(column, options.ascending)
      return query
    },
    // biome-ignore lint/suspicious/noThenProperty: 复刻 Supabase 查询构建器的 thenable 契约
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(resolve(result)),
  }
  return query
}

describe("supabase announcement repository", () => {
  it("reads the announcements table ordered by sort order", async () => {
    const calls: { tables: string[]; orders: Array<[string, boolean]> } = {
      tables: [],
      orders: [],
    }
    const query = createListQuery(
      { data: [createRow()], error: null },
      (column, ascending) => calls.orders.push([column, ascending]),
    )
    const supabase = {
      from(table: string) {
        calls.tables.push(table)
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseAnnouncementRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    const announcements = await repository.listAnnouncements()

    expect(calls.tables).toEqual(["announcements"])
    expect(calls.orders).toEqual([
      ["sort_order", true],
      ["created_at", false],
    ])
    expect(announcements[0]).toMatchObject({
      id: "announcement-1",
      linkLabel: "",
      startsAt: null,
    })
  })

  it("surfaces Supabase failures as errors instead of silently returning nothing", async () => {
    const query = createListQuery({
      data: null,
      error: { code: "42501", message: "permission denied", details: "", hint: "" },
    })
    const supabase = {
      from() {
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseAnnouncementRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    await expect(repository.listAnnouncements()).rejects.toThrow(/permission denied/)
  })

  it.each(["42P01", "PGRST205"])(
    "reports a missing table as a store outage for %s",
    async (code) => {
      const query = createListQuery({
        data: null,
        error: { code, message: "relation does not exist", details: "", hint: "" },
      })
      const supabase = {
        from() {
          return query
        },
      } as unknown as ServerSupabaseClient
      const repository = new SupabaseAnnouncementRepository(
        "https://example.supabase.co",
        "service-role-key",
        supabase,
      )

      await expect(repository.listAnnouncements()).rejects.toBeInstanceOf(
        AnnouncementStoreUnavailableError,
      )
    },
  )

  it("names the SQL scripts to run in the store outage reason", async () => {
    const query = createListQuery({
      data: null,
      error: {
        code: "42P01",
        message: "relation does not exist",
        details: "",
        hint: "",
      },
    })
    const supabase = {
      from() {
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseAnnouncementRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    await expect(repository.listAnnouncements()).rejects.toThrow(
      /platform\.sql|update\.sql/,
    )
  })

  it("writes snake_case columns when creating an announcement", async () => {
    let inserted: Record<string, unknown> | undefined
    const query = {
      insert(payload: Record<string, unknown>) {
        inserted = payload
        return this
      },
      select() {
        return this
      },
      async single() {
        return {
          data: createRow({
            title: "新公告",
            link_label: "服务条款",
            link_href: "/terms",
          }),
          error: null,
        }
      },
    }
    const supabase = {
      from() {
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseAnnouncementRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    const created = await repository.createAnnouncement(
      createInput({ title: "新公告", linkLabel: "服务条款", linkHref: "/terms" }),
    )

    expect(inserted).toMatchObject({
      title: "新公告",
      link_label: "服务条款",
      link_href: "/terms",
      sort_order: 0,
    })
    expect(created.linkLabel).toBe("服务条款")
  })

  it("returns null when updating an announcement that no longer exists", async () => {
    const calls: { tables: string[]; filters: Array<[string, unknown]> } = {
      tables: [],
      filters: [],
    }
    const query = {
      update() {
        return this
      },
      eq(column: string, value: unknown) {
        calls.filters.push([column, value])
        return this
      },
      select() {
        return this
      },
      async maybeSingle() {
        return { data: null, error: null }
      },
    }
    const supabase = {
      from(table: string) {
        calls.tables.push(table)
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseAnnouncementRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    await expect(
      repository.updateAnnouncement("announcement-1", createInput()),
    ).resolves.toBeNull()
    expect(calls.filters).toEqual([["id", "announcement-1"]])
  })

  it("reports whether a delete actually removed a row", async () => {
    const calls: { filters: Array<[string, unknown]> } = { filters: [] }
    const query = {
      delete() {
        return this
      },
      eq(column: string, value: unknown) {
        calls.filters.push([column, value])
        return this
      },
      select() {
        return this
      },
      async maybeSingle() {
        return { data: { id: "announcement-1" }, error: null }
      },
    }
    const supabase = {
      from() {
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseAnnouncementRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    await expect(repository.deleteAnnouncement("announcement-1")).resolves.toBe(true)
    expect(calls.filters).toEqual([["id", "announcement-1"]])
  })

  it("rejects stored rows that violate the shared schema", async () => {
    const query = createListQuery({
      data: [createRow({ link_href: "javascript:alert(1)" })],
      error: null,
    })
    const supabase = {
      from() {
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseAnnouncementRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    await expect(repository.listAnnouncements()).rejects.toThrow()
  })
})
