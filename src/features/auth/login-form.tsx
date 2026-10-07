"use client"

import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  MailCheckIcon,
  MonitorPlayIcon,
  SendIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import { Checkbox } from "../../components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Spinner } from "../../components/ui/spinner"
import { createClient } from "../../lib/supabase/client"
import { getAuthErrorMessage } from "./auth-error"
import { isAllowedRegistrationEmail, isValidEmail } from "./email-policy"
import { minimumPasswordLength } from "./password-policy"

type AuthMode = "otp" | "password"
type PasswordMode = "login" | "register"
type AuthErrorField =
  | "password-email"
  | "password"
  | "password-confirmation"
  | "otp-email"
  | "otp-token"
type PreviewLoginPayload = {
  data?: { workspaceUrl?: string }
  error?: { message?: string }
}

const otpResendCooldownSeconds = 60

function getPasswordStrength(password: string): {
  level: "empty" | "weak" | "medium" | "strong"
  label: string
  score: number
} {
  if (!password) {
    return { level: "empty", label: "待输入", score: 0 }
  }

  const score = [
    password.length >= minimumPasswordLength,
    password.length >= 10,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  if (score <= 2) {
    return { level: "weak", label: "弱", score: 1 }
  }
  if (score <= 4) {
    return { level: "medium", label: "中", score: 2 }
  }
  return { level: "strong", label: "强", score: 3 }
}

function AuthFieldLabel({
  htmlFor,
  label,
  error,
  aside,
}: {
  htmlFor: string
  label: string
  error?: string
  aside?: React.ReactNode
}) {
  return (
    <div className="auth-field-label-row">
      <div className="auth-field-heading">
        <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
        {error ? (
          <FieldError className="auth-inline-error" id={`${htmlFor}-error`}>
            {error}
          </FieldError>
        ) : null}
      </div>
      {aside}
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const strength = getPasswordStrength(password)
  return (
    <output
      className="auth-password-strength"
      data-level={strength.level}
      aria-live="polite"
    >
      <span className="auth-password-strength-bars" aria-hidden="true">
        {[1, 2, 3].map((value) => (
          <i key={value} data-active={value <= strength.score} />
        ))}
      </span>
      强度：{strength.label}
    </output>
  )
}

function AuthFeedback({ error, message }: { error: string; message: string }) {
  if (error) {
    return <FieldError className="auth-feedback">{error}</FieldError>
  }
  if (message) {
    return (
      <FieldDescription className="auth-feedback" role="status">
        {message}
      </FieldDescription>
    )
  }
  return null
}

function AuthLegalAgreement({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field className="auth-legal-notice" orientation="horizontal">
      <Checkbox
        id="auth-legal-acceptance"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <div className="auth-legal-copy">
        <label htmlFor="auth-legal-acceptance">我已阅读并同意</label>
        <Link href="/terms">《服务条款》</Link>
        <span>与</span>
        <Link href="/privacy">《隐私政策》</Link>
      </div>
    </Field>
  )
}

async function readPreviewLoginPayload(
  response: Response,
): Promise<PreviewLoginPayload | null> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return null
  }
  try {
    return (await response.json()) as PreviewLoginPayload
  } catch {
    return null
  }
}

