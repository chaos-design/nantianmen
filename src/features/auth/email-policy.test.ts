import { describe, expect, it } from "vitest"
import { isAllowedRegistrationEmail, isValidEmail } from "./email-policy"

describe("email policy", () => {
  it("accepts valid email addresses", () => {
    expect(isValidEmail("member@example.com")).toBe(true)
    expect(isValidEmail("invalid-address")).toBe(false)
  })

  it.each([
    "member@qq.com",
    "member@163.com",
    "member@foxmail.com",
    "member@gmail.com",
    "member@outlook.com",
    "member@icloud.com",
    "member@proton.me",
  ])("allows registration with a common email domain: %s", (email) => {
    expect(isAllowedRegistrationEmail(email)).toBe(true)
  })

  it("matches registration domains case-insensitively", () => {
    expect(isAllowedRegistrationEmail("member@QQ.COM")).toBe(true)
  })

  it.each([
    "member@example.com",
    "member@company.internal",
    "member@mail.qq.com",
    "member@qq.com.example.com",
    "invalid-address",
  ])("rejects registration with an unsupported email domain: %s", (email) => {
    expect(isAllowedRegistrationEmail(email)).toBe(false)
  })
})
