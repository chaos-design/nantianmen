import type { ReactNode } from "react"
import { LazyToaster } from "../../components/ui/lazy-toaster"
import "../../styles/workspace.css"

// 操作结果提示走按需加载：Toaster 与 sonner 都在 hydration 之后才挂载，
// 首屏只留页面本身需要的脚本。
export default function WorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <LazyToaster position="top-center" richColors />
    </>
  )
}
