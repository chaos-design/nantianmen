import type { Announcement } from "../../shared/announcement/announcement-schema"
import type { AnnouncementOverview } from "./announcement-service"
import type { Actor, ResumeListItem } from "./resume-service"

/**
 * 工作台首屏要用的三份数据。
 *
 * 抽成独立函数不是为了分层，而是为了让「这三条读取是并发发出的」变成可测事实：
 * 之前管理员走的 `listAllAnnouncements` 是 `await` 在 `Promise.all` 之后的第四步，
 * 于是管理员的首屏永远比普通用户多一次串行往返。这类退化在本地 file 后端下完全
 * 看不出来（读文件没有往返），只有在真实 Supabase 上才表现为 TTFB 变长。
 */
export interface WorkspaceDataSources {
  listResumes(actor: Actor): Promise<ResumeListItem[]>
  listVisibleAnnouncements(): Promise<Announcement[]>
  listAllAnnouncements(actor: Actor): Promise<AnnouncementOverview>
}

export interface WorkspaceData {
  resumes: ResumeListItem[]
  announcements: Announcement[]
  managedAnnouncements: AnnouncementOverview | null
}

export async function loadWorkspaceData(
  actor: Actor,
  sources: WorkspaceDataSources,
): Promise<WorkspaceData> {
  const [resumes, announcements, managedAnnouncements] = await Promise.all([
    sources.listResumes(actor),
    sources.listVisibleAnnouncements(),
    // 非管理员没有「管理面板」这回事：用条件表达式当场给出 null，而不是先 await
    // 前两条再判断，否则管理员的路径又会多出一次串行等待。
    actor.isAdmin ? sources.listAllAnnouncements(actor) : Promise.resolve(null),
  ])
  return { resumes, announcements, managedAnnouncements }
}
