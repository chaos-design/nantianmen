import type { ReactNode } from "react"
import { Toaster } from "../../components/ui/sonner"

// 登录表单通过 toast 反馈错误与「邮件已发送」状态（见 login-form），
// Toaster 已从根布局下移到路由层，这里单独挂载。
export default function LoginLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors />
    </>
  )
}
