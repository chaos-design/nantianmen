import type { Metadata } from "next"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import { ResetPasswordForm } from "../../features/auth/reset-password-form"
import { sanitizeRedirectPath } from "../../server/auth/redirect-path"

export const metadata: Metadata = {
  title: "设置新密码",
}

interface ResetPasswordPageProps {
  searchParams: Promise<{ next?: string | string[] }>
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const query = await searchParams
  const rawNext = Array.isArray(query.next) ? query.next[0] : query.next
  const nextPath = sanitizeRedirectPath(rawNext)

  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <CardHeader>
          <CardTitle>设置新密码</CardTitle>
          <CardDescription>密码更新后将返回原工作页面。</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm nextPath={nextPath} />
        </CardContent>
      </Card>
    </main>
  )
}
