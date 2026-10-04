import type { Metadata } from "next"
import { AnnouncementCarousel } from "../../features/announcement/announcement-carousel"
import { ResumeWorkspace } from "../../features/workspace/resume-workspace"
import { requireAuthContext } from "../../server/auth/auth-context"
import { AnnouncementService } from "../../server/domain/announcement-service"
import { ResumeService } from "../../server/domain/resume-service"
import { getAnnouncementRepository } from "../../server/repositories/announcement-repository-factory"
import { getResumeRepository } from "../../server/repositories/repository-factory"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "工作台",
  description: "管理与创建账号名下的简历。",
}

export default async function WorkspacePage() {
  const actor = await requireAuthContext()
  const announcementService = new AnnouncementService(getAnnouncementRepository())
  const [resumes, announcements] = await Promise.all([
    new ResumeService(getResumeRepository()).listResumes(actor),
    announcementService.listVisibleAnnouncements(),
  ])
  // 管理员额外拿到全量列表用于配置面板，包含已停用和不在时间窗口内的条目。
  // Preview 会话的 isAdmin 恒为 false，因此这里不需要额外判断 mode。
  const managedAnnouncements = actor.isAdmin
    ? await announcementService.listAllAnnouncements(actor)
    : null

  return (
    <>
      <AnnouncementCarousel announcements={announcements} />
      <ResumeWorkspace
        actor={actor}
        resumes={resumes}
        managedAnnouncements={managedAnnouncements}
      />
    </>
  )
}
