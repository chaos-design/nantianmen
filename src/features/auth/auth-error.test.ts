import { describe, expect, it } from "vitest"
import { getAuthErrorMessage } from "./auth-error"

describe("auth error", () => {
  it.each([
    ["Invalid login credentials", "邮箱或密码不正确"],
    ["Email not confirmed", "请先完成邮箱验证"],
    ["User already registered", "该邮箱已注册，请直接登录"],
    ["Signups not allowed for otp", "该邮箱尚未注册，请先创建账户"],
    [
      "Unsupported registration email domain",
      "请使用 QQ、网易、Gmail、Outlook 等常用邮箱注册",
    ],
    ["Email rate limit exceeded", "请求过于频繁，请稍后再试"],
  ])("maps %s to a stable message", (message, expected) => {
    expect(getAuthErrorMessage(new Error(message))).toBe(expected)
  })

  it("does not expose unknown provider errors", () => {
    expect(getAuthErrorMessage(new Error("internal provider details"))).toBe(
      "认证服务暂时不可用，请稍后重试",
    )
  })
})
