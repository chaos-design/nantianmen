import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export type ServerSupabaseClient = SupabaseClient

export function createServerSupabaseClient(
  supabaseUrl: string,
  serviceRoleKey: string,
): ServerSupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "resume-visualization-platform",
      },
    },
  })
}
