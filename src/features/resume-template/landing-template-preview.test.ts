import { describe, expect, it } from "vitest"
import {
  createResumeDocument,
  parseResumeDocument,
} from "../../shared/resume-schema/resume-schema"
import { templateSchemes } from "../../shared/resume-template/template-schemes"
import {
  getPaginatedSourceItemIds,
  paginateResumeDocument,
} from "../resume-renderer/resume-pagination"
import { createLandingTemplatePreviewDocument } from "./landing-template-preview"

const expectedSectionTypes = [
  "workExperience",
  "project",
  "education",
  "skills",
  "certification",
] as const

describe("landing template preview", () => {
  it("renders every template with a complete one-page showcase resume", () => {
    for (const scheme of templateSchemes) {
      const document = createLandingTemplatePreviewDocument(scheme.id)
      const sourceDocument = createResumeDocument(scheme.id)
      const pages = paginateResumeDocument(document)
      const sourceItemIds = document.sections.flatMap((section) =>
        section.items.map((item) => item.id),
      )

      expect(() => parseResumeDocument(document), scheme.id).not.toThrow()
      expect(document.template, scheme.id).toEqual(sourceDocument.template)
      expect(document.style, scheme.id).toEqual(sourceDocument.style)
      expect(document.profile.name, scheme.id).toBe("Rain120")
      expect(
        document.sections.map((section) => section.type),
        scheme.id,
      ).toEqual(expectedSectionTypes)
      expect(pages, scheme.id).toHaveLength(1)
      expect(pages[0]?.showProfile, scheme.id).toBe(true)
      expect(getPaginatedSourceItemIds(pages).toSorted(), scheme.id).toEqual(
        sourceItemIds.toSorted(),
      )
    }
  })
})
