import { expect, test } from "./fixtures"

test("shows password login by default and preserves the recovery target", async ({
  page,
}) => {
  await page.goto("/login?next=%2Feditor%2Fresume-1")

  await expect(page.getByRole("heading", { level: 2, name: "欢迎回来" })).toBeVisible()
  const authModeSwitch = page.locator(".auth-mode-switch")
  const authModeButtons = authModeSwitch.locator("button")
  await expect(authModeSwitch).toBeHidden()
  await expect(authModeButtons).toHaveText(["账号密码登录", "邮箱验证码登录"])
  await expect(authModeButtons.first()).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("#password")).toHaveAttribute("type", "password")
  const legalAgreement = page.getByRole("checkbox", { name: "我已阅读并同意" })
  const loginButton = page.getByRole("button", { name: "登录", exact: true })
  await expect(legalAgreement).not.toBeChecked()
  await expect(loginButton).toBeDisabled()
  await expect(page.getByRole("link", { name: "忘记密码" })).toHaveAttribute(
    "href",
    "/forgot-password?next=%2Feditor%2Fresume-1",
  )
  await expect(page.getByRole("link", { name: "《服务条款》" })).toHaveAttribute(
    "href",
    "/terms",
  )
  await expect(page.getByRole("link", { name: "《隐私政策》" })).toHaveAttribute(
    "href",
    "/privacy",
  )
  const agreementBox = await legalAgreement.boundingBox()
  const loginButtonBox = await loginButton.boundingBox()
  expect(agreementBox?.width ?? 0).toBeLessThanOrEqual(20)
  expect(agreementBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
    loginButtonBox?.y ?? 0,
  )
  await legalAgreement.click()
  await expect(legalAgreement).toBeChecked()
  await expect(loginButton).toBeEnabled()
})

test("exposes complete terms and privacy pages", async ({ page }) => {
  await page.goto("/terms")
  await expect(page.getByRole("heading", { level: 1, name: "服务条款" })).toBeVisible()
  await expect(
    page.getByRole("heading", { level: 2, name: "账号与安全" }),
  ).toBeVisible()
  await expect(page.getByRole("heading", { level: 2, name: "AI 功能" })).toBeVisible()
  const legalHeader = page.locator(".legal-header")
  const headerStyles = await legalHeader.evaluate((element) => {
    const styles = window.getComputedStyle(element)
    return {
      position: styles.position,
      borderBottomWidth: styles.borderBottomWidth,
      boxShadow: styles.boxShadow,
    }
  })
  expect(headerStyles.position).toBe("sticky")
  expect(headerStyles.borderBottomWidth).toBe("0px")
  expect(headerStyles.boxShadow).not.toBe("none")
  await page.evaluate(() => window.scrollTo(0, 600))
  await expect
    .poll(() => legalHeader.evaluate((element) => element.getBoundingClientRect().top))
    .toBeLessThanOrEqual(1)

  await page.getByRole("link", { name: "隐私政策", exact: true }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole("heading", { level: 1, name: "隐私政策" })).toBeVisible()
  await expect(
    page.getByRole("heading", { level: 2, name: "我们处理的信息" }),
  ).toBeVisible()
  await expect(page.getByRole("heading", { level: 2, name: "公开分享" })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  const mobileLayout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
  }))
  expect(mobileLayout.pageWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth + 1)
})

