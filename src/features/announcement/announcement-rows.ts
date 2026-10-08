import type { AnnouncementOverview } from "../../server/domain/announcement-service"
import type {
  Announcement,
  AnnouncementInput,
} from "../../shared/announcement/announcement-schema"

/**
 * 面板的一行。
 *
 * `id` 为 null 表示这是一行尚未落库的新草稿：点「新建公告」只插入本地行，
 * 填完内容点保存才真正写入。写入服务端的公告必须通过 Schema（标题和正文非空），
 * 先建空记录再补内容会在第一步就被 422 拒绝，还会留下垃圾数据。
 * `saved` 记录服务端原值，用于判断是否有改动、退出编辑时回滚。
 */
export interface AnnouncementRow {
  clientId: string
  id: string | null
  draft: AnnouncementInput
  saved: AnnouncementInput | null
}

export function toInput(announcement: Announcement): AnnouncementInput {
  return {
    level: announcement.level,
    title: announcement.title,
    body: announcement.body,
    linkLabel: announcement.linkLabel,
    linkHref: announcement.linkHref,
    enabled: announcement.enabled,
    sortOrder: announcement.sortOrder,
    startsAt: announcement.startsAt,
    endsAt: announcement.endsAt,
  }
}

export function toRows(overview: AnnouncementOverview): AnnouncementRow[] {
  return overview.announcements.map((announcement) => {
    const input = toInput(announcement)
    return {
      clientId: announcement.id,
      id: announcement.id,
      draft: input,
      saved: input,
    }
  })
}

function isSameInput(a: AnnouncementInput, b: AnnouncementInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** 这一行是否带着未保存的改动。 */
export function isRowDirty(row: AnnouncementRow): boolean {
  return row.saved === null || !isSameInput(row.draft, row.saved)
}

/**
 * 把服务端带回的全量列表合并进本地行。
 *
 * 每次写操作都会 `router.refresh()`，服务端随之带回新的全量列表。
 * 直接整体覆盖会出问题：管理员正在编辑某条公告时，一次别处的写操作
 * 就会把这条正在编辑的草稿冲掉，而且不会有任何提示。
 *
 * 因此这里的规则是「服务端决定哪些行存在，本地决定每行的内容」：
 *
 * - 服务端没有、本地有的行：整条丢弃。列表以服务端为准，被别人删掉的行
 *   不能继续躺在面板里。
 * - 本地有未保存改动（`isRowDirty`）的行：保留本地 `draft`。
 *   这条同时覆盖新草稿（`id === null`）和已落库但改到一半的公告，
 *   只按 `id === null` 过滤会漏掉后者。
 * - 其余行：采用服务端值，这样别处的改动才能同步进来。
 */
export function mergeRows(
  overview: AnnouncementOverview,
  current: AnnouncementRow[],
): AnnouncementRow[] {
  const localById = new Map(current.map((row) => [row.clientId, row] as const))
  return toRows(overview).map((incoming) => {
    const local = localById.get(incoming.clientId)
    if (local && isRowDirty(local)) {
      return local
    }
    return incoming
  })
}
