import { parseResumeDocument } from "../../shared/resume-schema/resume-schema"
import {
  createServerSupabaseClient,
  type ServerSupabaseClient,
} from "../supabase/supabase-client"
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

type DatabaseRow = Record<string, unknown>
type SupabaseError = {
  code?: string
  details?: string
  hint?: string
  message: string
}

function toSupabaseError(error: SupabaseError): Error {
  const detail = [error.message, error.details, error.hint]
    .filter((part) => part?.trim())
    .join(" | ")
  return new Error(`SUPABASE_${error.code ?? "REQUEST"}: ${detail}`)
}

function assertSupabaseSuccess(error: SupabaseError | null): void {
  if (error) {
    throw toSupabaseError(error)
  }
}

function assertSupabaseData<T>(data: T | null, error: SupabaseError | null): T {
  assertSupabaseSuccess(error)
  if (data === null) {
    throw new Error("SUPABASE_EMPTY_RESPONSE")
  }
  return data
}

function mapResume(row: DatabaseRow): ResumeRecord {
  return {
    id: String(row.id),
    ownerId: row.owner_id ? String(row.owner_id) : null,
    title: String(row.title),
    publicSlug: String(row.public_slug),
    editTokenHash: row.edit_token_hash ? String(row.edit_token_hash) : null,
    draftDocument: parseResumeDocument(row.draft_document),
    draftSchemaVersion: String(row.draft_schema_version),
    draftVersion: Number(row.draft_version),
    latestPublicationId: row.latest_publication_id
      ? String(row.latest_publication_id)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapResumeSummary(row: DatabaseRow): ResumeSummary {
  const document = parseResumeDocument(row.draft_document)
  return {
    id: String(row.id),
    ownerId: row.owner_id ? String(row.owner_id) : null,
    title: String(row.title),
    publicSlug: String(row.public_slug),
    templateId: document.template.id,
    draftVersion: Number(row.draft_version),
    latestPublicationId: row.latest_publication_id
      ? String(row.latest_publication_id)
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapPublication(row: DatabaseRow): PublicationRecord {
  return {
    id: String(row.id),
    resumeId: String(row.resume_id),
    publicationVersion: Number(row.publication_version),
    publishedDocument: parseResumeDocument(row.published_document),
    schemaVersion: String(row.schema_version),
    templateId: String(row.template_id),
    publishedAt: String(row.published_at),
  }
}

function mapAsset(row: DatabaseRow): ResumeAssetRecord {
  return {
    id: String(row.id),
    resumeId: String(row.resume_id),
    storagePath: String(row.storage_path),
    assetType: "image",
    mimeType: String(row.mime_type) as ResumeAssetRecord["mimeType"],
    byteSize: Number(row.byte_size),
    originalName: String(row.original_name),
    width: Number(row.width),
    height: Number(row.height),
    createdAt: String(row.created_at),
  }
}

export class SupabaseResumeRepository implements ResumeRepository {
  private readonly supabase: ServerSupabaseClient

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    supabaseClient?: ServerSupabaseClient,
  ) {
    this.supabase =
      supabaseClient ?? createServerSupabaseClient(supabaseUrl, serviceRoleKey)
  }

  async createResume(input: CreateResumeInput): Promise<ResumeRecord> {
    const { data, error } = await this.supabase
      .from("resumes")
      .insert({
        id: input.id,
        owner_id: input.ownerId,
        title: input.title,
        public_slug: input.publicSlug,
        edit_token_hash: null,
        draft_document: input.document,
        draft_schema_version: input.document.schemaVersion,
        draft_version: 1,
      })
      .select()
      .single()

    return mapResume(assertSupabaseData(data as DatabaseRow | null, error))
  }

  async findResumeById(resumeId: string): Promise<ResumeRecord | null> {
    const { data, error } = await this.supabase
      .from("resumes")
      .select()
      .eq("id", resumeId)
      .limit(1)
      .maybeSingle()

    assertSupabaseSuccess(error)
    return data ? mapResume(data as DatabaseRow) : null
  }

  async listResumesByOwner(ownerId: string): Promise<ResumeSummary[]> {
    const { data, error } = await this.supabase
      .from("resumes")
      .select(
        "id,owner_id,title,public_slug,draft_document,draft_version,latest_publication_id,created_at,updated_at",
      )
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false })

    assertSupabaseSuccess(error)
    return ((data ?? []) as DatabaseRow[]).map(mapResumeSummary)
  }

  async listAllResumes(): Promise<ResumeSummary[]> {
    const { data, error } = await this.supabase
      .from("resumes")
      .select(
        "id,owner_id,title,public_slug,draft_document,draft_version,latest_publication_id,created_at,updated_at",
      )
      .order("updated_at", { ascending: false })

    assertSupabaseSuccess(error)
    return ((data ?? []) as DatabaseRow[]).map(mapResumeSummary)
  }

  async updateDraft(input: UpdateDraftInput): Promise<ResumeRecord> {
    const { data, error } = await this.supabase
      .from("resumes")
      .update({
        title: input.title,
        draft_document: input.document,
        draft_schema_version: input.document.schemaVersion,
        draft_version: input.expectedVersion + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.resumeId)
      .eq("draft_version", input.expectedVersion)
      .select()
      .maybeSingle()

    assertSupabaseSuccess(error)
    if (data) {
      return mapResume(data as DatabaseRow)
    }
    const current = await this.findResumeById(input.resumeId)
    if (!current) {
      throw new Error("RESUME_NOT_FOUND")
    }
    throw new VersionConflictError(current.draftVersion)
  }

  async removeAssetReferencesFromDraft(
    resumeId: string,
    assetId: string,
  ): Promise<void> {
    const resume = await this.findResumeById(resumeId)
    if (!resume) {
      throw new Error("RESUME_NOT_FOUND")
    }
    const draftDocument = removeAssetReferencesFromDocument(
      resume.draftDocument,
      assetId,
    )
    const { error } = await this.supabase
      .from("resumes")
      .update({
        draft_document: draftDocument,
        draft_schema_version: draftDocument.schemaVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", resumeId)

    assertSupabaseSuccess(error)
  }

  async deleteResume(resumeId: string): Promise<void> {
    await this.deleteResumes([resumeId])
  }

  async deleteResumes(resumeIds: string[]): Promise<void> {
    const { error } = await this.supabase.from("resumes").delete().in("id", resumeIds)
    assertSupabaseSuccess(error)
  }

  async publishResume(resumeId: string): Promise<PublicResumeRecord> {
    const { data, error } = await this.supabase.rpc("publish_resume_snapshot", {
      p_resume_id: resumeId,
    })
    const result = assertSupabaseData(
      data as { resume: DatabaseRow; publication: DatabaseRow } | null,
      error,
    )
    const resume = mapResume(result.resume)
    return {
      resume: {
        id: resume.id,
        title: resume.title,
        publicSlug: resume.publicSlug,
      },
      publication: mapPublication(result.publication),
    }
  }

  async findPublicResume(publicSlug: string): Promise<PublicResumeRecord | null> {
    const { data: resumeRow, error: resumeError } = await this.supabase
      .from("resumes")
      .select()
      .eq("public_slug", publicSlug)
      .not("latest_publication_id", "is", null)
      .limit(1)
      .maybeSingle()

    assertSupabaseSuccess(resumeError)
    if (!resumeRow) {
      return null
    }
    const resume = mapResume(resumeRow as DatabaseRow)
    const { data: publicationRow, error: publicationError } = await this.supabase
      .from("resume_publications")
      .select()
      .eq("id", resume.latestPublicationId ?? "")
      .limit(1)
      .maybeSingle()

    assertSupabaseSuccess(publicationError)
    if (!publicationRow) {
      return null
    }
    return {
      resume: {
        id: resume.id,
        title: resume.title,
        publicSlug: resume.publicSlug,
      },
      publication: mapPublication(publicationRow as DatabaseRow),
    }
  }

  async recordAiGeneration(record: AiGenerationRecord): Promise<void> {
    const { error } = await this.supabase.from("ai_generations").insert({
      id: record.id,
      resume_id: record.resumeId,
      task_type: record.taskType,
      target_section_id: record.targetSectionId,
      input_summary: record.inputSummary,
      output: record.output,
      provider: record.provider,
      latency_ms: record.latencyMs,
      created_at: record.createdAt,
    })
    assertSupabaseSuccess(error)
  }

  async createAsset(record: ResumeAssetRecord): Promise<ResumeAssetRecord> {
    const { data, error } = await this.supabase
      .from("resume_assets")
      .insert({
        id: record.id,
        resume_id: record.resumeId,
        storage_path: record.storagePath,
        asset_type: record.assetType,
        mime_type: record.mimeType,
        byte_size: record.byteSize,
        original_name: record.originalName,
        width: record.width,
        height: record.height,
        created_at: record.createdAt,
      })
      .select()
      .single()

    return mapAsset(assertSupabaseData(data as DatabaseRow | null, error))
  }

  async findAssetById(assetId: string): Promise<ResumeAssetRecord | null> {
    const { data, error } = await this.supabase
      .from("resume_assets")
      .select()
      .eq("id", assetId)
      .limit(1)
      .maybeSingle()

    assertSupabaseSuccess(error)
    return data ? mapAsset(data as DatabaseRow) : null
  }

  async listAssetsByResumeId(resumeId: string): Promise<ResumeAssetRecord[]> {
    const { data, error } = await this.supabase
      .from("resume_assets")
      .select()
      .eq("resume_id", resumeId)
      .order("created_at", { ascending: true })

    assertSupabaseSuccess(error)
    return ((data ?? []) as DatabaseRow[]).map(mapAsset)
  }

  async isAssetReferencedByPublication(
    resumeId: string,
    assetId: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("resume_publications")
      .select("published_document")
      .eq("resume_id", resumeId)

    assertSupabaseSuccess(error)
    return ((data ?? []) as DatabaseRow[]).some((row) => {
      const document = parseResumeDocument(row.published_document)
      return document.resources.placements.some(
        (placement) => placement.assetId === assetId,
      )
    })
  }

  async deleteAsset(assetId: string): Promise<void> {
    const { error } = await this.supabase
      .from("resume_assets")
      .delete()
      .eq("id", assetId)
    assertSupabaseSuccess(error)
  }
}