test("shows a complete email-code login flow", async ({ page }) => {
  let otpRequestBody: Record<string, unknown> | null = null
  let verifyRequestBody: Record<string, unknown> | null = null
  await page.route("**/auth/v1/otp**", async (route) => {
    const requestBody = route.request().postData()
    otpRequestBody = requestBody
      ? (JSON.parse(requestBody) as Record<string, unknown>)
      : null
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    })
  })
  await page.route("**/auth/v1/verify**", async (route) => {
    const requestBody = route.request().postData()
    verifyRequestBody = requestBody
      ? (JSON.parse(requestBody) as Record<string, unknown>)
      : null
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error_code: "otp_expired",
        msg: "Token has expired or is invalid",
      }),
    })
  })

  await page.goto("/login")
  const hiddenOtpModeButton = page.locator(".auth-mode-switch button").nth(1)
  await expect(hiddenOtpModeButton).toBeHidden()
  await hiddenOtpModeButton.evaluate((button) => (button as HTMLButtonElement).click())

  await expect(hiddenOtpModeButton).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByLabel("邮箱")).toBeVisible()
  await expect(page.getByLabel("验证码")).toBeVisible()
  const sendCodeButton = page.getByRole("button", { name: "获取验证码" })
  await expect(sendCodeButton).toBeDisabled()
  await page.getByRole("checkbox", { name: "我已阅读并同意" }).click()
  await expect(sendCodeButton).toBeEnabled()
  const otpInput = page.getByLabel("验证码")
  const submitButton = page.getByRole("button", { name: "验证并登录" })
  await expect(otpInput).toHaveAttribute("placeholder", "请先获取验证码")
  await expect(otpInput).not.toHaveAttribute("minlength")
  await expect(otpInput).not.toHaveAttribute("maxlength")
  await expect(otpInput).toHaveAttribute("pattern", "[0-9]+")
  await expect(submitButton).toBeVisible()

  const alignment = await page.evaluate(() => {
    const form = document.querySelector<HTMLElement>(".auth-form")
    const button = document.querySelector<HTMLElement>(".auth-primary-action")
    if (!form || !button) {
      return null
    }
    const formRect = form.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    return {
      buttonWidth: buttonRect.width,
      centerDelta: Math.abs(
        buttonRect.left + buttonRect.width / 2 - (formRect.left + formRect.width / 2),
      ),
    }
  })
  expect(alignment?.buttonWidth).toBeGreaterThan(300)
  expect(alignment?.centerDelta).toBeLessThanOrEqual(1)

  await sendCodeButton.click()
  await expect(
    page.getByRole("alert").filter({ hasText: "请输入有效邮箱后再获取验证码" }),
  ).toBeVisible()
  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "请输入有效邮箱后再获取验证码" }),
  ).toBeVisible()

  await page.getByLabel("邮箱").fill("login-code@example.com")
  await sendCodeButton.click()
  await expect(page.getByRole("button", { name: "60s 后重发" })).toBeVisible()
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "验证码已发送，请查收邮箱" }),
  ).toBeVisible()
  await expect(otpInput).toHaveAttribute("placeholder", "输入邮件中的数字验证码")
  expect(otpRequestBody).toEqual(
    expect.objectContaining({
      email: "login-code@example.com",
      create_user: false,
    }),
  )

  await otpInput.fill("123456789012")
  await expect(otpInput).toHaveValue("123456789012")
  await submitButton.click()
  await expect.poll(() => verifyRequestBody).not.toBeNull()
  expect(verifyRequestBody).toEqual(
    expect.objectContaining({
      token: "123456789012",
      type: "email",
    }),
  )
})

test("keeps native text editing shortcuts available in inputs", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/login")

  const email = page.getByLabel("邮箱")
  const emailValue = "shortcut@example.com"
  const modifier = process.platform === "darwin" ? "Meta" : "Control"

  for (const [selectAllModifier, replacement] of [
    ["Control", "ctrl-select-all@example.com"],
    ["Meta", "command-select-all@example.com"],
  ] as const) {
    await email.fill("replace-this@example.com")
    await email.focus()
    await page.keyboard.press(`${selectAllModifier}+A`)
    await page.keyboard.insertText(replacement)
    await expect(email).toHaveValue(replacement)
  }

  await email.fill(emailValue)
  await email.focus()
  await page.keyboard.press(`${modifier}+A`)

  await page.keyboard.press(`${modifier}+C`)
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(emailValue)

  await page.keyboard.press(`${modifier}+X`)
  await expect(email).toHaveValue("")

  await page.keyboard.press(`${modifier}+V`)
  await expect(email).toHaveValue(emailValue)
})

test("sends password recovery through the callback and preserves the target", async ({
  page,
}) => {
  let recoveryRequestUrl = ""
  let recoveryRequestBody: Record<string, unknown> | null = null
  await page.route("**/auth/v1/recover**", async (route) => {
    recoveryRequestUrl = route.request().url()
    const requestBody = route.request().postData()
    recoveryRequestBody = requestBody
      ? (JSON.parse(requestBody) as Record<string, unknown>)
      : null
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    })
  })

  await page.goto("/login?next=%2Feditor%2Fresume-1")
  await page.getByRole("link", { name: "忘记密码" }).click()
  await expect(page).toHaveURL(/\/forgot-password\?next=%2Feditor%2Fresume-1$/)
  await page.getByLabel("邮箱").fill("recovery@example.com")
  await page.getByRole("button", { name: "发送重置邮件" }).click()

  const recoveryNotice = "如该邮箱已注册，密码重置邮件将很快送达。"
  await expect(
    page.getByRole("status").filter({ hasText: recoveryNotice }),
  ).toBeVisible()
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: recoveryNotice }),
  ).toBeVisible()
  expect(recoveryRequestBody).toEqual(
    expect.objectContaining({ email: "recovery@example.com" }),
  )

  const redirectTo = new URL(recoveryRequestUrl).searchParams.get("redirect_to")
  expect(redirectTo).not.toBeNull()
  const callbackUrl = new URL(redirectTo ?? "")
  expect(callbackUrl.pathname).toBe("/auth/callback")
  expect(callbackUrl.searchParams.get("next")).toBe(
    "/reset-password?next=%2Feditor%2Fresume-1",
  )
})

