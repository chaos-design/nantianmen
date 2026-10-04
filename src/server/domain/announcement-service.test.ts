import { afterEach, describe, expect, it, vi } from "vitest"
import {
  type Announcement,
  type AnnouncementInput,
  createEmptyAnnouncementInput,
  maximumAnnouncementCount,
} from "../../shared/announcement/announcement-schema"
import {
  AnnouncementStoreUnavailableError,
  InMemoryAnnouncementRepository,
} from "../repositories/announcement-repository"
import { AnnouncementService, assertAnnouncementAdmin } from "./announcement-service"
import { type Actor, DomainError } from "./resume-service"

const member: Actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  isAdmin: false,
}
const admin: Actor = {
  userId: "00000000-0000-4000-8000-000000000002",
  isAdmin: true,
}
const preview: Actor = {
  userId: "00000000-0000-4000-8000-000000000003",
  isAdmin: false,
  mode: "preview",
  previewResumeId: "00000000-0000-4000-8000-000000000004",
}

function createInput(overrides: Partial<AnnouncementInput> = {}): AnnouncementInput {
  return {
    ...createEmptyAnnouncementInput(),
    title: "系统维护通知",
    body: "今晚 23:00 进行数据库维护。",
    ...overrides,
  }
}

function createService(seed: Announcement[] = []) {
  const repository = new InMemoryAnnouncementRepository(seed)
  return { repository, service: new AnnouncementService(repository) }
}

function createStoredAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: "announcement-1",
    ...createInput(),
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("assertAnnouncementAdmin", () => {
  it("rejects members and Preview before touching the repository", () => {
    expect(() => assertAnnouncementAdmin(member)).toThrow(DomainError)
    expect(() => assertAnnouncementAdmin(preview)).toThrow(DomainError)
    expect(() => assertAnnouncementAdmin(admin)).not.toThrow()
  })

  it("reports Preview as read-only and members as unauthorized", () => {
    expect(() => assertAnnouncementAdmin(preview)).toThrow(
      expect.objectContaining({ code: "PREVIEW_READ_ONLY", status: 403 }),
    )
    expect(() => assertAnnouncementAdmin(member)).toThrow(
      expect.objectContaining({ code: "ADMIN_REQUIRED", status: 403 }),
    )
  })
})

describe("AnnouncementService reading", () => {
  it("returns the same list to every caller because announcements are shared", async () => {
    const { service } = createService([
      createStoredAnnouncement({ id: "a" }),
      createStoredAnnouncement({ id: "b" }),
    ])

    await expect(service.listVisibleAnnouncements()).resolves.toHaveLength(2)
  })

  it("hides disabled announcements and announcements outside the time window", async () => {
    const now = new Date("2026-10-10T00:00:00.000Z")
    const { service } = createService([
      createStoredAnnouncement({ id: "disabled", enabled: false }),
      createStoredAnnouncement({
        id: "upcoming",
        startsAt: "2026-10-11T00:00:00.000Z",
      }),
      createStoredAnnouncement({
        id: "expired",
        endsAt: "2026-10-09T00:00:00.000Z",
      }),
      createStoredAnnouncement({
        id: "live",
        startsAt: "2026-10-09T00:00:00.000Z",
        endsAt: "2026-10-11T00:00:00.000Z",
      }),
    ])

    const visible = await service.listVisibleAnnouncements(now)

    expect(visible.map((announcement) => announcement.id)).toEqual(["live"])
  })

  it("returns all announcements to an administrator regardless of state", async () => {
    const { service } = createService([
      createStoredAnnouncement({ id: "disabled", enabled: false }),
    ])

    const overview = await service.listAllAnnouncements(admin)

    expect(overview.totalCount).toBe(1)
    expect(overview.announcements[0]?.id).toBe("disabled")
  })

  it("refuses the management list to members", async () => {
    const { service } = createService()

    await expect(service.listAllAnnouncements(member)).rejects.toMatchObject({
      code: "ADMIN_REQUIRED",
      status: 403,
    })
  })
})

