import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  type AnnouncementInput,
  createEmptyAnnouncementInput,
} from "../../shared/announcement/announcement-schema"
import { FileAnnouncementRepository } from "./file-announcement-repository"

let directory: string
let databasePath: string

function createInput(overrides: Partial<AnnouncementInput> = {}): AnnouncementInput {
  return {
    ...createEmptyAnnouncementInput(),
    title: "系统维护通知",
    body: "今晚 23:00 进行数据库维护。",
    ...overrides,
  }
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "resume-announcements-"))
  databasePath = path.join(directory, "announcements.json")
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe("file announcement repository", () => {
  it("returns an empty list when the database file does not exist", async () => {
    const repository = new FileAnnouncementRepository(databasePath)

    await expect(repository.listAnnouncements()).resolves.toEqual([])
  })

  it("persists announcements across repository instances", async () => {
    const created = await new FileAnnouncementRepository(
      databasePath,
    ).createAnnouncement(createInput())

    const stored = await new FileAnnouncementRepository(
      databasePath,
    ).listAnnouncements()

    expect(stored).toEqual([created])
  })

  it("orders announcements by sort order then by recency", async () => {
    const repository = new FileAnnouncementRepository(databasePath)
    await repository.createAnnouncement(createInput({ title: "第二个", sortOrder: 1 }))
    const newer = await repository.createAnnouncement(
      createInput({ title: "新的第一个", sortOrder: 1 }),
    )
    await repository.createAnnouncement(createInput({ title: "最前", sortOrder: 0 }))

    const stored = await repository.listAnnouncements()

    expect(stored.map((entry) => entry.title)).toEqual(["最前", newer.title, "第二个"])
  })

  it("keeps the original creation time on update", async () => {
    const repository = new FileAnnouncementRepository(databasePath)
    const created = await repository.createAnnouncement(
      createInput({ title: "旧标题" }),
    )

    const updated = await repository.updateAnnouncement(
      created.id,
      createInput({ title: "新标题" }),
    )

    expect(updated?.title).toBe("新标题")
    expect(updated?.createdAt).toBe(created.createdAt)
  })

  it("returns null when updating a missing announcement", async () => {
    const repository = new FileAnnouncementRepository(databasePath)

    await expect(
      repository.updateAnnouncement("missing", createInput()),
    ).resolves.toBeNull()
  })

  it("reports whether a delete removed an existing announcement", async () => {
    const repository = new FileAnnouncementRepository(databasePath)
    const created = await repository.createAnnouncement(createInput())

    await expect(repository.deleteAnnouncement(created.id)).resolves.toBe(true)
    await expect(repository.deleteAnnouncement(created.id)).resolves.toBe(false)
    await expect(repository.listAnnouncements()).resolves.toEqual([])
  })

  it("serializes concurrent writes without losing records", async () => {
    const repository = new FileAnnouncementRepository(databasePath)

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        repository.createAnnouncement(createInput({ title: `公告 ${index}` })),
      ),
    )

    const stored = await repository.listAnnouncements()
    expect(stored).toHaveLength(5)
    const contents = JSON.parse(await readFile(databasePath, "utf8")) as {
      announcements: unknown[]
    }
    expect(contents.announcements).toHaveLength(5)
  })

  it("rejects a database file that violates the shared schema", async () => {
    const { writeFile } = await import("node:fs/promises")
    await writeFile(
      databasePath,
      JSON.stringify({
        announcements: [{ id: "announcement-1", title: "缺少必填字段" }],
      }),
      "utf8",
    )

    await expect(
      new FileAnnouncementRepository(databasePath).listAnnouncements(),
    ).rejects.toThrow()
  })
})
