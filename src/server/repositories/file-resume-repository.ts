import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseResumeDocument } from "../../shared/resume-schema/resume-schema"
import type {
  AiGenerationRecord,
  CreateResumeInput,
  PublicationRecord,
  PublicResumeRecord,
  ResumeAssetRecord,
  ResumeRecord,
  ResumeRepository,
  ResumeSummary,
  UpdateDraftInput,
} from "./resume-repository"
import {
  removeAssetReferencesFromDocument,
  VersionConflictError,
} from "./resume-repository"

interface FileDatabase {
  resumes: ResumeRecord[]
  publications: PublicationRecord[]
  aiGenerations: AiGenerationRecord[]
  assets: ResumeAssetRecord[]
}

const emptyDatabase = (): FileDatabase => ({
  resumes: [],
  publications: [],
  aiGenerations: [],
  assets: [],
})

export class FileResumeRepository implements ResumeRepository {
  private readonly databasePath: string
  private writeLock: Promise<void> = Promise.resolve()

  constructor(databasePath = path.join(process.cwd(), ".data", "resumes.json")) {
    this.databasePath = databasePath
  }

  private async readDatabase(): Promise<FileDatabase> {
    try {
      const contents = await readFile(this.databasePath, "utf8")
      const database = JSON.parse(contents) as FileDatabase
      return {
        ...database,
        assets: database.assets ?? [],
        resumes: database.resumes.map((resume) => ({
          ...resume,
          ownerId: resume.ownerId ?? null,
          editTokenHash: resume.editTokenHash ?? null,
          draftDocument: parseResumeDocument(resume.draftDocument),
        })),
        publications: database.publications.map((publication) => ({
          ...publication,
          publishedDocument: parseResumeDocument(publication.publishedDocument),
        })),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyDatabase()
      }
      throw error
    }
  }

