import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { readAuthConfig } from "../../server/auth/auth-config"
import { previewSessionCookieName } from "../../server/auth/preview-session-cookie"
import { readSupabasePublicConfig } from "./public-config"

export async function updateSession(request: NextRequest) {
  const authConfig = readAuthConfig()
  if (authConfig.preview && request.cookies.has(previewSessionCookieName)) {
    return {
      response: NextResponse.next({ request }),
      authenticated: true,
    }
  }

  if (authConfig.testUser) {
    return {
      response: NextResponse.next({ request }),
      authenticated: true,
    }
  }

  const config = readSupabasePublicConfig()
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(config.supabaseUrl, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        supabaseResponse = NextResponse.next({
          request,
        })
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options)
        }
      },
    },
  })

  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims

  return {
    response: supabaseResponse,
    authenticated:
      !error && typeof claims?.sub === "string" && typeof claims?.email === "string",
  }
}