describe("AnnouncementService writing", () => {
  it("creates an announcement for an administrator", async () => {
    const { service } = createService()

    const created = await service.createAnnouncement(
      admin,
      createInput({ linkHref: "/terms", linkLabel: "服务条款" }),
    )

    expect(created.id).toBeTruthy()
    expect(created.linkHref).toBe("/terms")
  })

  it("rejects creation by members and Preview", async () => {
    const { service, repository } = createService()

    await expect(
      service.createAnnouncement(member, createInput()),
    ).rejects.toMatchObject({
      code: "ADMIN_REQUIRED",
      status: 403,
    })
    await expect(
      service.createAnnouncement(preview, createInput()),
    ).rejects.toMatchObject({ code: "PREVIEW_READ_ONLY", status: 403 })
    await expect(repository.listAnnouncements()).resolves.toHaveLength(0)
  })

  it("rejects invalid announcement payloads with a 422", async () => {
    const { service } = createService()

    await expect(
      service.createAnnouncement(admin, { ...createInput(), title: "" }),
    ).rejects.toMatchObject({ code: "INVALID_ANNOUNCEMENT", status: 422 })
    await expect(
      service.createAnnouncement(
        admin,
        createInput({ linkHref: "javascript:alert(1)" }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_ANNOUNCEMENT", status: 422 })
  })

  it("rejects payloads that are not objects", async () => {
    const { service } = createService()

    await expect(service.createAnnouncement(admin, null)).rejects.toMatchObject({
      code: "INVALID_ANNOUNCEMENT",
      status: 422,
    })
    await expect(service.createAnnouncement(admin, "text")).rejects.toMatchObject({
      code: "INVALID_ANNOUNCEMENT",
      status: 422,
    })
  })

  it("caps the number of stored announcements", async () => {
    const seed = Array.from({ length: maximumAnnouncementCount }, (_, index) =>
      createStoredAnnouncement({ id: `announcement-${index}` }),
    )
    const { service } = createService(seed)

    await expect(
      service.createAnnouncement(admin, createInput()),
    ).rejects.toMatchObject({
      code: "ANNOUNCEMENT_LIMIT_REACHED",
      status: 409,
    })
  })

  it("updates an existing announcement and keeps its creation time", async () => {
    const { service } = createService([
      createStoredAnnouncement({ id: "announcement-1", title: "旧标题" }),
    ])

    const updated = await service.updateAnnouncement(
      admin,
      "announcement-1",
      createInput({ title: "新标题" }),
    )

    expect(updated.title).toBe("新标题")
    expect(updated.createdAt).toBe("2026-10-01T00:00:00.000Z")
  })

  it("reports a 404 when the announcement to update does not exist", async () => {
    const { service } = createService()

    await expect(
      service.updateAnnouncement(admin, "missing", createInput()),
    ).rejects.toMatchObject({ code: "ANNOUNCEMENT_NOT_FOUND", status: 404 })
  })

  it("refuses updates and deletes from members", async () => {
    const { service } = createService([createStoredAnnouncement()])

    await expect(
      service.updateAnnouncement(member, "announcement-1", createInput()),
    ).rejects.toMatchObject({ code: "ADMIN_REQUIRED", status: 403 })
    await expect(
      service.deleteAnnouncement(member, "announcement-1"),
    ).rejects.toMatchObject({ code: "ADMIN_REQUIRED", status: 403 })
  })

  it("deletes an existing announcement", async () => {
    const { service, repository } = createService([createStoredAnnouncement()])

    await service.deleteAnnouncement(admin, "announcement-1")

    await expect(repository.listAnnouncements()).resolves.toHaveLength(0)
  })

  it("reports a 404 when deleting an announcement that does not exist", async () => {
    const { service } = createService()

    await expect(service.deleteAnnouncement(admin, "missing")).rejects.toMatchObject({
      code: "ANNOUNCEMENT_NOT_FOUND",
      status: 404,
    })
  })
})

describe("AnnouncementService ordering", () => {
  it("returns announcements ordered by sort order then recency", async () => {
    const { service } = createService([
      createStoredAnnouncement({
        id: "older",
        sortOrder: 1,
        createdAt: "2026-09-01T00:00:00.000Z",
      }),
      createStoredAnnouncement({
        id: "newer",
        sortOrder: 1,
        createdAt: "2026-10-01T00:00:00.000Z",
      }),
      createStoredAnnouncement({ id: "first", sortOrder: 0 }),
    ])

    const visible = await service.listVisibleAnnouncements()

    expect(visible.map((announcement) => announcement.id)).toEqual([
      "first",
      "newer",
      "older",
    ])
  })
})

describe("AnnouncementService when the store is unavailable", () => {
  function createUnavailableService() {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const repository = {
      listAnnouncements: async () => {
        throw new AnnouncementStoreUnavailableError("announcements 表不存在")
      },
      createAnnouncement: async () => {
        throw new AnnouncementStoreUnavailableError("announcements 表不存在")
      },
      updateAnnouncement: async () => {
        throw new AnnouncementStoreUnavailableError("announcements 表不存在")
      },
      deleteAnnouncement: async () => {
        throw new AnnouncementStoreUnavailableError("announcements 表不存在")
      },
    }
    return { warn, service: new AnnouncementService(repository) }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("degrades the public read to an empty list instead of failing the page", async () => {
    const { service } = createUnavailableService()

    await expect(service.listVisibleAnnouncements()).resolves.toEqual([])
  })

  it("leaves a warn log naming the cause so the failure is not silent", async () => {
    const { service, warn } = createUnavailableService()

    await service.listVisibleAnnouncements()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain("announcements 表不存在")
  })

  it("does not degrade the administrator management list", async () => {
    const { service, warn } = createUnavailableService()

    await expect(service.listAllAnnouncements(admin)).rejects.toBeInstanceOf(
      AnnouncementStoreUnavailableError,
    )
    // 管理员配置面板必须看到真实失败，否则会误判成「一条公告都没有」。
    expect(warn).not.toHaveBeenCalled()
  })

  it("does not degrade writes", async () => {
    const { service } = createUnavailableService()

    await expect(
      service.createAnnouncement(admin, createInput()),
    ).rejects.toBeInstanceOf(AnnouncementStoreUnavailableError)
    await expect(
      service.updateAnnouncement(admin, "announcement-1", createInput()),
    ).rejects.toBeInstanceOf(AnnouncementStoreUnavailableError)
    await expect(
      service.deleteAnnouncement(admin, "announcement-1"),
    ).rejects.toBeInstanceOf(AnnouncementStoreUnavailableError)
  })

  it("still propagates unrelated repository failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const service = new AnnouncementService({
      listAnnouncements: async () => {
        throw new Error("SUPABASE_42501: permission denied")
      },
      createAnnouncement: async () => {
        throw new Error("unused")
      },
      updateAnnouncement: async () => null,
      deleteAnnouncement: async () => false,
    })

    await expect(service.listVisibleAnnouncements()).rejects.toThrow(
      /permission denied/,
    )
    expect(warn).not.toHaveBeenCalled()
  })
})
