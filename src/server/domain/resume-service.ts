import { randomUUID } from "node:crypto"
import { ZodError } from "zod"
import { maximumMemberResumeCount } from "../../shared/resume-schema/resume-policy"
import {
  createResumeDocument,
  parseResumeDocument,
  type ResumeDocument,
  type ResumeTemplateId,
  templateIds,
} from "../../shared/resume-schema/resume-schema"
import type {
  PublicResumeRecord,
  ResumeRecord,
  ResumeRepository,
  ResumeSummary,
} from "../repositories/resume-repository"

const maximumDocumentBytes = 256 * 1024

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = "DomainError"
  }
}

export interface EditableResume {
  id: string
  title: string
  publicSlug: string
  document: ResumeDocument
  version: number
  published: boolean
  updatedAt: string
}

export interface Actor {
  userId: string
  isAdmin: boolean
  mode?: "user" | "preview"
  previewResumeId?: string
}

export interface ResumeListItem {
  id: string
  ownerId: string | null
  title: string
  publicSlug: string
  templateId: ResumeSummary["templateId"]
  version: number
  published: boolean
  createdAt: string
  updatedAt: string
}

function toEditableResume(record: ResumeRecord): EditableResume {
  return {
    id: record.id,
    title: record.title,
    publicSlug: record.publicSlug,
    document: record.draftDocument,
    version: record.draftVersion,
    published: Boolean(record.latestPublicationId),
    updatedAt: record.updatedAt,
  }
}

function toResumeListItem(summary: ResumeSummary | ResumeRecord): ResumeListItem {
  return {
    id: summary.id,
    ownerId: summary.ownerId,
    title: summary.title,
    publicSlug: summary.publicSlug,
    templateId:
      "templateId" in summary ? summary.templateId : summary.draftDocument.template.id,
    version: summary.draftVersion,
    published: Boolean(summary.latestPublicationId),
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  }
}

function validateDocument(input: unknown): ResumeDocument {
  const serialized = JSON.stringify(input)
  if (Buffer.byteLength(serialized, "utf8") > maximumDocumentBytes) {
    throw new DomainError("DOCUMENT_TOO_LARGE", "简历文档不能超过 256 KB", 413)
  }

  try {
    return parseResumeDocument(input)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DomainError(
        "INVALID_DOCUMENT",
        "简历 JSON 不符合 Schema",
        422,
        error.issues,
      )
    }
    throw error
  }
}

function validateTemplateId(input: unknown): ResumeTemplateId | undefined {
  if (input === undefined) {
    return undefined
  }
  if (typeof input !== "string" || !templateIds.includes(input as ResumeTemplateId)) {
    throw new DomainError("INVALID_TEMPLATE", "简历模板不存在", 422)
  }
  return input as ResumeTemplateId
}

export async function authorizeResume(
  repository: ResumeRepository,
  resumeId: string,
  actor: Actor,
): Promise<ResumeRecord> {
  const record = await repository.findResumeById(resumeId)
  if (!record) {
    throw new DomainError("RESUME_NOT_FOUND", "简历不存在", 404)
  }
  if (actor.mode === "preview") {
    if (record.id !== actor.previewResumeId) {
      throw new DomainError("RESUME_NOT_FOUND", "简历不存在", 404)
    }
    return record
  }
  if (record.id === actor.previewResumeId) {
    throw new DomainError("RESUME_NOT_FOUND", "简历不存在", 404)
  }
  if (!actor.isAdmin && record.ownerId !== actor.userId) {
    throw new DomainError("RESUME_NOT_FOUND", "简历不存在", 404)
  }
  return record
}

export function assertWritableActor(actor: Actor): void {
  if (actor.mode === "preview") {
    throw new DomainError(
      "PREVIEW_READ_ONLY",
      "Preview 模式只能查看，不能修改简历",
      403,
    )
  }
}

export class ResumeService {
  constructor(private readonly repository: ResumeRepository) {}

