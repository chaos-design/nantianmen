"use client"

import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import { Spinner } from "../../components/ui/spinner"

export function SignOutButton() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    await fetch("/api/auth/preview", { method: "DELETE" }).catch(() => undefined)
    // supabase-js 只为登出服务：点击时才动态加载，
    // 不让整套 auth-sdk 进入工作台首屏脚本。
    const { createClient } = await import("../../lib/supabase/client")
    await createClient()
      .auth.signOut()
      .catch(() => undefined)
    router.replace("/")
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isSigningOut}
      onClick={handleSignOut}
    >
      {isSigningOut ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <LogOutIcon data-icon="inline-start" />
      )}
      退出登录
    </Button>
  )
}
