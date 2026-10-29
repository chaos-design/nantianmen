import type { ReactNode } from "react"
import "../../styles/resume.css"

// 分享页不再挂 Toaster：复制结果由按钮自身回显，避免为一次提示把 sonner
// 打进这一页的首屏脚本（这一页的 LCP 是简历图片，脚本越少越早拿到带宽）。
export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children
}
