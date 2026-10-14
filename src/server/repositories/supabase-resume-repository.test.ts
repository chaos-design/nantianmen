import { describe, expect, it } from "vitest"
import { createResumeDocument } from "../../shared/resume-schema/resume-schema"
import type { ServerSupabaseClient } from "../supabase/supabase-client"
import {
  RESUME_LIST_SELECT,
  SupabaseResumeRepository,
} from "./supabase-resume-repository"

describe("supabase resume repository", () => {
  it("binds new resumes to an owner without creating an edit token", async () => {
    const document = createResumeDocument()
    const ownerId = "00000000-0000-4000-8000-000000000001"
    let inserted: Record<string, unknown> | undefined
    const row = {
      id: "resume-id",
      owner_id: ownerId,
      title: "Owned Resume",
      public_slug: "public-slug",
      edit_token_hash: null,
      draft_document: document,
      draft_schema_version: document.schemaVersion,
      draft_version: 1,
      latest_publication_id: null,
      created_at: "2026-08-05T00:00:00.000Z",
      updated_at: "2026-08-05T00:00:00.000Z",
    }
    const query = {
      insert(payload: Record<string, unknown>) {
        inserted = payload
        return this
      },
      select() {
        return this
      },
      async single() {
        return { data: row, error: null }
      },
    }
    const supabase = {
      from() {
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseResumeRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    const created = await repository.createResume({
      id: "resume-id",
      ownerId,
      title: "Owned Resume",
      publicSlug: "public-slug",
      document,
    })

    expect(inserted).toMatchObject({
      owner_id: ownerId,
      edit_token_hash: null,
    })
    expect(created).toMatchObject({
      ownerId,
      editTokenHash: null,
    })
  })

  it("saves drafts to the resumes table through the Supabase client", async () => {
    const document = createResumeDocument()
    const calls: {
      table?: string
      payload?: Record<string, unknown>
      filters: Array<[string, unknown]>
    } = { filters: [] }
    const row = {
      id: "resume-id",
      title: "Saved Resume",
      public_slug: "public-slug",
      edit_token_hash: "hash",
      draft_document: document,
      draft_schema_version: document.schemaVersion,
      draft_version: 3,
      latest_publication_id: null,
      created_at: "2026-08-03T00:00:00.000Z",
      updated_at: "2026-08-03T00:00:01.000Z",
    }
    const query = {
      update(payload: Record<string, unknown>) {
        calls.payload = payload
        return this
      },
      eq(column: string, value: unknown) {
        calls.filters.push([column, value])
        return this
      },
      select() {
        return this
      },
      async maybeSingle() {
        return { data: row, error: null }
      },
    }
    const supabase = {
      from(table: string) {
        calls.table = table
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseResumeRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    const saved = await repository.updateDraft({
      resumeId: "resume-id",
      expectedVersion: 2,
      title: "Saved Resume",
      document,
    })

    expect(calls.table).toBe("resumes")
    expect(calls.payload).toMatchObject({
      title: "Saved Resume",
      draft_document: document,
      draft_schema_version: document.schemaVersion,
      draft_version: 3,
    })
    expect(calls.filters).toEqual([
      ["id", "resume-id"],
      ["draft_version", 2],
    ])
    expect(saved.draftVersion).toBe(3)
    expect(saved.draftDocument).toEqual(document)
  })

  it("lists resume summaries without transferring full draft documents", async () => {
    const ownerId = "00000000-0000-4000-8000-000000000001"
    const selectCalls: string[] = []
    const rows = [
      {
        // PostgREST 对 `template_id:draft_document->template->>id`
        // 这类别名 JSON 路径只返回别名字段本身，不返回嵌套文档。
        id: "resume-1",
        owner_id: ownerId,
        title: "Resume A",
        public_slug: "slug-a",
        template_id: "modern-minimal",
        draft_version: 2,
        latest_publication_id: "publication-1",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-02T00:00:00.000Z",
      },
      {
        id: "resume-2",
        owner_id: ownerId,
        title: "Resume B",
        public_slug: "slug-b",
        // 缺少别名兜底字段时回落默认模板，但 id 不得被模板 id 覆盖。
        template_id: null,
        draft_version: 1,
        latest_publication_id: null,
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-03T00:00:00.000Z",
      },
    ]
    const query = {
      select(columns: string) {
        selectCalls.push(columns)
        return this
      },
      eq(_column: string, _value: unknown) {
        return this
      },
      order(_column: string, _options: unknown) {
        return Promise.resolve({ data: rows, error: null })
      },
    }
    const supabase = {
      from() {
        return query
      },
    } as unknown as ServerSupabaseClient
    const repository = new SupabaseResumeRepository(
      "https://example.supabase.co",
      "service-role-key",
      supabase,
    )

    const summaries = await repository.listResumesByOwner(ownerId)

    // 回归：JSON 路径字段必须显式别名（template_id:...），否则 PostgREST
    // 会用 `id` 命名该字段并覆盖真实简历 id，工作台所有卡片将链接到模板 id。
    expect(RESUME_LIST_SELECT).toContain("template_id:draft_document->template->>id")
    expect(selectCalls).toEqual([RESUME_LIST_SELECT])
    expect(summaries.map((summary) => summary.id)).toEqual(["resume-1", "resume-2"])
    expect(summaries).toEqual([
      {
        id: "resume-1",
        ownerId,
        title: "Resume A",
        publicSlug: "slug-a",
        templateId: "modern-minimal",
        draftVersion: 2,
        latestPublicationId: "publication-1",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      },
      {
        id: "resume-2",
        ownerId,
        title: "Resume B",
        publicSlug: "slug-b",
        templateId: "modern-minimal",
        draftVersion: 1,
        latestPublicationId: null,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-03T00:00:00.000Z",
      },
    ])
  })
})
