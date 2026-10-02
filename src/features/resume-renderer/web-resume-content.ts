import { formatResumePeriod } from "../../shared/resume-schema/resume-period"
import type {
  ResumeDocument,
  ResumeItem,
  ResumeSection,
} from "../../shared/resume-schema/resume-schema"

const webNameFitSafetyRatio = 0.99

const webItemPlaceholderTitles: Record<ResumeSection["type"], string> = {
  workExperience: "职位名称",
  education: "专业名称",
  project: "项目名称",
  skills: "技能类别",
  certification: "证书名称",
  custom: "条目标题",
}

export function calculateFittedNameFontSize(
  preferredFontSize: number,
  availableWidth: number,
  contentWidth: number,
): number | null {
  if (
    !Number.isFinite(preferredFontSize) ||
    !Number.isFinite(availableWidth) ||
    !Number.isFinite(contentWidth) ||
    preferredFontSize <= 0 ||
    availableWidth <= 0 ||
    contentWidth <= 0
  ) {
    return null
  }
  if (contentWidth <= availableWidth) {
    return preferredFontSize
  }
  return preferredFontSize * (availableWidth / contentWidth) * webNameFitSafetyRatio
}

export function hasWebResumeItemContent(
  item: ResumeItem,
  sectionType: ResumeSection["type"],
): boolean {
  const title = item.title.trim()
  return Boolean(
    (title && title !== webItemPlaceholderTitles[sectionType]) ||
      item.subtitle.trim() ||
      item.description.trim() ||
      item.location.trim() ||
      item.startDate.trim() ||
      item.endDate.trim() ||
      item.current ||
      item.url.trim() ||
      item.highlights.some((highlight) => highlight.trim()) ||
      item.skills.some((skill) => skill.trim()),
  )
}

export function getWebResumeSections(document: ResumeDocument): ResumeSection[] {
  return document.sections.filter(
    (section) =>
      section.visible &&
      section.items.some((item) => hasWebResumeItemContent(item, section.type)),
  )
}

export function normalizeExternalUrl(value: string): string | null {
  const candidate = value.trim()
  if (!candidate) {
    return null
  }
  try {
    const url = new URL(
      candidate.startsWith("http://") || candidate.startsWith("https://")
        ? candidate
        : `https://${candidate}`,
    )
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

export function formatWebResumePeriod(item: ResumeItem): string {
  return formatResumePeriod(item, " — ")
}
