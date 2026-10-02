import { createBrowserClient } from "@supabase/ssr"
import { readSupabasePublicConfig } from "./public-config"

export function createClient() {
  const config = readSupabasePublicConfig()
  return createBrowserClient(config.supabaseUrl, config.publishableKey)
}