  private async writeDatabase(database: FileDatabase): Promise<void> {
    await mkdir(path.dirname(this.databasePath), { recursive: true })
    const temporaryPath = `${this.databasePath}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, JSON.stringify(database, null, 2), "utf8")
    await rename(temporaryPath, this.databasePath)
  }

  private async withWriteLock<T>(
    operation: (database: FileDatabase) => Promise<T> | T,
  ): Promise<T> {
    const previousLock = this.writeLock
    let releaseLock: () => void = () => undefined
    this.writeLock = new Promise<void>((resolve) => {
      releaseLock = resolve
    })

    await previousLock
    try {
      const database = await this.readDatabase()
      const result = await operation(database)
      await this.writeDatabase(database)
      return result
    } finally {
      releaseLock()
    }
  }

  async createResume(input: CreateResumeInput): Promise<ResumeRecord> {
    return this.withWriteLock((database) => {
      if (
        database.resumes.some(
          (resume) => resume.id === input.id || resume.publicSlug === input.publicSlug,
        )
      ) {
        throw new Error("RESUME_ALREADY_EXISTS")
      }

      const now = new Date().toISOString()
      const resume: ResumeRecord = {
        id: input.id,
        ownerId: input.ownerId,
        title: input.title,
        publicSlug: input.publicSlug,
        editTokenHash: null,
        draftDocument: input.document,
        draftSchemaVersion: input.document.schemaVersion,
        draftVersion: 1,
        latestPublicationId: null,
        createdAt: now,
        updatedAt: now,
      }
      database.resumes.push(resume)
      return structuredClone(resume)
    })
  }

  async findResumeById(resumeId: string): Promise<ResumeRecord | null> {
    const database = await this.readDatabase()
    const resume = database.resumes.find((entry) => entry.id === resumeId)
    return resume ? structuredClone(resume) : null
  }

  async listResumesByOwner(ownerId: string): Promise<ResumeSummary[]> {
    return this.listSummaries((resume) => resume.ownerId === ownerId)
  }

  async listAllResumes(): Promise<ResumeSummary[]> {
    return this.listSummaries(() => true)
  }

  private async listSummaries(
    predicate: (resume: ResumeRecord) => boolean,
  ): Promise<ResumeSummary[]> {
    const database = await this.readDatabase()
    return database.resumes
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
      )
  }

  async updateDraft(input: UpdateDraftInput): Promise<ResumeRecord> {
    return this.withWriteLock((database) => {
      const index = database.resumes.findIndex((entry) => entry.id === input.resumeId)
      const resume = database.resumes[index]
      if (!resume) {
        throw new Error("RESUME_NOT_FOUND")
      }
      if (resume.draftVersion !== input.expectedVersion) {
        throw new VersionConflictError(resume.draftVersion)
      }

      const updated: ResumeRecord = {
        ...resume,
        title: input.title,
        draftDocument: input.document,
        draftSchemaVersion: input.document.schemaVersion,
        draftVersion: resume.draftVersion + 1,
        updatedAt: new Date().toISOString(),
      }
      database.resumes[index] = updated
      return structuredClone(updated)
    })
  }

  async removeAssetReferencesFromDraft(
    resumeId: string,
    assetId: string,
  ): Promise<void> {
    await this.withWriteLock((database) => {
      const index = database.resumes.findIndex((entry) => entry.id === resumeId)
      const resume = database.resumes[index]
      if (!resume) {
        throw new Error("RESUME_NOT_FOUND")
      }
      const draftDocument = removeAssetReferencesFromDocument(
        resume.draftDocument,
        assetId,
      )
      database.resumes[index] = {
        ...resume,
        draftDocument,
        draftSchemaVersion: draftDocument.schemaVersion,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  async deleteResume(resumeId: string): Promise<void> {
    await this.deleteResumes([resumeId])
  }

  async deleteResumes(resumeIds: string[]): Promise<void> {
    await this.withWriteLock((database) => {
      const resumeIdSet = new Set(resumeIds)
      database.aiGenerations = database.aiGenerations.filter(
        (entry) => !resumeIdSet.has(entry.resumeId),
      )
      database.assets = database.assets.filter(
        (entry) => !resumeIdSet.has(entry.resumeId),
      )
      database.publications = database.publications.filter(
        (entry) => !resumeIdSet.has(entry.resumeId),
      )
      database.resumes = database.resumes.filter((entry) => !resumeIdSet.has(entry.id))
    })
  }

  async publishResume(resumeId: string): Promise<PublicResumeRecord> {
    return this.withWriteLock((database) => {
      const resumeIndex = database.resumes.findIndex((entry) => entry.id === resumeId)
      const resume = database.resumes[resumeIndex]
      if (!resume) {
        throw new Error("RESUME_NOT_FOUND")
      }

      const publicationVersion =
        database.publications.filter((entry) => entry.resumeId === resumeId).length + 1
      const publication: PublicationRecord = {
        id: randomUUID(),
        resumeId,
        publicationVersion,
        publishedDocument: structuredClone(resume.draftDocument),
        schemaVersion: resume.draftSchemaVersion,
        templateId: resume.draftDocument.template.id,
        publishedAt: new Date().toISOString(),
      }
      database.publications.push(publication)
      database.resumes[resumeIndex] = {
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
    })
  }

  async findPublicResume(publicSlug: string): Promise<PublicResumeRecord | null> {
    const database = await this.readDatabase()
    const resume = database.resumes.find((entry) => entry.publicSlug === publicSlug)
    if (!resume?.latestPublicationId) {
      return null
    }
    const publication = database.publications.find(
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
    await this.withWriteLock((database) => {
      database.aiGenerations.push(record)
    })
  }

  async createAsset(record: ResumeAssetRecord): Promise<ResumeAssetRecord> {
    return this.withWriteLock((database) => {
      if (
        database.assets.some(
          (asset) => asset.id === record.id || asset.storagePath === record.storagePath,
        )
      ) {
        throw new Error("ASSET_ALREADY_EXISTS")
      }
      database.assets.push(record)
      return structuredClone(record)
    })
  }

  async findAssetById(assetId: string): Promise<ResumeAssetRecord | null> {
    const database = await this.readDatabase()
    const asset = database.assets.find((entry) => entry.id === assetId)
    return asset ? structuredClone(asset) : null
  }

  async listAssetsByResumeId(resumeId: string): Promise<ResumeAssetRecord[]> {
    const database = await this.readDatabase()
    return structuredClone(
      database.assets.filter((entry) => entry.resumeId === resumeId),
    )
  }

  async isAssetReferencedByPublication(
    resumeId: string,
    assetId: string,
  ): Promise<boolean> {
    const database = await this.readDatabase()
    return database.publications.some(
      (publication) =>
        publication.resumeId === resumeId &&
        publication.publishedDocument.resources.placements.some(
          (placement) => placement.assetId === assetId,
        ),
    )
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.withWriteLock((database) => {
      database.assets = database.assets.filter((asset) => asset.id !== assetId)
    })
  }
}
