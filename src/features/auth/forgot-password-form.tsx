"use client"

import { MailIcon } from "lucide-react"
import { type FormEvent, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
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

export function ForgotPasswordForm({ nextPath }: { nextPath: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError("")
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim()
    const callbackUrl = new URL("/auth/callback", window.location.origin)
    callbackUrl.searchParams.set(
      "next",
      `/reset-password?next=${encodeURIComponent(nextPath)}`,
    )

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl.toString(),
      })
      if (resetError) {
        throw resetError
      }
      setSent(true)
      toast.success("如该邮箱已注册，密码重置邮件将很快送达。")
    } catch (submitError) {
      const message = getAuthErrorMessage(submitError)
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reset-email">邮箱</FieldLabel>
          <Input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <FieldDescription>
            无论该邮箱是否存在，系统都会返回相同提示。
          </FieldDescription>
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        {sent ? (
          <FieldDescription role="status">
            如该邮箱已注册，密码重置邮件将很快送达。
          </FieldDescription>
        ) : null}
        <Button type="submit" disabled={isSubmitting || sent}>
          {isSubmitting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <MailIcon data-icon="inline-start" />
          )}
          发送重置邮件
        </Button>
      </FieldGroup>
    </form>
  )
}
