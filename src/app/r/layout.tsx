import type { ReactNode } from "react"
import { Toaster } from "../../components/ui/sonner"

// 公开分享页的操作（复制链接等）使用 Toaster 提示结果。
export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors />
    </>
  )
}