test("requires at least eight characters when resetting a password", async ({
  page,
}) => {
  await page.goto("/reset-password?next=%2Fworkspace")

  const password = page.getByLabel("新密码", { exact: true })
  const confirmation = page.getByLabel("确认新密码", { exact: true })
  await expect(password).toHaveAttribute("minlength", "8")
  await expect(password).toHaveAttribute(
    "placeholder",
    "至少 8 位，建议组合字母、数字和符号",
  )
  await expect(confirmation).toHaveAttribute("minlength", "8")
  await expect(confirmation).toHaveAttribute("placeholder", "再次输入新密码")

  await password.fill("Short12")
  await confirmation.fill("Short12")
  await page.getByRole("button", { name: "更新密码" }).click()
  await expect(
    page.getByRole("alert").filter({ hasText: "密码至少需要 8 位" }),
  ).toBeVisible()
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "密码至少需要 8 位" }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/reset-password\?next=%2Fworkspace$/)
})

test("keeps password login and registration as lightweight alternatives", async ({
  page,
}) => {
  let signupRequestCount = 0
  await page.route("**/auth/v1/signup**", async (route) => {
    signupRequestCount += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    })
  })
  await page.goto("/login")

  const password = page.locator("#password")
  await expect(password).toHaveAttribute("type", "password")
  await expect(password).not.toHaveAttribute("minlength")
  await page.getByRole("button", { name: "显示密码" }).click()
  await expect(password).toHaveAttribute("type", "text")

  await page.getByRole("button", { name: "没有账号？创建账户" }).click()
  const registerButton = page.getByRole("button", { name: /注册并发送确认链接/ })
  const confirmation = page.locator("#password-confirmation")
  await expect(registerButton).toBeDisabled()
  await expect(page.getByRole("button", { name: "已有账号？返回登录" })).toBeVisible()
  await expect(password).toHaveAttribute(
    "placeholder",
    "至少 8 位，建议组合字母、数字和符号",
  )
  await expect(password).toHaveAttribute("minlength", "8")
  await expect(confirmation).toHaveAttribute("placeholder", "再次输入密码")
  await expect(page.getByText("强度：待输入")).toBeVisible()

  const strength = page.locator(".auth-password-strength")
  await password.fill("simple")
  await expect(page.getByText("强度：弱")).toBeVisible()
  const weakColor = await strength.evaluate(
    (element) => getComputedStyle(element).color,
  )
  await password.fill("Medium12")
  await expect(page.getByText("强度：中")).toBeVisible()
  const mediumColor = await strength.evaluate(
    (element) => getComputedStyle(element).color,
  )
  await password.fill("StrongPass1!")
  await expect(page.getByText("强度：强")).toBeVisible()
  const strongColor = await strength.evaluate(
    (element) => getComputedStyle(element).color,
  )
  expect(new Set([weakColor, mediumColor, strongColor]).size).toBe(3)
  const fontSizes = await password.evaluate((input) => ({
    input: Number.parseFloat(getComputedStyle(input).fontSize),
    placeholder: Number.parseFloat(getComputedStyle(input, "::placeholder").fontSize),
  }))
  expect(fontSizes.placeholder).toBeLessThan(fontSizes.input)

  await password.fill("StrongPass1!")
  await confirmation.fill("StrongPass1!")
  await page.getByLabel("邮箱").fill("member@example.com")
  await page.getByRole("checkbox", { name: "我已阅读并同意" }).click()
  await expect(registerButton).toBeEnabled()
  await registerButton.click()
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "请使用 QQ、网易、Gmail、Outlook 等常用邮箱注册" }),
  ).toBeVisible()
  expect(signupRequestCount).toBe(0)

  await password.fill("Short12")
  await confirmation.fill("Short12")
  await page.getByLabel("邮箱").fill("registration-check@qq.com")
  await expect(registerButton).toBeEnabled()
  await registerButton.click()
  await expect(
    page.getByRole("alert").filter({ hasText: "密码至少需要 8 位" }),
  ).toBeVisible()
  await expect(password).toHaveAttribute("aria-invalid", "true")

  await password.fill("StrongPass1!")
  await confirmation.fill("different")
  await registerButton.click()
  const confirmationError = page
    .getByRole("alert")
    .filter({ hasText: "两次输入的密码不一致" })
  await expect(confirmationError).toBeVisible()
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: "两次输入的密码不一致" }),
  ).toBeVisible()
  await expect(confirmation).toHaveAttribute("aria-invalid", "true")
  const confirmationLabel = page
    .locator('[data-slot="field"]')
    .filter({ has: confirmation })
    .locator('[data-slot="field-label"]')
  const [labelColor, errorColor] = await Promise.all([
    confirmationLabel.evaluate((element) => getComputedStyle(element).color),
    confirmationError.evaluate((element) => getComputedStyle(element).color),
  ])
  expect(labelColor).not.toBe(errorColor)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByRole("button", { name: "没有账号？创建账户" }).click()
  const mobileAudit = await page.locator(".auth-form").evaluate((form) => {
    const button = form.querySelector<HTMLElement>(".auth-primary-action")
    const legal = form.querySelector<HTMLElement>(".auth-legal-notice")
    const formRect = form.getBoundingClientRect()
    const buttonRect = button?.getBoundingClientRect()
    const legalRect = legal?.getBoundingClientRect()
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      buttonWidth: buttonRect?.width ?? 0,
      formWidth: formRect.width,
      legalLeftDelta: Math.abs((legalRect?.left ?? 0) - formRect.left),
    }
  })
  expect(mobileAudit.pageWidth).toBeLessThanOrEqual(mobileAudit.viewportWidth + 1)
  expect(mobileAudit.buttonWidth).toBeCloseTo(mobileAudit.formWidth, 0)
  expect(mobileAudit.legalLeftDelta).toBeLessThanOrEqual(1)
  await expect(page.locator("#password-confirmation")).toBeVisible()
})

