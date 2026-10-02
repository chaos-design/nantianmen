import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import { maximumMemberResumeCount } from "../../shared/resume-schema/resume-policy"
import {
  createResumeDocument,
  createResumeItem,
  createResumeSection,
} from "../../shared/resume-schema/resume-schema"
import {
  InMemoryResumeRepository,
  VersionConflictError,
} from "../repositories/resume-repository"
import { type Actor, ResumeService } from "./resume-service"

const member: Actor = {
  userId: "00000000-0000-4000-8000-000000000001",
  isAdmin: false,
}
const otherMember: Actor = {
  userId: "00000000-0000-4000-8000-000000000002",
  isAdmin: false,
}
const admin: Actor = {
  userId: "00000000-0000-4000-8000-000000000003",
  isAdmin: true,
}
const preview: Actor = {
  userId: member.userId,
  isAdmin: false,
  mode: "preview",
}

function createService() {
  const repository = new InMemoryResumeRepository()
  return {
    repository,
    service: new ResumeService(repository),
  }
}

describe("ResumeService", () => {
  it("binds new resumes to the actor and enforces ownership", async () => {
    const { repository, service } = createService()
    const created = await service.createResume(member)
    const stored = await repository.findResumeById(created.resume.id)

    expect(created.resume.version).toBe(1)
    expect(stored).toMatchObject({
      ownerId: member.userId,
      editTokenHash: null,
    })
    await expect(
      service.getEditableResume(created.resume.id, member),
    ).resolves.toMatchObject({ id: created.resume.id })
    await expect(
      service.getEditableResume(created.resume.id, otherMember),
    ).rejects.toMatchObject({
      code: "RESUME_NOT_FOUND",
      status: 404,
    })
    await expect(
      service.getEditableResume(created.resume.id, admin),
    ).resolves.toMatchObject({ id: created.resume.id })
    await expect(service.getEditableResume(randomUUID(), member)).rejects.toMatchObject(
      {
        code: "RESUME_NOT_FOUND",
        status: 404,
      },
    )
  })

  it("lists only owned resumes unless the actor is an administrator", async () => {
    const { service } = createService()
    const memberResume = await service.createResume(member)
    const otherResume = await service.createResume(otherMember)

    await expect(service.listResumes(member)).resolves.toEqual([
      expect.objectContaining({
        id: memberResume.resume.id,
        ownerId: member.userId,
        templateId: "modern-minimal",
      }),
    ])
    await expect(service.listResumes(admin)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: memberResume.resume.id }),
        expect.objectContaining({ id: otherResume.resume.id }),
      ]),
    )
  })

  it("isolates the configured preview resume from regular accounts", async () => {
    const { service } = createService()
    const created = await service.createResume(member)
    const other = await service.createResume(otherMember)
    const previewActor: Actor = {
      ...preview,
      previewResumeId: created.resume.id,
    }
    const memberActor: Actor = {
      ...member,
      previewResumeId: created.resume.id,
    }
    const adminActor: Actor = {
      ...admin,
      previewResumeId: created.resume.id,
    }

    await expect(service.listResumes(previewActor)).resolves.toEqual([
      expect.objectContaining({ id: created.resume.id }),
    ])
    await expect(service.listResumes(memberActor)).resolves.toEqual([])
    await expect(service.listResumes(adminActor)).resolves.toEqual([
      expect.objectContaining({ id: other.resume.id }),
    ])
    await expect(
      service.getEditableResume(created.resume.id, previewActor),
    ).resolves.toMatchObject({ id: created.resume.id })
    await expect(
      service.getEditableResume(created.resume.id, memberActor),
    ).rejects.toMatchObject({
      code: "RESUME_NOT_FOUND",
      status: 404,
    })
    await expect(
      service.getEditableResume(created.resume.id, adminActor),
    ).rejects.toMatchObject({
      code: "RESUME_NOT_FOUND",
      status: 404,
    })
    await expect(
      service.getEditableResume(other.resume.id, adminActor),
    ).resolves.toMatchObject({ id: other.resume.id })
    await expect(
      service.getEditableResume(other.resume.id, previewActor),
    ).rejects.toMatchObject({
      code: "RESUME_NOT_FOUND",
      status: 404,
    })
    await expect(
      service.saveDraft({
        resumeId: created.resume.id,
        actor: previewActor,
        expectedVersion: 1,
        document: created.resume.document,
      }),
    ).rejects.toMatchObject({
      code: "PREVIEW_READ_ONLY",
      status: 403,
    })
    await expect(
      service.publishResume(created.resume.id, previewActor),
    ).rejects.toMatchObject({
      code: "PREVIEW_READ_ONLY",
      status: 403,
    })
    await expect(
      service.deleteResume(created.resume.id, previewActor),
    ).rejects.toMatchObject({
      code: "PREVIEW_READ_ONLY",
      status: 403,
    })
  })

  it("creates from a selected template and rejects unknown templates", async () => {
    const { service } = createService()

    const created = await service.createResume(member, undefined, "creative-split")

    expect(created.resume.document.template.id).toBe("creative-split")
    expect(created.resume.document.style.pageBackground).toBe("#fbfaf7")
    await expect(
      service.createResume(member, undefined, "missing-template"),
    ).rejects.toMatchObject({
      code: "INVALID_TEMPLATE",
      status: 422,
    })
  })

  it("limits regular accounts to 15 resumes and exempts administrators", async () => {
    const { service } = createService()

    for (let index = 0; index < maximumMemberResumeCount; index += 1) {
      await service.createResume(member)
    }

    await expect(service.createResume(member)).rejects.toMatchObject({
      code: "RESUME_LIMIT_REACHED",
      status: 409,
      details: {
        limit: maximumMemberResumeCount,
        current: maximumMemberResumeCount,
      },
    })

    for (let index = 0; index <= maximumMemberResumeCount; index += 1) {
      await expect(service.createResume(admin)).resolves.toHaveProperty("resume.id")
    }
  })

  it("deletes resumes through the same ownership rules", async () => {
    const { repository, service } = createService()
    const created = await service.createResume(member)

    await expect(
      service.deleteResume(created.resume.id, otherMember),
    ).rejects.toMatchObject({
      code: "RESUME_NOT_FOUND",
      status: 404,
    })
    await service.deleteResume(created.resume.id, member)

    await expect(repository.findResumeById(created.resume.id)).resolves.toBeNull()
  })

  it("deletes an authorized batch without partially deleting inaccessible resumes", async () => {
    const { repository, service } = createService()
    const first = await service.createResume(member)
    const second = await service.createResume(member, undefined, "creative-split")
    const inaccessible = await service.createResume(otherMember)

    await expect(
      service.deleteResumes([first.resume.id, inaccessible.resume.id], member),
    ).rejects.toMatchObject({
      code: "RESUME_NOT_FOUND",
      status: 404,
    })
    await expect(repository.findResumeById(first.resume.id)).resolves.not.toBeNull()

    await expect(
      service.deleteResumes([first.resume.id, second.resume.id], member),
    ).resolves.toBe(2)
    await expect(repository.findResumeById(first.resume.id)).resolves.toBeNull()
    await expect(repository.findResumeById(second.resume.id)).resolves.toBeNull()
    await expect(
      repository.findResumeById(inaccessible.resume.id),
    ).resolves.not.toBeNull()
  })

  it("validates batch deletion input and keeps Preview read-only", async () => {
    const { service } = createService()
    const created = await service.createResume(member)
    const previewActor: Actor = {
      ...preview,
      previewResumeId: created.resume.id,
    }

    await expect(service.deleteResumes([], member)).rejects.toMatchObject({
      code: "INVALID_RESUME_SELECTION",
      status: 422,
    })
    await expect(
      service.deleteResumes([created.resume.id], previewActor),
    ).rejects.toMatchObject({
      code: "PREVIEW_READ_ONLY",
      status: 403,
    })
  })

  it("validates imported documents and saves with optimistic concurrency", async () => {
    const { service } = createService()
    const created = await service.createResume(member)
    const updatedDocument = {
      ...created.resume.document,
      metadata: {
        ...created.resume.document.metadata,
        title: "新标题",
      },
    }

    const updated = await service.saveDraft({
      resumeId: created.resume.id,
      actor: member,
      expectedVersion: 1,
      document: updatedDocument,
    })

    expect(updated.title).toBe("新标题")
    expect(updated.version).toBe(2)
    await expect(
      service.saveDraft({
        resumeId: created.resume.id,
        actor: member,
        expectedVersion: 1,
        document: updatedDocument,
      }),
    ).rejects.toBeInstanceOf(VersionConflictError)
  })

  it("keeps published snapshots isolated from later draft edits", async () => {
    const { service } = createService()
    const created = await service.createResume(member)
    const firstDocument = {
      ...created.resume.document,
      profile: { ...created.resume.document.profile, name: "已发布姓名" },
    }
    await service.saveDraft({
      resumeId: created.resume.id,
      actor: member,
      expectedVersion: 1,
      document: firstDocument,
    })
    const publication = await service.publishResume(created.resume.id, member)

    await service.saveDraft({
      resumeId: created.resume.id,
      actor: member,
      expectedVersion: 2,
      document: {
        ...firstDocument,
        profile: { ...firstDocument.profile, name: "仅草稿姓名" },
      },
    })
    const publicResume = await service.getPublicResume(publication.resume.publicSlug)

    expect(publicResume.publication.publicationVersion).toBe(1)
    expect(publicResume.publication.publishedDocument.profile.name).toBe("已发布姓名")
  })

  it("rejects invalid, oversized, and missing public documents", async () => {
    const { service } = createService()
    await expect(
      service.createResume(member, { schemaVersion: "0.0.0" }),
    ).rejects.toMatchObject({
      code: "INVALID_DOCUMENT",
      status: 422,
    })

    const base = createResumeDocument()
    const oversizedItem = {
      ...createResumeItem("custom"),
      highlights: Array.from({ length: 20 }, () => "x".repeat(500)),
    }
    const oversizedSection = {
      ...createResumeSection("custom"),
      items: Array.from({ length: 30 }, (_, index) => ({
        ...oversizedItem,
        id: `item-${index}`,
      })),
    }
    await expect(
      service.createResume(member, {
        ...base,
        sections: Array.from({ length: 20 }, (_, index) => ({
          ...oversizedSection,
          id: `section-${index}`,
        })),
      }),
    ).rejects.toMatchObject({
      code: "DOCUMENT_TOO_LARGE",
      status: 413,
    })

    await expect(service.getPublicResume("not-published")).rejects.toMatchObject({
      code: "PUBLIC_RESUME_NOT_FOUND",
      status: 404,
    })
  })
})
