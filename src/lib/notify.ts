/**
 * 轻量通知入口。
 *
 * 工作台的提示只在「删除 / 创建失败」这类交互之后出现，没必要把 sonner 打进首屏。
 * 这里用动态 import 在第一次真的需要提示时才加载；Toaster 本身也由
 * `LazyToaster` 在 hydration 之后挂载，两者共用同一个异步 chunk。
 */
type NotifyKind = "success" | "error"

async function notify(kind: NotifyKind, message: string): Promise<void> {
  const { toast } = await import("sonner")
  toast[kind](message)
}

export function notifySuccess(message: string): void {
  void notify("success", message)
}

export function notifyError(message: string): void {
  void notify("error", message)
}
