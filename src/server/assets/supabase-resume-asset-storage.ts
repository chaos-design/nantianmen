import {
  createServerSupabaseClient,
  type ServerSupabaseClient,
} from "../supabase/supabase-client"
import type { ResumeAssetStorage } from "./resume-asset-storage"

type SupabaseStorageError = {
  message: string
  name?: string
}

function assertStorageSuccess(error: SupabaseStorageError | null): void {
  if (error) {
    throw new Error(`SUPABASE_STORAGE_${error.name ?? "REQUEST"}: ${error.message}`)
  }
}

export class SupabaseResumeAssetStorage implements ResumeAssetStorage {
  private readonly supabase: ServerSupabaseClient

  constructor(
    supabaseUrl: string,
    serviceRoleKey: string,
    private readonly bucket = "resume-assets",
    supabaseClient?: ServerSupabaseClient,
  ) {
    this.supabase =
      supabaseClient ?? createServerSupabaseClient(supabaseUrl, serviceRoleKey)
  }

  async put(storagePath: string, bytes: Uint8Array, mimeType: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(
        storagePath,
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mimeType }),
        {
          contentType: mimeType,
          upsert: false,
        },
      )
    assertStorageSuccess(error)
  }

  async get(storagePath: string): Promise<Uint8Array> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(storagePath)
    assertStorageSuccess(error)
    if (!data) {
      throw new Error("SUPABASE_STORAGE_EMPTY_RESPONSE")
    }
    return new Uint8Array(await data.arrayBuffer())
  }

  async delete(storagePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([storagePath])
    assertStorageSuccess(error)
  }
}
