import { ZodError } from "zod"
import {
  type Announcement,
  type AnnouncementInput,
  announcementInputSchema,
  isAnnouncementVisibleAt,
  maximumAnnouncementCount,
} from "../../shared/announcement/announcement-schema"
import type { AnnouncementRepository } from "../repositories/announcement-repository"
import { AnnouncementStoreUnavailableError } from "../repositories/announcement-repository"
import { type Actor, DomainError } from "./resume-service"

/**
 * 公告是全站共享的运营位，不是简历数据：
 * 所有登录用户（含 Preview）读取同一份列表，写入只开放给管理员。
 */

export interface AnnouncementOverview {
  announcements: Announcement[]
  totalCount: number
}

export function assertAnnouncementAdmin(actor: Actor): void {
  if (actor.mode === "preview") {
    throw new DomainError(
      "PREVIEW_READ_ONLY",
      "Preview 模式只能查看，不能修改公告",
      403,
    )
  }
  if (!actor.isAdmin) {
    throw new DomainError("ADMIN_REQUIRED", "只有管理员可以配置平台公告", 403)
  }
}

function parseInput(input: unknown): AnnouncementInput {
  try {
    return announcementInputSchema.parse(input)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DomainError(
        "INVALID_ANNOUNCEMENT",
        "公告内容不符合格式要求",
        422,
        error.issues,
      )
    }
    throw error
  }
}

function toAnnouncementListItem(announcement: Announcement): Announcement {
  return {
    ...announcement,
    title: announcement.title.trim(),
    body: announcement.body.trim(),
    linkLabel: announcement.linkLabel.trim(),
    linkHref: announcement.linkHref.trim(),
  }
}

export class AnnouncementService {
  constructor(private readonly repository: AnnouncementRepository) {}

  /**
   * 读取当前时刻应该展示的公告。
   *
   * 公告对所有登录用户一致，不存在按身份区分的可见性，
   * 因此这里不接收 Actor：是否登录由 Route Handler 决定，可见性由数据决定。
   *
   * 存储整体不可用时降级为空列表并留下 warn 日志：
   * 公告是可选的运营位，不能因为忘执行 SQL 就让整个工作台 500。
   * 这不是静默吞错——原因会进日志，写入路径也仍然照常报错。
   */
  async listVisibleAnnouncements(now = new Date()): Promise<Announcement[]> {
    const all = await this.listAnnouncementsOrDegrade()
    return all
      .filter((announcement) => isAnnouncementVisibleAt(announcement, now))
      .map(toAnnouncementListItem)
  }

  /**
   * 管理员读取全部公告，包括已停用和不在时间窗口内的条目。
   *
   * 刻意不降级：管理员打开配置面板就是想看当前配置，
   * 把「表不存在」伪装成「一条公告都没有」会让它误判并重建数据。
   */
  async listAllAnnouncements(actor: Actor): Promise<AnnouncementOverview> {
    assertAnnouncementAdmin(actor)
    const announcements = await this.repository.listAnnouncements()
    return {
      announcements: announcements.map(toAnnouncementListItem),
      totalCount: announcements.length,
    }
  }

  async createAnnouncement(actor: Actor, input: unknown): Promise<Announcement> {
    assertAnnouncementAdmin(actor)
    const validated = parseInput(input)
    await this.assertBelowCapacity()
    const created = await this.repository.createAnnouncement(validated)
    return toAnnouncementListItem(created)
  }

  async updateAnnouncement(
    actor: Actor,
    announcementId: string,
    input: unknown,
  ): Promise<Announcement> {
    assertAnnouncementAdmin(actor)
    const validated = parseInput(input)
    const updated = await this.repository.updateAnnouncement(announcementId, validated)
    if (!updated) {
      throw new DomainError("ANNOUNCEMENT_NOT_FOUND", "公告不存在", 404)
    }
    return toAnnouncementListItem(updated)
  }

  async deleteAnnouncement(actor: Actor, announcementId: string): Promise<void> {
    assertAnnouncementAdmin(actor)
    const deleted = await this.repository.deleteAnnouncement(announcementId)
    if (!deleted) {
      throw new DomainError("ANNOUNCEMENT_NOT_FOUND", "公告不存在", 404)
    }
  }

  private async listAnnouncementsOrDegrade(): Promise<Announcement[]> {
    try {
      return await this.repository.listAnnouncements()
    } catch (error) {
      if (error instanceof AnnouncementStoreUnavailableError) {
        console.warn(`[announcements] 跳过公告展示：${error.reason}`)
        return []
      }
      throw error
    }
  }

  private async assertBelowCapacity(): Promise<void> {
    const current = await this.repository.listAnnouncements()
    if (current.length >= maximumAnnouncementCount) {
      throw new DomainError(
        "ANNOUNCEMENT_LIMIT_REACHED",
        `最多同时保留 ${maximumAnnouncementCount} 条公告`,
        409,
        { limit: maximumAnnouncementCount, current: current.length },
      )
    }
  }
}
