import type { ResumeItem } from "./resume-schema"

export function formatResumePeriod(
  item: Pick<ResumeItem, "startDate" | "endDate" | "current">,
  separator = " - ",
): string {
  const startDate = item.startDate.trim()
  const endDate = item.current ? "至今" : item.endDate.trim()
  return [startDate, endDate].filter(Boolean).join(separator)
}
