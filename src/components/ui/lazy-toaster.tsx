"use client"

import dynamic from "next/dynamic"
import type { ComponentProps } from "react"

/**
 * 延后挂载的 Toaster。
 *
 * sonner 与它的图标只在第一次提示时才有用，hydration 之后再加载可以把它从首屏
 * 脚本里摘掉。提示由 `notify` 动态引入同一个模块，两者共用一个异步 chunk。
 */
const Toaster = dynamic(() => import("./sonner").then((module) => module.Toaster), {
  ssr: false,
})

export function LazyToaster(props: ComponentProps<typeof Toaster>) {
  return <Toaster {...props} />
}
