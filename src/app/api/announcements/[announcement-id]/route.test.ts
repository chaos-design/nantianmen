import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InMemoryAnnouncementRepository } from "../../../../server/repositories/announcement-repository"
import { setAnnouncementRepositoryForTests } from "../../../../server/repositories/announcement-repository-factory"
import type {
  Announcement,
  AnnouncementInput,
} from "../../../../shared/announcement/announcement-schema"
import { createEmptyAnnouncementInput } from "../../../../shared/announcement/announcement-schema"
import { DELETE, PATCH } from "./route"

const authState = vi.hoisted(() => ({
  authenticated: true,
  isAdmin: false,
  mode: "user" as "preview" | "user",
}))

vi.mock("../../../../server/auth/auth-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../server/auth/auth-context")>()
  return {
    ...actual,
    requireAuthContext: async () => {
      if (!authState.authenticated) {
        throw new actual.AuthenticationError("AUTH_REQUIRED", "请先登录后再继续", 401)
      }
      return {
        userId: "11111111-1111-4111-8111-111111111111",
        email: "member@example.com",
        isAdmin: authState.isAdmin,
        mode: authState.mode,
        ...(authState.mode === "preview"
          ? { previewResumeId: "22222222-2222-4222-8222-222222222222" }
          : {}),
      }
    },
  }
})

const routeContext = {
  params: Promise.resolve({ "announcement-id": "announcement-1" }),
}

function createInput(overrides: Partial<AnnouncementInput> = {}): AnnouncementInput {
  return {
    ...createEmptyAnnouncementInput(),
    title: "系统维护通知",
    body: "今晚 23:00 进行数据库维护。",
    ...overrides,
  }
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

function installRepository(seed: Announcement[] = []) {
  const repository = new InMemoryAnnouncementRepository(seed)
  setAnnouncementRepositoryForTests(repository)
  return repository
}

function patchRequest(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/announcements/announcement-1", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(body),
    }),
    routeContext,
  )
}

function deleteRequest(origin = "http://localhost") {
  return DELETE(
    new Request("http://localhost/api/announcements/announcement-1", {
      method: "DELETE",
      headers: { origin },
    }),
    routeContext,
  )
}

beforeEach(() => {
  authState.authenticated = true
  authState.isAdmin = false
  authState.mode = "user"
})

afterEach(() => {
  setAnnouncementRepositoryForTests(undefined)
})

describe("announcement item route", () => {
  // 该路径只承载单条更新和删除。
  // 管理员的全量列表由工作台服务端组件下发，不走这里，
  // 避免出现「按单条 ID 命名的路径返回整个列表」的语义错位。
  it("exposes no collection read on the item path", async () => {
    const routeModule = (await import("./route")) as Record<string, unknown>

    expect(routeModule.GET).toBeUndefined()
  })

  it("lets an administrator update an announcement", async () => {
    authState.isAdmin = true
    const repository = installRepository([
      createStoredAnnouncement({ title: "旧标题" }),
    ])

    const response = await patchRequest(createInput({ title: "新标题" }))

    expect(response.status).toBe(200)
    await expect(repository.listAnnouncements()).resolves.toMatchObject([
      { id: "announcement-1", title: "新标题" },
    ])
  })

  it("refuses updates from members and Preview", async () => {
    const repository = installRepository([
      createStoredAnnouncement({ title: "旧标题" }),
    ])

    const memberResponse = await patchRequest(createInput({ title: "新标题" }))
    authState.mode = "preview"
    const previewResponse = await patchRequest(createInput({ title: "新标题" }))

    expect(memberResponse.status).toBe(403)
    expect(previewResponse.status).toBe(403)
    await expect(repository.listAnnouncements()).resolves.toMatchObject([
      { title: "旧标题" },
    ])
  })

  it("rejects cross-origin updates and deletes", async () => {
    authState.isAdmin = true
    installRepository([createStoredAnnouncement()])

    const patchResponse = await PATCH(
      new Request("http://localhost/api/announcements/announcement-1", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example.com",
        },
        body: JSON.stringify(createInput()),
      }),
      routeContext,
    )
    const deleteResponse = await deleteRequest("https://evil.example.com")

    expect(patchResponse.status).toBe(403)
    expect(deleteResponse.status).toBe(403)
  })

  it("returns 404 when updating an announcement that does not exist", async () => {
    authState.isAdmin = true
    installRepository()

    const response = await patchRequest(createInput())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ANNOUNCEMENT_NOT_FOUND" },
    })
  })

  it("lets an administrator delete an announcement", async () => {
    authState.isAdmin = true
    const repository = installRepository([createStoredAnnouncement()])

    const response = await deleteRequest()

    expect(response.status).toBe(204)
    await expect(repository.listAnnouncements()).resolves.toHaveLength(0)
  })

  it("refuses deletes from members and reports missing announcements", async () => {
    authState.isAdmin = true
    installRepository()

    const memberResponse = await (async () => {
      authState.isAdmin = false
      const response = await deleteRequest()
      authState.isAdmin = true
      return response
    })()
    const missingResponse = await deleteRequest()

    expect(memberResponse.status).toBe(403)
    expect(missingResponse.status).toBe(404)
  })

  it("rejects anonymous access to every method", async () => {
    authState.authenticated = false
    installRepository([createStoredAnnouncement()])

    expect((await patchRequest(createInput())).status).toBe(401)
    expect((await deleteRequest()).status).toBe(401)
  })
})
