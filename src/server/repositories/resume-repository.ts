import { randomUUID } from "node:crypto"
import type {
  ResumeDocument,
  ResumeTemplateId,
} from "../../shared/resume-schema/resume-schema"

export interface ResumeRecord {
  id: string
  ownerId: string | null
  title: string
  publicSlug: string
  editTokenHash: string | null
  draftDocument: ResumeDocument
  draftSchemaVersion: string
  draftVersion: number
  latestPublicationId: string | null
  createdAt: string
  updatedAt: string
}

export interface PublicationRecord {
  id: string
  resumeId: string
  publicationVersion: number
  publishedDocument: ResumeDocument
  schemaVersion: string
  templateId: string
  publishedAt: string
}

export interface PublicResumeRecord {
  resume: Pick<ResumeRecord, "id" | "title" | "publicSlug">
  publication: PublicationRecord
}

export interface AiGenerationRecord {
  id: string
  resumeId: string
  taskType: string
  targetSectionId: string | null
  inputSummary: Record<string, unknown>
  output: unknown
  provider: string
  latencyMs: number
  createdAt: string
}

export interface ResumeAssetRecord {
  id: string
  resumeId: string
  storagePath: string
  assetType: "image"
  mimeType: "image/png" | "image/jpeg" | "image/webp"
  byteSize: number
  originalName: string
  width: number
  height: number
  createdAt: string
}

export interface CreateResumeInput {
  id: string
  ownerId: string
  title: string
  publicSlug: string
  document: ResumeDocument
}

export interface ResumeSummary {
  id: string
  ownerId: string | null
  title: string
  publicSlug: string
  templateId: ResumeTemplateId
  draftVersion: number
  latestPublicationId: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateDraftInput {
  resumeId: string
  expectedVersion: number
  title: string
  document: ResumeDocument
}

export interface ResumeRepository {
  createResume(input: CreateResumeInput): Promise<ResumeRecord>
  findResumeById(resumeId: string): Promise<ResumeRecord | null>
  listResumesByOwner(ownerId: string): Promise<ResumeSummary[]>
  listAllResumes(): Promise<ResumeSummary[]>
  updateDraft(input: UpdateDraftInput): Promise<ResumeRecord>
  removeAssetReferencesFromDraft(resumeId: string, assetId: string): Promise<void>
  deleteResume(resumeId: string): Promise<void>
  deleteResumes(resumeIds: string[]): Promise<void>
  publishResume(resumeId: string): Promise<PublicResumeRecord>
  findPublicResume(publicSlug: string): Promise<PublicResumeRecord | null>
  recordAiGeneration(record: AiGenerationRecord): Promise<void>
  createAsset(record: ResumeAssetRecord): Promise<ResumeAssetRecord>
  findAssetById(assetId: string): Promise<ResumeAssetRecord | null>
  listAssetsByResumeId(resumeId: string): Promise<ResumeAssetRecord[]>
  isAssetReferencedByPublication(resumeId: string, assetId: string): Promise<boolean>
  deleteAsset(assetId: string): Promise<void>
}

export function removeAssetReferencesFromDocument(
  document: ResumeDocument,
  assetId: string,
): ResumeDocument {
  return {
    ...document,
    resources: {
      ...document.resources,
      assets: document.resources.assets.filter((asset) => asset.id !== assetId),
      placements: document.resources.placements.filter(
        (placement) => placement.assetId !== assetId,
      ),
    },
  }
}

export class VersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super("草稿已在其他位置更新")
    this.name = "VersionConflictError"
  }
}

interface MemoryState {
  resumes: ResumeRecord[]
  publications: PublicationRecord[]
  aiGenerations: AiGenerationRecord[]
  assets: ResumeAssetRecord[]
}

export class InMemoryResumeRepository implements ResumeRepository {
  private readonly state: MemoryState

  constructor(seed?: Partial<MemoryState>) {
    this.state = {
      resumes: structuredClone(seed?.resumes ?? []),
      publications: structuredClone(seed?.publications ?? []),
      aiGenerations: structuredClone(seed?.aiGenerations ?? []),
      assets: structuredClone(seed?.assets ?? []),
    }
  }

  async createResume(input: CreateResumeInput): Promise<ResumeRecord> {
    const now = new Date().toISOString()
    const resume: ResumeRecord = {
      id: input.id,
      ownerId: input.ownerId,
      title: input.title,
      publicSlug: input.publicSlug,
      editTokenHash: null,
      draftDocument: structuredClone(input.document),
      draftSchemaVersion: input.document.schemaVersion,
      draftVersion: 1,
      latestPublicationId: null,
      createdAt: now,
      updatedAt: now,
    }
    this.state.resumes.push(resume)
    return structuredClone(resume)
  }

  async findResumeById(resumeId: string): Promise<ResumeRecord | null> {
    const resume = this.state.resumes.find((entry) => entry.id === resumeId)
    return resume ? structuredClone(resume) : null
  }

  async listResumesByOwner(ownerId: string): Promise<ResumeSummary[]> {
    return this.listSummaries((resume) => resume.ownerId === ownerId)
  }

  async listAllResumes(): Promise<ResumeSummary[]> {
    return this.listSummaries(() => true)
  }

