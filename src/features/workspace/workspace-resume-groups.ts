import type { ResumeListItem } from "../../server/domain/resume-service"
import type { ResumeTemplateId } from "../../shared/resume-schema/resume-schema"
import { templateSchemes } from "../../shared/resume-template/template-schemes"

export type WorkspaceTemplateFilter = readonly ResumeTemplateId[]
export type WorkspacePublicationFilter = "all" | "published" | "draft"

export interface WorkspaceResumeFilters {
  query: string
  templateIds: WorkspaceTemplateFilter
  publicationStatus: WorkspacePublicationFilter
}

export interface WorkspaceResumeGroup {
  templateId: ResumeListItem["templateId"]
  templateName: string
  category: string
  resumes: ResumeListItem[]
}

export function filterWorkspaceResumes(
  resumes: ResumeListItem[],
  filters: WorkspaceResumeFilters,
): ResumeListItem[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("zh-CN")

  return resumes.filter((resume) => {
    if (
      normalizedQuery &&
      !resume.title.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
    ) {
      return false
    }
    if (
      filters.templateIds.length > 0 &&
      !filters.templateIds.includes(resume.templateId)
    ) {
      return false
    }
    if (filters.publicationStatus === "published" && !resume.published) {
      return false
    }
    if (filters.publicationStatus === "draft" && resume.published) {
      return false
    }
    return true
  })
}

export function groupWorkspaceResumes(
  resumes: ResumeListItem[],
): WorkspaceResumeGroup[] {
  const resumesByTemplate = new Map<ResumeListItem["templateId"], ResumeListItem[]>()

  for (const resume of resumes) {
    const groupedResumes = resumesByTemplate.get(resume.templateId)
    if (groupedResumes) {
      groupedResumes.push(resume)
    } else {
      resumesByTemplate.set(resume.templateId, [resume])
    }
  }

  return templateSchemes.flatMap((scheme) => {
    const groupedResumes = resumesByTemplate.get(scheme.id)
    return groupedResumes
      ? [
          {
            templateId: scheme.id,
            templateName: scheme.name,
            category: scheme.category,
            resumes: groupedResumes,
          },
        ]
      : []
  })
}
