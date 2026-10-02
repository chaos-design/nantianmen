import type { Metadata } from "next"
import { TextSelectionShortcuts } from "../components/text-selection-shortcuts"
import { Toaster } from "../components/ui/sonner"
import { TooltipProvider } from "../components/ui/tooltip"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Résumé Lab · 简历可视化工作台",
    template: "%s · Résumé Lab",
  },
  description:
    "不用到处找模板或打开 Word，在一个工作台创建简历、导出 PDF，并通过链接直接分享。",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning 仅作用于根元素自身的一层属性。
    // 浏览器扩展会在 React hydrate 前往 <html>/<body> 写入
    // 自己的版本戳，导致根元素属性 mismatch。根元素无动态属性，抑制无诊断损失。
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TooltipProvider>
          <TextSelectionShortcuts />
          {children}
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </body>
    </html>
  )
}
