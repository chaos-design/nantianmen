import { toast } from "sonner"

export const COPY_FAILURE_MESSAGE = "链接复制失败，请手动复制地址栏"

/**
 * 复制文本到剪贴板，失败时统一提示。
 *
 * navigator.clipboard 只在安全上下文（HTTPS 或 localhost）可用，且可能被用户
 * 或权限策略拒绝。调用方若用 `void` 丢弃 Promise 且不处理返回值，拒绝时会
 * 静默失败——用户点了没反应，还可能先弹一个「已复制」的成功提示。
 *
 * 成功提示由调用方自行决定措辞；失败提示在这里统一，保证每处复制入口在失败
 * 时都有明确反馈。
 *
 * @returns 复制是否成功，供调用方决定是否展示成功提示。
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) {
    toast.error(COPY_FAILURE_MESSAGE)
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    toast.error(COPY_FAILURE_MESSAGE)
    return false
  }
}
