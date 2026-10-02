"use client"

import { ShieldCheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FormEvent, useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Spinner } from "../../components/ui/spinner"
import { createClient } from "../../lib/supabase/client"
import { getAuthErrorMessage } from "./auth-error"
import { minimumPasswordLength } from "./password-policy"

export function ResetPasswordForm({ nextPath }: { nextPath: string }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError("")
    const formData = new FormData(event.currentTarget)
    const password = String(formData.get("password") ?? "")
    const confirmation = String(formData.get("confirmation") ?? "")
    if (password.length < minimumPasswordLength) {
      setError(`密码至少需要 ${minimumPasswordLength} 位`)
      setIsSubmitting(false)
      return
    }
    if (password !== confirmation) {
      setError("两次输入的密码不一致")
      setIsSubmitting(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        throw updateError
      }
      router.replace(nextPath)
      router.refresh()
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-password">新密码</FieldLabel>
          <Input
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={minimumPasswordLength}
            placeholder="至少 8 位，建议组合字母、数字和符号"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password-confirmation">确认新密码</FieldLabel>
          <Input
            id="password-confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={minimumPasswordLength}
            placeholder="再次输入新密码"
            required
          />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <ShieldCheckIcon data-icon="inline-start" />
          )}
          更新密码
        </Button>
      </FieldGroup>
    </form>
  )
}
