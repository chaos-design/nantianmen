import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  type Announcement,
  type AnnouncementInput,
  announcementSchema,
} from "../../shared/announcement/announcement-schema"
import type { AnnouncementRepository } from "./announcement-repository"

interface FileAnnouncementDatabase {
  announcements: Announcement[]
}

const emptyDatabase = (): FileAnnouncementDatabase => ({ announcements: [] })

/**
 * 文件后端的公告仓储，只用于自动化测试和隔离环境。
 * 生产环境由 `readResumePersistenceConfig` 拒绝 file 后端。
 */
export class FileAnnouncementRepository implements AnnouncementRepository {
  private readonly databasePath: string
  private writeLock: Promise<void> = Promise.resolve()

  constructor(databasePath = path.join(process.cwd(), ".data", "announcements.json")) {
    this.databasePath = databasePath
  }

  private async readDatabase(): Promise<FileAnnouncementDatabase> {
    try {
      const contents = await readFile(this.databasePath, "utf8")
      const database = JSON.parse(contents) as FileAnnouncementDatabase
      return {
        announcements: (database.announcements ?? []).map((announcement) =>
          announcementSchema.parse(announcement),
        ),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyDatabase()
      }
      throw error
    }
  }

  private async writeDatabase(database: FileAnnouncementDatabase): Promise<void> {
    await mkdir(path.dirname(this.databasePath), { recursive: true })
    const temporaryPath = `${this.databasePath}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, JSON.stringify(database, null, 2), "utf8")
    await rename(temporaryPath, this.databasePath)
  }

  private async withWriteLock<T>(
    operation: (database: FileAnnouncementDatabase) => Promise<T> | T,
  ): Promise<T> {
    const previousLock = this.writeLock
    let releaseLock: () => void = () => undefined
    this.writeLock = new Promise<void>((resolve) => {
      releaseLock = resolve
    })

    await previousLock
    try {
      const database = await this.readDatabase()
      const result = await operation(database)
      await this.writeDatabase(database)
      return result
    } finally {
      releaseLock()
    }
  }

  async listAnnouncements(): Promise<Announcement[]> {
    const database = await this.readDatabase()
    // createdAt 只有毫秒精度，同一毫秒内的创建用数组序兜底：后写入的更新。
    return database.announcements
      .map((announcement, index) => ({ announcement, index }))
      .toSorted(
        (left, right) =>
          left.announcement.sortOrder - right.announcement.sortOrder ||
          right.announcement.createdAt.localeCompare(left.announcement.createdAt) ||
          right.index - left.index,
      )
      .map(({ announcement }) => structuredClone(announcement))
  }

  async createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
    return this.withWriteLock((database) => {
      const now = new Date().toISOString()
      const record = announcementSchema.parse({
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      })
      database.announcements.push(record)
      return structuredClone(record)
    })
  }

  async updateAnnouncement(
    announcementId: string,
    input: AnnouncementInput,
  ): Promise<Announcement | null> {
    return this.withWriteLock((database) => {
      const index = database.announcements.findIndex(
        (entry) => entry.id === announcementId,
      )
      const current = database.announcements[index]
      if (!current) {
        return null
      }
      const updated = announcementSchema.parse({
        ...input,
        id: announcementId,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      })
      database.announcements[index] = updated
      return structuredClone(updated)
    })
  }

  async deleteAnnouncement(announcementId: string): Promise<boolean> {
    return this.withWriteLock((database) => {
      const index = database.announcements.findIndex(
        (entry) => entry.id === announcementId,
      )
      if (index === -1) {
        return false
      }
      database.announcements.splice(index, 1)
      return true
    })
  }
}
