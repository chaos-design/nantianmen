import { randomUUID } from "node:crypto"
import {
  type Announcement,
  type AnnouncementInput,
  announcementSchema,
} from "../../shared/announcement/announcement-schema"
import {
  createServerSupabaseClient,
  type ServerSupabaseClient,
} from "../supabase/supabase-client"
import type { AnnouncementRepository } from "./announcement-repository"
import { AnnouncementStoreUnavailableError } from "./announcement-repository"

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
  // 42P01 是 Postgres 的 undefined_table；PGRST205 是 PostgREST schema cache 未命中。
  // 两者都指向同一个根因：announcements 表还没建。翻译成仓储级错误，
  // 领域层据此决定降级，而不是去匹配数据库错误码。
  if (error.code === "42P01" || error.code === "PGRST205") {
    return new AnnouncementStoreUnavailableError(
      "announcements 表不存在，请先执行 supabase/platform.sql 或 supabase/update.sql",
    )
  }
  return new Error(`SUPABASE_${error.code ?? "REQUEST"}: ${detail}`)
}

function assertSupabaseSuccess(error: SupabaseError | null): void {
  if (error) {
    throw toSupabaseError(error)
  }
}

function mapAnnouncement(row: DatabaseRow): Announcement {
  return announcementSchema.parse({
    id: row.id,
    level: row.level,
    title: row.title,
    body: row.body,
    linkLabel: row.link_label,
    linkHref: row.link_href,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

function toRow(input: AnnouncementInput): Record<string, unknown> {
  return {
    level: input.level,
    title: input.title,
    body: input.body,
    link_label: input.linkLabel,
    link_href: input.linkHref,
    enabled: input.enabled,
    sort_order: input.sortOrder,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    updated_at: new Date().toISOString(),
  }
}

export class SupabaseAnnouncementRepository implements AnnouncementRepository {
  private readonly supabase: ServerSupabaseClient

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    supabaseClient?: ServerSupabaseClient,
  ) {
    this.supabase =
      supabaseClient ?? createServerSupabaseClient(supabaseUrl, serviceRoleKey)
  }

  async listAnnouncements(): Promise<Announcement[]> {
    const { data, error } = await this.supabase
      .from("announcements")
      .select()
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })

    assertSupabaseSuccess(error)
    return ((data ?? []) as DatabaseRow[]).map(mapAnnouncement)
  }

  async createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
    const { data, error } = await this.supabase
      .from("announcements")
      .insert({ id: randomUUID(), ...toRow(input) })
      .select()
      .single()

    if (error) {
      throw toSupabaseError(error)
    }
    if (!data) {
      throw new Error("SUPABASE_EMPTY_RESPONSE")
    }
    return mapAnnouncement(data as DatabaseRow)
  }

  async updateAnnouncement(
    announcementId: string,
    input: AnnouncementInput,
  ): Promise<Announcement | null> {
    const { data, error } = await this.supabase
      .from("announcements")
      .update(toRow(input))
      .eq("id", announcementId)
      .select()
      .maybeSingle()

    assertSupabaseSuccess(error)
    return data ? mapAnnouncement(data as DatabaseRow) : null
  }

  async deleteAnnouncement(announcementId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("announcements")
      .delete()
      .eq("id", announcementId)
      .select("id")
      .maybeSingle()

    assertSupabaseSuccess(error)
    return Boolean(data)
  }
}
