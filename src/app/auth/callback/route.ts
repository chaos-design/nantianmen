import { NextResponse } from "next/server"
import { createClient } from "../../../lib/supabase/server"
import { previewSessionCookieName } from "../../../server/auth/preview-session-cookie"
import { sanitizeRedirectPath } from "../../../server/auth/redirect-path"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const nextPath = sanitizeRedirectPath(requestUrl.searchParams.get("next"))
  const code = requestUrl.searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // 登录成功即离开 Preview 会话：避免 Preview cookie 抢占真实登录身份。
      const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin))
      response.cookies.set(previewSessionCookieName, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      })
      return response
    }
  }

  const loginUrl = new URL("/login", requestUrl.origin)
  loginUrl.searchParams.set("next", nextPath)
  loginUrl.searchParams.set("error", "callback")
  return NextResponse.redirect(loginUrl)
}
