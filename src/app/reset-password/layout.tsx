import type { ReactNode } from "react"
import { Toaster } from "../../components/ui/sonner"

// 重置密码表单通过 toast 反馈提交状态（见 reset-password-form），
// Toaster 已从根布局下移到路由层，这里单独挂载。
export default function ResetPasswordLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors />
    </>
  )
}