test("announces a sent registration confirmation link with a toast", async ({
  page,
}) => {
  let signupRequestCount = 0
  await page.route("**/auth/v1/signup**", async (route) => {
    signupRequestCount += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    })
  })
  await page.goto("/login")
  await page.getByRole("button", { name: "没有账号？创建账户" }).click()
  await page.getByLabel("邮箱").fill("toast-check@qq.com")
  await page.locator("#password").fill("StrongPass1!")
  await page.locator("#password-confirmation").fill("StrongPass1!")
  await page.getByRole("checkbox", { name: "我已阅读并同意" }).click()
  await page.getByRole("button", { name: /注册并发送确认链接/ }).click()

  const notice = "确认链接已发送，请打开邮箱中的链接完成登录。"
  await expect(page.getByRole("status").filter({ hasText: notice })).toBeVisible()
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: notice }),
  ).toBeVisible()
  expect(signupRequestCount).toBe(1)
})

test("handles a non-JSON Preview failure without exposing a parse error", async ({
  page,
}) => {
  await page.route("**/api/auth/preview", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "text/plain",
      body: "Internal Server Error",
    })
  })
  await page.goto("/login")

  await page.getByRole("button", { name: "Preview" }).click()
  await expect(
    page.getByRole("alert").filter({ hasText: "Preview 模式暂不可用，请稍后重试" }),
  ).toBeVisible()
  await expect(
    page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "Preview 模式暂不可用，请稍后重试" }),
  ).toBeVisible()
  await expect(page.getByText(/Unexpected token|Internal Server Error/)).toHaveCount(0)
})

test("keeps the animated login layout contained and respects reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/login")

  const audit = await page.evaluate(() => {
    const entry = document.querySelector<HTMLElement>(".auth-entry")
    const paper = document.querySelector<HTMLElement>(".auth-paper-front")
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      entryAnimation: entry ? window.getComputedStyle(entry).animationName : null,
      paperAnimation: paper ? window.getComputedStyle(paper).animationName : null,
    }
  })

  expect(audit.pageWidth).toBeLessThanOrEqual(audit.viewportWidth + 1)
  expect(audit.entryAnimation).toBe("none")
  expect(audit.paperAnimation).toBe("none")
})
