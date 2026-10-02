"use client"

import { useId } from "react"
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Textarea } from "../../components/ui/textarea"
import type { ResumeDocument } from "../../shared/resume-schema/resume-schema"

interface ProfileFormProps {
  document: ResumeDocument
  onChange: (document: ResumeDocument) => void
}

export function ProfileForm({ document, onChange }: ProfileFormProps) {
  const fieldPrefix = useId()
  const fieldId = (name: string) => `${fieldPrefix}-${name}`

  function updateProfile(field: keyof ResumeDocument["profile"], value: string) {
    onChange({
      ...document,
      profile: { ...document.profile, [field]: value },
    })
  }

  function updateTargetRole(value: string) {
    onChange({
      ...document,
      metadata: { ...document.metadata, targetRole: value },
    })
  }

  return (
    <div className="editor-form-section" data-editor-form-target>
      <header>
        <p>Profile</p>
        <h2>个人信息</h2>
        <span>建立清晰的职业定位与联系方式。</span>
      </header>
      <FieldGroup>
        <div className="editor-field-grid">
          <Field>
            <FieldLabel htmlFor={fieldId("name")}>姓名</FieldLabel>
            <Input
              id={fieldId("name")}
              value={document.profile.name}
              onChange={(event) => updateProfile("name", event.target.value)}
              placeholder="请输入姓名"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("headline")}>职业标题</FieldLabel>
            <Input
              id={fieldId("headline")}
              value={document.profile.headline}
              onChange={(event) => updateProfile("headline", event.target.value)}
              placeholder="例如：高级前端工程师"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("target-role")}>目标岗位</FieldLabel>
            <Input
              id={fieldId("target-role")}
              value={document.metadata.targetRole}
              onChange={(event) => updateTargetRole(event.target.value)}
              placeholder="例如：高级前端工程师"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("email")}>邮箱</FieldLabel>
            <Input
              id={fieldId("email")}
              type="email"
              value={document.profile.email}
              onChange={(event) => updateProfile("email", event.target.value)}
              placeholder="name@example.com"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("phone")}>电话</FieldLabel>
            <Input
              id={fieldId("phone")}
              value={document.profile.phone}
              onChange={(event) => updateProfile("phone", event.target.value)}
              placeholder="+86 138 0000 0000"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("location")}>所在地</FieldLabel>
            <Input
              id={fieldId("location")}
              value={document.profile.location}
              onChange={(event) => updateProfile("location", event.target.value)}
              placeholder="上海"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("website")}>个人网站</FieldLabel>
            <Input
              id={fieldId("website")}
              value={document.profile.website}
              onChange={(event) => updateProfile("website", event.target.value)}
              placeholder="https://example.com"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={fieldId("summary")}>个人摘要</FieldLabel>
          <Textarea
            id={fieldId("summary")}
            value={document.profile.summary}
            onChange={(event) => updateProfile("summary", event.target.value)}
            placeholder="用 2-3 句话说明你的专业方向、关键能力和价值。"
            rows={5}
          />
        </Field>
      </FieldGroup>
    </div>
  )
}
