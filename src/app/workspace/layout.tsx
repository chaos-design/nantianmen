import type { ReactNode } from "react"
import { Toaster } from "../../components/ui/sonner"

// 工作台与公告管理使用 Toaster 提示操作结果。
export default function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors />
    </>
  )
}