  async createResume(
    actor: Actor,
    initialDocument?: unknown,
    templateId?: unknown,
  ): Promise<{ resume: EditableResume }> {
    assertWritableActor(actor)
    if (!actor.isAdmin) {
      const ownedResumes = await this.repository.listResumesByOwner(actor.userId)
      const ownedResumeCount = ownedResumes.filter(
        (resume) => resume.id !== actor.previewResumeId,
      ).length
      if (ownedResumeCount >= maximumMemberResumeCount) {
        throw new DomainError(
          "RESUME_LIMIT_REACHED",
          `普通账号最多创建 ${maximumMemberResumeCount} 份简历`,
          409,
          {
            limit: maximumMemberResumeCount,
            current: ownedResumeCount,
          },
        )
      }
    }
    const validatedTemplateId = validateTemplateId(templateId)
    const document = validateDocument(
      initialDocument ?? createResumeDocument(validatedTemplateId),
    )
    const record = await this.repository.createResume({
      id: randomUUID(),
      ownerId: actor.userId,
      title: document.metadata.title,
      publicSlug: randomUUID().replaceAll("-", ""),
      document,
    })
    return {
      resume: toEditableResume(record),
    }
  }

  async listResumes(actor: Actor): Promise<ResumeListItem[]> {
    if (actor.mode === "preview") {
      const previewResume = actor.previewResumeId
        ? await this.repository.findResumeById(actor.previewResumeId)
        : null
      return previewResume ? [toResumeListItem(previewResume)] : []
    }

    const summaries = actor.isAdmin
      ? await this.repository.listAllResumes()
      : await this.repository.listResumesByOwner(actor.userId)
    return summaries
      .filter((summary) => summary.id !== actor.previewResumeId)
      .map(toResumeListItem)
  }

  async getEditableResume(resumeId: string, actor: Actor): Promise<EditableResume> {
    const record = await authorizeResume(this.repository, resumeId, actor)
    return toEditableResume(record)
  }

  async saveDraft(input: {
    resumeId: string
    actor: Actor
    expectedVersion: number
    document: unknown
  }): Promise<EditableResume> {
    await authorizeResume(this.repository, input.resumeId, input.actor)
    assertWritableActor(input.actor)
    const document = validateDocument(input.document)
    const record = await this.repository.updateDraft({
      resumeId: input.resumeId,
      expectedVersion: input.expectedVersion,
      title: document.metadata.title,
      document,
    })
    return toEditableResume(record)
  }

  async publishResume(resumeId: string, actor: Actor): Promise<PublicResumeRecord> {
    const record = await authorizeResume(this.repository, resumeId, actor)
    assertWritableActor(actor)
    validateDocument(record.draftDocument)
    return this.repository.publishResume(resumeId)
  }

  async deleteResume(resumeId: string, actor: Actor): Promise<void> {
    await authorizeResume(this.repository, resumeId, actor)
    assertWritableActor(actor)
    try {
      await this.repository.deleteResume(resumeId)
    } catch {
      throw new DomainError("RESUME_DELETE_FAILED", "删除简历失败", 503)
    }
  }

  async deleteResumes(resumeIds: unknown, actor: Actor): Promise<number> {
    assertWritableActor(actor)
    if (
      !Array.isArray(resumeIds) ||
      resumeIds.length === 0 ||
      resumeIds.length > 500 ||
      resumeIds.some((resumeId) => typeof resumeId !== "string" || !resumeId.trim())
    ) {
      throw new DomainError("INVALID_RESUME_SELECTION", "请选择 1 至 500 份简历", 422)
    }

    const normalizedResumeIds = [
      ...new Set(resumeIds.map((resumeId) => resumeId.trim())),
    ]
    const accessibleResumeIds = new Set(
      (await this.listResumes(actor)).map((resume) => resume.id),
    )
    if (normalizedResumeIds.some((resumeId) => !accessibleResumeIds.has(resumeId))) {
      throw new DomainError("RESUME_NOT_FOUND", "简历不存在", 404)
    }

    try {
      await this.repository.deleteResumes(normalizedResumeIds)
      return normalizedResumeIds.length
    } catch {
      throw new DomainError("RESUME_DELETE_FAILED", "批量删除简历失败", 503)
    }
  }

  async getPublicResume(publicSlug: string): Promise<PublicResumeRecord> {
    const result = await this.repository.findPublicResume(publicSlug)
    if (!result) {
      throw new DomainError("PUBLIC_RESUME_NOT_FOUND", "该简历不存在或尚未发布", 404)
    }
    validateDocument(result.publication.publishedDocument)
    return result
  }
}
