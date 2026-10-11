import type { ReactNode } from "react"
import { Toaster } from "../../components/ui/sonner"
import { TooltipProvider } from "../../components/ui/tooltip"

// 编辑器与全页预览/Web 构建页都会使用 Tooltip 和 Toaster，
// 只在编辑器路由内挂载，避免打进首页首屏脚本。
export default function EditorLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <TooltipProvider>
      {children}
      <Toaster position="top-center" richColors />
    </TooltipProvider>
  )
}
