import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InMemoryAnnouncementRepository } from "../../../server/repositories/announcement-repository"
import { setAnnouncementRepositoryForTests } from "../../../server/repositories/announcement-repository-factory"
import type {
  Announcement,
  AnnouncementInput,
} from "../../../shared/announcement/announcement-schema"
import { createEmptyAnnouncementInput } from "../../../shared/announcement/announcement-schema"
import { GET, POST } from "./route"

const authState = vi.hoisted(() => ({
  authenticated: true,
  isAdmin: false,
  mode: "user" as "preview" | "user",
}))

vi.mock("../../../server/auth/auth-context", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../server/auth/auth-context")>()
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

function readRequest() {
  return GET(new Request("http://localhost/api/announcements"))
}

function writeRequest(body: unknown) {
  return POST(
    new Request("http://localhost/api/announcements", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(body),
    }),
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

describe("announcements route", () => {
  it("returns the visible announcements without allowing caching", async () => {
    installRepository([
      createStoredAnnouncement({ id: "live" }),
      createStoredAnnouncement({ id: "disabled", enabled: false }),
    ])

    const response = await readRequest()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    const payload = (await response.json()) as {
      data: { announcements: Announcement[] }
    }
    expect(payload.data.announcements.map((item) => item.id)).toEqual(["live"])
  })

  it("lets Preview read the announcements", async () => {
    authState.mode = "preview"
    installRepository([createStoredAnnouncement()])

    const response = await readRequest()

    expect(response.status).toBe(200)
  })

  it("rejects anonymous reads", async () => {
    authState.authenticated = false
    installRepository()

    const response = await readRequest()

    expect(response.status).toBe(401)
  })

  it("rejects cross-origin writes", async () => {
    authState.isAdmin = true
    installRepository()

    const response = await POST(
      new Request("http://localhost/api/announcements", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example.com",
        },
        body: JSON.stringify(createInput()),
      }),
    )

    expect(response.status).toBe(403)
  })

  it("lets an administrator create an announcement", async () => {
    authState.isAdmin = true
    const repository = installRepository()

    const response = await writeRequest(createInput())

    expect(response.status).toBe(201)
    await expect(repository.listAnnouncements()).resolves.toHaveLength(1)
  })

  it("refuses creation by members", async () => {
    const repository = installRepository()

    const response = await writeRequest(createInput())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ADMIN_REQUIRED" },
    })
    await expect(repository.listAnnouncements()).resolves.toHaveLength(0)
  })

  it("refuses creation by Preview", async () => {
    authState.isAdmin = true
    authState.mode = "preview"
    const repository = installRepository()

    const response = await writeRequest(createInput())

    expect(response.status).toBe(403)
    await expect(repository.listAnnouncements()).resolves.toHaveLength(0)
  })

  it("rejects a malformed announcement payload", async () => {
    authState.isAdmin = true
    installRepository()

    const response = await writeRequest({ ...createInput(), title: "" })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_ANNOUNCEMENT" },
    })
  })

  it("rejects a request body that is not JSON", async () => {
    authState.isAdmin = true
    installRepository()

    const response = await POST(
      new Request("http://localhost/api/announcements", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: "not-json",
      }),
    )

    expect(response.status).toBe(422)
  })
})
