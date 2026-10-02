import type { Metadata } from "next"
import { ResumeWorkspace } from "../../features/workspace/resume-workspace"
import { requireAuthContext } from "../../server/auth/auth-context"
import { ResumeService } from "../../server/domain/resume-service"
import { getResumeRepository } from "../../server/repositories/repository-factory"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "工作台",
  description: "管理与创建账号名下的简历。",
}

export default async function WorkspacePage() {
  const actor = await requireAuthContext()
  const service = new ResumeService(getResumeRepository())
  const resumes = await service.listResumes(actor)

  return <ResumeWorkspace actor={actor} resumes={resumes} />
}
