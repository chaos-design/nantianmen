import type { ReactNode } from "react"
import { Toaster } from "../../components/ui/sonner"

// 找回密码表单通过 toast 反馈「邮件已发送」等状态（见 forgot-password-form），
// Toaster 已从根布局下移到路由层，这里单独挂载。
export default function ForgotPasswordLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors />
    </>
  )
}
