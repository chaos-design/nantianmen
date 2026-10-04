import type { Announcement } from "../../shared/announcement/announcement-schema"

/**
 * 用户关闭状态只保存在浏览器本地。
 *
 * 关闭是「我不想再看这条」的个人偏好，不是服务端数据：
 * 写入服务端需要按用户建表，而公告本身没有归属用户，这条记录无处安放。
 * 管理员停用公告走 `enabled` 字段，与用户关闭互不干扰。
 */
export const announcementDismissedStorageKey = "resume-lab:announcements-dismissed"

/** 保留的关闭记录上限，避免长期使用后 localStorage 无限增长。 */
export const maximumDismissedAnnouncementCount = 50

function readDismissed(storage: Storage | null): string[] {
  if (!storage) {
    return []
  }
  try {
    const raw = storage.getItem(announcementDismissedStorageKey)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((entry): entry is string => typeof entry === "string")
  } catch {
    // localStorage 可能被浏览器策略禁用或残留损坏数据，读不出来就当作没有关闭记录。
    return []
  }
}

function writeDismissed(storage: Storage | null, dismissed: string[]): void {
  if (!storage) {
    return
  }
  try {
    storage.setItem(announcementDismissedStorageKey, JSON.stringify(dismissed))
  } catch {
    // 配额不足时放弃持久化，本次会话内的关闭仍然生效。
  }
}

export function loadDismissedAnnouncements(storage: Storage | null): string[] {
  return readDismissed(storage)
}

/**
 * 关闭公告时保留最近关闭的记录。
 * 同时也记录被关闭条目的 `updatedAt`，这样管理员改过内容后用户能重新看到。
 */
export function dismissAnnouncement(
  storage: Storage | null,
  announcement: Pick<Announcement, "id" | "updatedAt">,
): string[] {
  const token = `${announcement.id}@${announcement.updatedAt}`
  const next = [
    token,
    ...readDismissed(storage).filter(
      (entry) => !entry.startsWith(`${announcement.id}@`),
    ),
  ].slice(0, maximumDismissedAnnouncementCount)
  writeDismissed(storage, next)
  return next
}

/**
 * 公告是否被当前用户关闭。
 * 记录带 `updatedAt`：管理员修改内容后版本变化，公告会重新出现。
 */
export function isAnnouncementDismissed(
  announcement: Pick<Announcement, "id" | "updatedAt">,
  dismissed: string[],
): boolean {
  return dismissed.includes(`${announcement.id}@${announcement.updatedAt}`)
}

export function filterDismissedAnnouncements(
  announcements: Announcement[],
  dismissed: string[],
): Announcement[] {
  return announcements.filter(
    (announcement) => !isAnnouncementDismissed(announcement, dismissed),
  )
}

/**
 * 计算关闭某条之后应展示的下一条。
 * 关闭当前条时优先展示后一条，关闭的恰好是最后一条时回到第一条。
 */
export function resolveNextAnnouncementIndex(
  announcements: Announcement[],
  currentIndex: number,
  closedAnnouncementId: string,
): number {
  const remaining = announcements.filter(
    (announcement) => announcement.id !== closedAnnouncementId,
  )
  if (remaining.length === 0) {
    return 0
  }
  const closedIndex = announcements.findIndex(
    (announcement) => announcement.id === closedAnnouncementId,
  )
  const target = closedIndex >= 0 ? closedIndex : currentIndex
  return Math.min(target, remaining.length - 1)
}