  private listSummaries(predicate: (resume: ResumeRecord) => boolean): ResumeSummary[] {
    return structuredClone(
      this.state.resumes
        .filter(predicate)
        .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(
          ({
            id,
            ownerId,
            title,
            publicSlug,
            draftDocument,
            draftVersion,
            latestPublicationId,
            createdAt,
            updatedAt,
          }) => ({
            id,
            ownerId,
            title,
            publicSlug,
            templateId: draftDocument.template.id,
            draftVersion,
            latestPublicationId,
            createdAt,
            updatedAt,
          }),
        ),
    )
  }

  async updateDraft(input: UpdateDraftInput): Promise<ResumeRecord> {
    const index = this.state.resumes.findIndex((entry) => entry.id === input.resumeId)
    const resume = this.state.resumes[index]
    if (!resume) {
      throw new Error("RESUME_NOT_FOUND")
    }
    if (resume.draftVersion !== input.expectedVersion) {
      throw new VersionConflictError(resume.draftVersion)
    }

    const updated: ResumeRecord = {
      ...resume,
      title: input.title,
      draftDocument: structuredClone(input.document),
      draftSchemaVersion: input.document.schemaVersion,
      draftVersion: resume.draftVersion + 1,
      updatedAt: new Date().toISOString(),
    }
    this.state.resumes[index] = updated
    return structuredClone(updated)
  }

  async removeAssetReferencesFromDraft(
    resumeId: string,
    assetId: string,
  ): Promise<void> {
    const index = this.state.resumes.findIndex((entry) => entry.id === resumeId)
    const resume = this.state.resumes[index]
    if (!resume) {
      throw new Error("RESUME_NOT_FOUND")
    }

    this.state.resumes[index] = {
      ...resume,
      draftDocument: removeAssetReferencesFromDocument(resume.draftDocument, assetId),
      draftSchemaVersion: resume.draftDocument.schemaVersion,
      updatedAt: new Date().toISOString(),
    }
  }

  async deleteResume(resumeId: string): Promise<void> {
    await this.deleteResumes([resumeId])
  }

  async deleteResumes(resumeIds: string[]): Promise<void> {
    const resumeIdSet = new Set(resumeIds)
    this.state.aiGenerations = this.state.aiGenerations.filter(
      (entry) => !resumeIdSet.has(entry.resumeId),
    )
    this.state.assets = this.state.assets.filter(
      (entry) => !resumeIdSet.has(entry.resumeId),
    )
    this.state.publications = this.state.publications.filter(
      (entry) => !resumeIdSet.has(entry.resumeId),
    )
    this.state.resumes = this.state.resumes.filter(
      (entry) => !resumeIdSet.has(entry.id),
    )
  }

  async publishResume(resumeId: string): Promise<PublicResumeRecord> {
    const index = this.state.resumes.findIndex((entry) => entry.id === resumeId)
    const resume = this.state.resumes[index]
    if (!resume) {
      throw new Error("RESUME_NOT_FOUND")
    }

    const version =
      this.state.publications.filter((publication) => publication.resumeId === resumeId)
        .length + 1
    const publication: PublicationRecord = {
      id: randomUUID(),
      resumeId,
      publicationVersion: version,
      publishedDocument: structuredClone(resume.draftDocument),
      schemaVersion: resume.draftSchemaVersion,
      templateId: resume.draftDocument.template.id,
      publishedAt: new Date().toISOString(),
    }
    this.state.publications.push(publication)
    this.state.resumes[index] = {
      ...resume,
      latestPublicationId: publication.id,
      updatedAt: new Date().toISOString(),
    }

    return {
      resume: {
        id: resume.id,
        title: resume.title,
        publicSlug: resume.publicSlug,
      },
      publication: structuredClone(publication),
    }
  }

  async findPublicResume(publicSlug: string): Promise<PublicResumeRecord | null> {
    const resume = this.state.resumes.find((entry) => entry.publicSlug === publicSlug)
    if (!resume?.latestPublicationId) {
      return null
    }
    const publication = this.state.publications.find(
      (entry) => entry.id === resume.latestPublicationId,
    )
    if (!publication) {
      return null
    }
    return {
      resume: {
        id: resume.id,
        title: resume.title,
        publicSlug: resume.publicSlug,
      },
      publication: structuredClone(publication),
    }
  }

  async recordAiGeneration(record: AiGenerationRecord): Promise<void> {
    this.state.aiGenerations.push(structuredClone(record))
  }

  async createAsset(record: ResumeAssetRecord): Promise<ResumeAssetRecord> {
    if (
      this.state.assets.some(
        (asset) => asset.id === record.id || asset.storagePath === record.storagePath,
      )
    ) {
      throw new Error("ASSET_ALREADY_EXISTS")
    }
    this.state.assets.push(structuredClone(record))
    return structuredClone(record)
  }

  async findAssetById(assetId: string): Promise<ResumeAssetRecord | null> {
    const asset = this.state.assets.find((entry) => entry.id === assetId)
    return asset ? structuredClone(asset) : null
  }

  async listAssetsByResumeId(resumeId: string): Promise<ResumeAssetRecord[]> {
    return structuredClone(
      this.state.assets.filter((entry) => entry.resumeId === resumeId),
    )
  }

  async isAssetReferencedByPublication(
    resumeId: string,
    assetId: string,
  ): Promise<boolean> {
    return this.state.publications.some(
      (publication) =>
        publication.resumeId === resumeId &&
        publication.publishedDocument.resources.placements.some(
          (placement) => placement.assetId === assetId,
        ),
    )
  }

  async deleteAsset(assetId: string): Promise<void> {
    this.state.assets = this.state.assets.filter((asset) => asset.id !== assetId)
  }
}
