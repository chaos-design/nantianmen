import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import { ForgotPasswordForm } from "../../features/auth/forgot-password-form"
import { sanitizeRedirectPath } from "../../server/auth/redirect-path"

export const metadata: Metadata = {
  title: "重置密码",
}

interface ForgotPasswordPageProps {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const query = await searchParams
  const rawNext = Array.isArray(query.next) ? query.next[0] : query.next
  const nextPath = sanitizeRedirectPath(rawNext)

  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <CardHeader>
          <CardTitle>找回密码</CardTitle>
          <CardDescription>输入已注册邮箱以获取安全的密码重置链接。</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm nextPath={nextPath} />
        </CardContent>
      </Card>
      <Button variant="ghost" asChild>
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
          <ArrowLeftIcon data-icon="inline-start" />
          返回登录
        </Link>
      </Button>
    </main>
  )
}
