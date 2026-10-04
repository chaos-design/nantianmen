import { randomUUID } from "node:crypto"
import {
  type Announcement,
  type AnnouncementInput,
  announcementSchema,
} from "../../shared/announcement/announcement-schema"

/**
 * 全局公告仓储。
 *
 * 公告是平台级共享数据，不按用户隔离，也没有归属和版本概念，
 * 因此不复用简历仓储的 owner 维度，也不引入乐观锁。
 */
export interface AnnouncementRepository {
  listAnnouncements(): Promise<Announcement[]>
  createAnnouncement(input: AnnouncementInput): Promise<Announcement>
  updateAnnouncement(
    announcementId: string,
    input: AnnouncementInput,
  ): Promise<Announcement | null>
  deleteAnnouncement(announcementId: string): Promise<boolean>
}

/**
 * 公告存储整体不可用（例如尚未执行 SQL，表还不存在）。
 *
 * 这是基础设施缺失，不是业务校验失败，因此单列一个错误类型，
 * 让领域层能对「读取」选择降级、对「写入」选择报错。
 * 具体原因留在 reason 里，由仓储负责翻译，不把数据库错误码泄漏到领域层。
 */
export class AnnouncementStoreUnavailableError extends Error {
  constructor(public readonly reason: string) {
    // reason 同时进入 message，保证这个错误逃逸到 500 响应时，
    // 服务端日志里仍然能看到根因，而不是只剩一句「不可用」。
    super(`公告存储当前不可用：${reason}`)
    this.name = "AnnouncementStoreUnavailableError"
  }
}

export class InMemoryAnnouncementRepository implements AnnouncementRepository {
  private readonly records: Announcement[]

  constructor(seed: Announcement[] = []) {
    this.records = structuredClone(seed)
  }

  async listAnnouncements(): Promise<Announcement[]> {
    return this.sort(structuredClone(this.records))
  }

  async createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
    const now = new Date().toISOString()
    const record = announcementSchema.parse({
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    })
    this.records.push(record)
    return structuredClone(record)
  }

  async updateAnnouncement(
    announcementId: string,
    input: AnnouncementInput,
  ): Promise<Announcement | null> {
    const index = this.records.findIndex((entry) => entry.id === announcementId)
    if (index === -1) {
      return null
    }
    const updated = announcementSchema.parse({
      ...input,
      id: announcementId,
      createdAt: this.records[index].createdAt,
      updatedAt: new Date().toISOString(),
    })
    this.records[index] = updated
    return structuredClone(updated)
  }

  async deleteAnnouncement(announcementId: string): Promise<boolean> {
    const index = this.records.findIndex((entry) => entry.id === announcementId)
    if (index === -1) {
      return false
    }
    this.records.splice(index, 1)
    return true
  }

  private sort(records: Announcement[]): Announcement[] {
    return records.toSorted(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        right.createdAt.localeCompare(left.createdAt),
    )
  }
}
