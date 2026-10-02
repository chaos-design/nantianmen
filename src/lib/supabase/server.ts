import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { readSupabasePublicConfig } from "./public-config"

export async function createClient() {
  const config = readSupabasePublicConfig()
  const cookieStore = await cookies()

  return createServerClient(config.supabaseUrl, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set cookies directly; middleware can refresh sessions.
        }
      },
    },
  })
}
