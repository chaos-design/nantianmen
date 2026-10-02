const defaultRedirectPath = "/workspace"
const redirectBaseUrl = "https://resume.local"

/**
 * `next` 只用于站内跳转，任何解析结果都不能被浏览器当成站外地址。
 *
 * 仅检查原始字符串不够：URL 解析会做路径归一化，`/..//evil.com` 归一化后
 * pathname 变成 `//evil.com`，而 `//` 前缀在浏览器里等价于协议相对地址，
 * `new URL("//evil.com", origin)` 会解析到 `https://evil.com/`。
 * 因此必须对归一化之后的 pathname 再校验一次。
 */
export function sanitizeRedirectPath(
  value: string | null | undefined,
  fallback = defaultRedirectPath,
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    return fallback
  }

  let url: URL
  try {
    url = new URL(value, redirectBaseUrl)
  } catch {
    return fallback
  }

  const { pathname, search, hash } = url
  if (
    url.origin !== redirectBaseUrl ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//")
  ) {
    return fallback
  }
  return `${pathname}${search}${hash}`
}
