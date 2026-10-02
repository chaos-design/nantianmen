import { describe, expect, it } from "vitest"
import type { ResumeListItem } from "../../server/domain/resume-service"
import {
  filterWorkspaceResumes,
  groupWorkspaceResumes,
} from "./workspace-resume-groups"

function createResume(
  id: string,
  templateId: ResumeListItem["templateId"],
  published = false,
): ResumeListItem {
  return {
    id,
    ownerId: "owner-id",
    title: `Resume ${id}`,
    publicSlug: `slug-${id}`,
    templateId,
    version: 1,
    published,
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
  }
}

describe("groupWorkspaceResumes", () => {
  it("groups resumes by template and follows template library order", () => {
    const groups = groupWorkspaceResumes([
      createResume("creative", "creative-split"),
      createResume("modern-1", "modern-minimal"),
      createResume("modern-2", "modern-minimal"),
    ])

    expect(groups.map((group) => group.templateId)).toEqual([
      "modern-minimal",
      "creative-split",
    ])
    expect(groups[0]).toMatchObject({
      templateName: "现代极简",
      category: "通用",
    })
    expect(groups[0]?.resumes.map((resume) => resume.id)).toEqual([
      "modern-1",
      "modern-2",
    ])
  })

  it("filters by title, template and publication status", () => {
    const resumes = [
      createResume("产品经理", "creative-split", true),
      createResume("前端工程师", "tech-dark"),
      createResume("后端工程师", "tech-dark", true),
    ]

    expect(
      filterWorkspaceResumes(resumes, {
        query: "工程师",
        templateIds: ["tech-dark"],
        publicationStatus: "published",
      }).map((resume) => resume.id),
    ).toEqual(["后端工程师"])
    expect(
      filterWorkspaceResumes(resumes, {
        query: "  产品  ",
        templateIds: [],
        publicationStatus: "all",
      }).map((resume) => resume.id),
    ).toEqual(["产品经理"])
  })

  it("matches any selected template", () => {
    const resumes = [
      createResume("modern", "modern-minimal"),
      createResume("creative", "creative-split"),
      createResume("tech", "tech-dark"),
    ]

    expect(
      filterWorkspaceResumes(resumes, {
        query: "",
        templateIds: ["modern-minimal", "tech-dark"],
        publicationStatus: "all",
      }).map((resume) => resume.id),
    ).toEqual(["modern", "tech"])
  })
})
