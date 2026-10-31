import type { Metadata } from "next"
import { AnnouncementCarousel } from "../../features/announcement/announcement-carousel"
import { ResumeWorkspace } from "../../features/workspace/resume-workspace"
import { getTestResumePolicy, requireAuthContext } from "../../server/auth/auth-context"
import { AnnouncementService } from "../../server/domain/announcement-service"
import { ResumeService } from "../../server/domain/resume-service"
import { loadWorkspaceData } from "../../server/domain/workspace-data"
import { getAnnouncementRepository } from "../../server/repositories/announcement-repository-factory"
import { getResumeRepository } from "../../server/repositories/repository-factory"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "工作台",
  description: "管理与创建账号名下的简历。",
}

export default async function WorkspacePage() {
  const actor = await requireAuthContext()
  const resumeService = new ResumeService(getResumeRepository(), getTestResumePolicy())
  const announcementService = new AnnouncementService(getAnnouncementRepository())
  // 三条读取（简历、可见公告、管理员全量公告）同批发出：管理员那条以前是
  // Promise.all 之后的第四步，等于首屏多一次串行往返。
  const { resumes, announcements, managedAnnouncements } = await loadWorkspaceData(
    actor,
    {
      listResumes: (current) => resumeService.listResumes(current),
      listVisibleAnnouncements: () => announcementService.listVisibleAnnouncements(),
      listAllAnnouncements: (current) =>
        announcementService.listAllAnnouncements(current),
    },
  )

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
