import type {
  ResumeDocument,
  ResumeTemplateId,
} from "../../shared/resume-schema/resume-schema"
import { getTemplateScheme } from "../../shared/resume-template/template-schemes"

export function applyTemplateScheme(
  document: ResumeDocument,
  id: ResumeTemplateId,
): ResumeDocument {
  const scheme = getTemplateScheme(id)
  return {
    ...document,
    template: {
      id: scheme.id as ResumeTemplateId,
      theme: { ...scheme.defaults.theme },
    },
    style: { ...scheme.defaults.style },
  }
}