export function LoginForm({
  nextPath,
  initialError = "",
}: {
  nextPath: string
  initialError?: string
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [authMode, setAuthMode] = useState<AuthMode>("password")
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("login")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isPreviewSubmitting, setIsPreviewSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false)
  const [passwordValue, setPasswordValue] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [otpEmail, setOtpEmail] = useState("")
  const [otpToken, setOtpToken] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [acceptedLegalTerms, setAcceptedLegalTerms] = useState(false)
  const [fieldError, setFieldError] = useState<{
    field: AuthErrorField
    message: string
  } | null>(initialError ? { field: "password-email", message: initialError } : null)
  const [generalError, setGeneralError] = useState("")
  const [message, setMessage] = useState("")
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) {
      return
    }
    const timer = window.setTimeout(() => {
      setCooldown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  function clearFeedback() {
    setFieldError(null)
    setGeneralError("")
    setMessage("")
  }

  function showFieldError(field: AuthErrorField, message: string) {
    setFieldError({ field, message })
    toast.error(message)
  }

  function showGeneralError(message: string) {
    setGeneralError(message)
    toast.error(message)
  }

  function showMessage(message: string) {
    setMessage(message)
    toast.success(message)
  }

  function clearFieldFeedback(field: AuthErrorField) {
    setFieldError((current) => (current?.field === field ? null : current))
    setGeneralError("")
    setMessage("")
  }

  function getFieldError(field: AuthErrorField): string | undefined {
    return fieldError?.field === field ? fieldError.message : undefined
  }

  function ensureLegalAcceptance(): boolean {
    if (acceptedLegalTerms) {
      return true
    }
    showGeneralError("请先阅读并同意《服务条款》与《隐私政策》")
    return false
  }

  function selectAuthMode(mode: AuthMode) {
    setAuthMode(mode)
    clearFeedback()
  }

  function getCallbackUrl(): string {
    const callbackUrl = new URL("/auth/callback", window.location.origin)
    callbackUrl.searchParams.set("next", nextPath)
    return callbackUrl.toString()
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    if (!ensureLegalAcceptance()) {
      return
    }
    setIsSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    if (!isValidEmail(email)) {
      showFieldError("password-email", "请输入有效邮箱")
      setIsSubmitting(false)
      return
    }
    if (passwordMode === "register" && !isAllowedRegistrationEmail(email)) {
      showFieldError("password-email", "请使用 QQ、网易、Gmail、Outlook 等常用邮箱注册")
      setIsSubmitting(false)
      return
    }
    if (!password) {
      showFieldError("password", "请输入密码")
      setIsSubmitting(false)
      return
    }
    if (passwordMode === "register" && password.length < minimumPasswordLength) {
      showFieldError("password", `密码至少需要 ${minimumPasswordLength} 位`)
      setIsSubmitting(false)
      return
    }
    if (passwordMode === "register" && password !== passwordConfirmation) {
      showFieldError("password-confirmation", "两次输入的密码不一致")
      setIsSubmitting(false)
      return
    }

    try {
      if (passwordMode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getCallbackUrl() },
        })
        if (signUpError) {
          throw signUpError
        }
        if (data.session) {
          await supabase.auth.signOut()
        }
        showMessage("确认链接已发送，请打开邮箱中的链接完成登录。")
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        throw signInError
      }
      toast.success("登录成功")
      router.replace(nextPath)
      router.refresh()
    } catch (submitError) {
      const errorMessage = getAuthErrorMessage(submitError)
      showFieldError(
        passwordMode === "register" && /邮箱|注册/.test(errorMessage)
          ? "password-email"
          : "password",
        errorMessage,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSendOtp() {
    const email = otpEmail.trim()
    clearFeedback()
    if (!ensureLegalAcceptance()) {
      return
    }
    if (!isValidEmail(email)) {
      showFieldError("otp-email", "请输入有效邮箱后再获取验证码")
      return
    }

    setIsSendingOtp(true)
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getCallbackUrl(),
          shouldCreateUser: false,
        },
      })
      if (otpError) {
        throw otpError
      }
      setOtpEmail(email)
      setOtpSent(true)
      setCooldown(otpResendCooldownSeconds)
      toast.success("验证码已发送，请查收邮箱")
    } catch (submitError) {
      showFieldError("otp-email", getAuthErrorMessage(submitError))
    } finally {
      setIsSendingOtp(false)
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = otpEmail.trim()
    const token = otpToken.trim()
    clearFeedback()
    if (!ensureLegalAcceptance()) {
      return
    }
    if (!isValidEmail(email)) {
      showFieldError("otp-email", "请输入有效邮箱")
      return
    }
    if (!/^\d+$/.test(token)) {
      showFieldError("otp-token", "请输入数字验证码")
      return
    }

    setIsSubmitting(true)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      })
      if (verifyError) {
        throw verifyError
      }
      toast.success("登录成功")
      router.replace(nextPath)
      router.refresh()
    } catch (submitError) {
      showFieldError("otp-token", getAuthErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePreviewLogin() {
    setIsPreviewSubmitting(true)
    clearFeedback()
    try {
      const response = await fetch("/api/auth/preview", { method: "POST" })
      const payload = await readPreviewLoginPayload(response)
      if (!response.ok || !payload) {
        throw new Error(payload?.error?.message ?? "Preview 模式暂不可用，请稍后重试")
      }
      toast.success("已进入 Preview 模式")
      router.replace(payload.data?.workspaceUrl ?? "/workspace")
      router.refresh()
    } catch (previewError) {
      showGeneralError(
        previewError instanceof Error
          ? previewError.message
          : "Preview 模式暂不可用，请稍后重试",
      )
      setIsPreviewSubmitting(false)
    }
  }

  return (
    <div className="auth-panel">
      <fieldset className="auth-mode-switch">
        <legend className="sr-only">选择登录方式</legend>
        <button
          type="button"
          aria-pressed={authMode === "password"}
          disabled={isSubmitting || isSendingOtp}
          onClick={() => selectAuthMode("password")}
        >
          账号密码登录
        </button>
        <button
          type="button"
          aria-pressed={authMode === "otp"}
          disabled={isSubmitting || isSendingOtp}
          onClick={() => selectAuthMode("otp")}
        >
          邮箱验证码登录
        </button>
      </fieldset>

      <div className="auth-form-stage" key={authMode}>
        {authMode === "password" ? (
          <form className="auth-form" noValidate onSubmit={handlePasswordSubmit}>
            <FieldGroup>
              <Field data-invalid={Boolean(getFieldError("password-email"))}>
                <AuthFieldLabel
                  htmlFor="password-email"
                  label="邮箱"
                  error={getFieldError("password-email")}
                />
                <Input
                  id="password-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  aria-invalid={Boolean(getFieldError("password-email"))}
                  aria-describedby={
                    getFieldError("password-email") ? "password-email-error" : undefined
                  }
                  onChange={() => clearFieldFeedback("password-email")}
                  required
                />
              </Field>
              <Field data-invalid={Boolean(getFieldError("password"))}>
                <AuthFieldLabel
                  htmlFor="password"
                  label="密码"
                  error={getFieldError("password")}
                  aside={
                    passwordMode === "register" ? (
                      <PasswordStrength password={passwordValue} />
                    ) : undefined
                  }
                />
                <div className="auth-password-field">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      passwordMode === "login" ? "current-password" : "new-password"
                    }
                    value={passwordValue}
                    minLength={
                      passwordMode === "register" ? minimumPasswordLength : undefined
                    }
                    placeholder={
                      passwordMode === "login"
                        ? "请输入登录密码"
                        : "至少 8 位，建议组合字母、数字和符号"
                    }
                    aria-invalid={Boolean(getFieldError("password"))}
                    aria-describedby={
                      getFieldError("password") ? "password-error" : undefined
                    }
                    onChange={(event) => {
                      setPasswordValue(event.target.value)
                      clearFieldFeedback("password")
                    }}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? (
                      <EyeOffIcon data-icon="only" />
                    ) : (
                      <EyeIcon data-icon="only" />
                    )}
                  </Button>
                </div>
              </Field>
              {passwordMode === "register" ? (
                <Field data-invalid={Boolean(getFieldError("password-confirmation"))}>
                  <AuthFieldLabel
                    htmlFor="password-confirmation"
                    label="确认密码"
                    error={getFieldError("password-confirmation")}
                  />
                  <div className="auth-password-field">
                    <Input
                      id="password-confirmation"
                      name="password-confirmation"
                      type={showPasswordConfirmation ? "text" : "password"}
                      autoComplete="new-password"
                      value={passwordConfirmation}
                      placeholder="再次输入密码"
                      aria-invalid={Boolean(getFieldError("password-confirmation"))}
                      aria-describedby={
                        getFieldError("password-confirmation")
                          ? "password-confirmation-error"
                          : undefined
                      }
                      onChange={(event) => {
                        setPasswordConfirmation(event.target.value)
                        clearFieldFeedback("password-confirmation")
                      }}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        showPasswordConfirmation ? "隐藏确认密码" : "显示确认密码"
                      }
                      onClick={() => setShowPasswordConfirmation((value) => !value)}
                    >
                      {showPasswordConfirmation ? (
                        <EyeOffIcon data-icon="only" />
                      ) : (
                        <EyeIcon data-icon="only" />
                      )}
                    </Button>
                  </div>
                </Field>
              ) : null}
              <AuthFeedback error={generalError} message={message} />
              <AuthLegalAgreement
                checked={acceptedLegalTerms}
                onCheckedChange={(checked) => {
                  setAcceptedLegalTerms(checked)
                  if (checked) {
                    clearFeedback()
                  }
                }}
              />
              <Button
                className="auth-primary-action"
                type="submit"
                disabled={isSubmitting || !acceptedLegalTerms}
              >
                {isSubmitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <KeyRoundIcon data-icon="inline-start" />
                )}
                {passwordMode === "login" ? "登录" : "注册并发送确认链接"}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <div className="auth-form-links">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordMode((mode) => (mode === "login" ? "register" : "login"))
                    setPasswordValue("")
                    setPasswordConfirmation("")
                    setShowPassword(false)
                    setShowPasswordConfirmation(false)
                    clearFeedback()
                  }}
                >
                  {passwordMode === "login"
                    ? "没有账号？创建账户"
                    : "已有账号？返回登录"}
                </button>
                {passwordMode === "login" ? (
                  <Link href={`/forgot-password?next=${encodeURIComponent(nextPath)}`}>
                    忘记密码
                  </Link>
                ) : null}
              </div>
            </FieldGroup>
          </form>
        ) : (
          <form className="auth-form" noValidate onSubmit={handleOtpSubmit}>
            <FieldGroup>
              <Field data-invalid={Boolean(getFieldError("otp-email"))}>
                <AuthFieldLabel
                  htmlFor="otp-email"
                  label="邮箱"
                  error={getFieldError("otp-email")}
                />
                <Input
                  id="otp-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={otpEmail}
                  onChange={(event) => {
                    setOtpEmail(event.target.value)
                    setOtpSent(false)
                    setCooldown(0)
                    clearFeedback()
                  }}
                  placeholder="name@example.com"
                  aria-invalid={Boolean(getFieldError("otp-email"))}
                  aria-describedby={
                    getFieldError("otp-email") ? "otp-email-error" : undefined
                  }
                  required
                />
              </Field>
              <Field
                className="auth-otp-field"
                data-sent={otpSent}
                data-invalid={Boolean(getFieldError("otp-token"))}
              >
                <AuthFieldLabel
                  htmlFor="otp-token"
                  label="验证码"
                  error={getFieldError("otp-token")}
                  aside={
                    <button
                      className="auth-send-code"
                      type="button"
                      disabled={isSendingOtp || cooldown > 0 || !acceptedLegalTerms}
                      onClick={() => void handleSendOtp()}
                    >
                      {isSendingOtp ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <SendIcon data-icon="inline-start" />
                      )}
                      {cooldown > 0 ? `${cooldown}s 后重发` : "获取验证码"}
                    </button>
                  }
                />
                <Input
                  className="auth-otp-input"
                  id="otp-token"
                  name="token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]+"
                  value={otpToken}
                  onChange={(event) => {
                    setOtpToken(event.target.value.replace(/\D/g, ""))
                    clearFeedback()
                  }}
                  placeholder={otpSent ? "输入邮件中的数字验证码" : "请先获取验证码"}
                  aria-invalid={Boolean(getFieldError("otp-token"))}
                  aria-describedby={
                    getFieldError("otp-token") ? "otp-token-error" : undefined
                  }
                  required
                />
              </Field>
              <AuthFeedback error={generalError} message={message} />
              <AuthLegalAgreement
                checked={acceptedLegalTerms}
                onCheckedChange={(checked) => {
                  setAcceptedLegalTerms(checked)
                  if (checked) {
                    clearFeedback()
                  }
                }}
              />
              <Button
                className="auth-primary-action"
                type="submit"
                disabled={isSubmitting || !acceptedLegalTerms}
              >
                {isSubmitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <MailCheckIcon data-icon="inline-start" />
                )}
                验证并登录
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </FieldGroup>
          </form>
        )}
      </div>

      <div className="auth-preview-entry">
        <div>
          <strong>只想先看看？</strong>
          <span>无需账号，进入固定测试简历。</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPreviewSubmitting}
          onClick={() => void handlePreviewLogin()}
        >
          {isPreviewSubmitting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <MonitorPlayIcon data-icon="inline-start" />
          )}
          Preview
        </Button>
      </div>
    </div>
  )
}
