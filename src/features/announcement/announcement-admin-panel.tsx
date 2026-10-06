"use client"

import {
  ArrowLeftIcon,
  MegaphoneIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { FieldDescription, FieldLabel } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Spinner } from "../../components/ui/spinner"
import { Switch } from "../../components/ui/switch"
import { Textarea } from "../../components/ui/textarea"
import type { AnnouncementOverview } from "../../server/domain/announcement-service"
import {
  type AnnouncementInput,
  type AnnouncementLevel,
  announcementInputSchema,
  announcementLevels,
  createEmptyAnnouncementInput,
  maximumAnnouncementCount,
} from "../../shared/announcement/announcement-schema"
import {
  AnnouncementApiError,
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from "./announcement-api"
import {
  type AnnouncementRow,
  isRowDirty,
  mergeRows,
  toInput,
  toRows,
} from "./announcement-rows"
import { formatAnnouncementWindow } from "./announcement-time"
import { AnnouncementTimeField } from "./announcement-time-field"

const levelLabels: Record<AnnouncementLevel, string> = {
  info: "通知",
  success: "好消息",
  warning: "提醒",
  danger: "重要",
}

function describeError(error: unknown): string {
  if (error instanceof AnnouncementApiError) {
    return error.message
  }
  return error instanceof Error ? error.message : "操作失败，请稍后重试"
}

/**
 * 面板的一行。
 *
 * `id` 为 null 表示这是一行尚未落库的新草稿：点「新建公告」只插入本地行，
 * 填完内容点保存才真正写入。写入服务端的公告必须通过 Schema（标题和正文非空），
 * 先建空记录再补内容会在第一步就被 422 拒绝，还会留下垃圾数据。
 * `saved` 记录服务端原值，用于判断是否有改动、退出编辑时回滚。
 */
/** 列表视图与表单视图共用同一套行模型与合并规则，见 announcement-rows.ts。 */

/**
 * 表单里的一行：左标签、右控件，说明文字落在控件正下方。
 *
 * 不用 Field 的 horizontal 变体：它给标签加 `flex-auto`，标签列宽度会随文案
 * 长度漂移。这里把标签列和说明行都交给外层 grid 的 subgrid，
 * 同一分组内控件左边缘连成一条直线，跨分组也保持同一列宽。
 */
function AnnouncementFormRow({
  id,
  label,
  invalid,
  description,
  children,
}: {
  id: string
  label: string
  invalid?: boolean
  description?: string
  children: ReactNode
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: 需要 fieldset 语义，但 fieldset 盒子不支持 subgrid，会让标签列和控件列错位。
    <div
      className="announcement-admin-row"
      role="group"
      data-invalid={invalid ? "true" : undefined}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </div>
  )
}

/** 表单的一个类别分组。 */
function AnnouncementFormSection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <section className="announcement-admin-section">
      <header>
        <h3>{title}</h3>
        <p>{hint}</p>
      </header>
      <div className="announcement-admin-rows">{children}</div>
    </section>
  )
}

/**
 * 公告表单，按内容、链接、展示、生效时间四类分组。
 *
 * 只在「新建公告」或某条公告的「编辑」被点开时挂载，其余时间面板停在列表：
 * 公告多的时候同时铺开所有表单会把抽屉变成一堵墙，也看不出哪条改了。
 */
function AnnouncementForm({
  draft,
  invalidFields,
  blockingIssue,
  dirty,
  pending,
  onChange,
  onSave,
}: {
  draft: AnnouncementInput
  invalidFields: ReadonlySet<string>
  blockingIssue: string | null
  dirty: boolean
  pending: boolean
  onChange: (next: AnnouncementInput) => void
  onSave: () => void
}) {
  const prefix = "announcement-form"

  return (
    <div className="announcement-admin-fields" data-testid="announcement-form">
      <AnnouncementFormSection title="内容" hint="轮播里最先被读到的是标题和正文。">
        <AnnouncementFormRow id={`${prefix}-level`} label="级别">
          <Select
            value={draft.level}
            onValueChange={(level) =>
              onChange({ ...draft, level: level as AnnouncementLevel })
            }
          >
            <SelectTrigger id={`${prefix}-level`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {announcementLevels.map((level) => (
                <SelectItem key={level} value={level}>
                  {levelLabels[level]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AnnouncementFormRow>

        <AnnouncementFormRow
          id={`${prefix}-title`}
          label="标题"
          invalid={invalidFields.has("title")}
        >
          <Input
            id={`${prefix}-title`}
            value={draft.title}
            maxLength={80}
            placeholder="一句话说明这条公告"
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
          />
        </AnnouncementFormRow>

        <AnnouncementFormRow
          id={`${prefix}-body`}
          label="正文"
          invalid={invalidFields.has("body")}
        >
          <Textarea
            id={`${prefix}-body`}
            value={draft.body}
            maxLength={240}
            rows={3}
            placeholder="补充背景、影响范围或处理建议。"
            onChange={(event) => onChange({ ...draft, body: event.target.value })}
          />
        </AnnouncementFormRow>
      </AnnouncementFormSection>

      <AnnouncementFormSection
        title="链接"
        hint="两项都需要填写，只允许站内路径或 http(s) 地址。"
      >
        <AnnouncementFormRow
          id={`${prefix}-link-label`}
          label="链接文案"
          invalid={invalidFields.has("linkLabel")}
        >
          <Input
            id={`${prefix}-link-label`}
            value={draft.linkLabel}
            maxLength={24}
            placeholder="选填，例如「查看详情」"
            onChange={(event) => onChange({ ...draft, linkLabel: event.target.value })}
          />
        </AnnouncementFormRow>

        <AnnouncementFormRow
          id={`${prefix}-link-href`}
          label="公告链接"
          invalid={invalidFields.has("linkHref")}
        >
          <Input
            id={`${prefix}-link-href`}
            value={draft.linkHref}
            maxLength={500}
            placeholder="选填，例如 /terms"
            onChange={(event) => onChange({ ...draft, linkHref: event.target.value })}
          />
        </AnnouncementFormRow>
      </AnnouncementFormSection>

      <AnnouncementFormSection
        title="展示"
        hint="控制这条公告是否出现在轮播里，以及出现顺序。"
      >
        <AnnouncementFormRow
          id={`${prefix}-enabled`}
          label="启用"
          description="停用后对所有用户隐藏，已保存内容不受影响。"
        >
          <div className="announcement-admin-switch">
            <Switch
              id={`${prefix}-enabled`}
              checked={draft.enabled}
              onCheckedChange={(enabled) => onChange({ ...draft, enabled })}
            />
          </div>
        </AnnouncementFormRow>

        <AnnouncementFormRow
          id={`${prefix}-sort-order`}
          label="排序权重"
          invalid={invalidFields.has("sortOrder")}
          description="数值越小越靠前。"
        >
          <Input
            id={`${prefix}-sort-order`}
            type="number"
            min={0}
            max={999}
            value={draft.sortOrder}
            onChange={(event) => {
              const parsed = Number(event.target.value)
              onChange({
                ...draft,
                sortOrder: Number.isFinite(parsed) ? parsed : draft.sortOrder,
              })
            }}
          />
        </AnnouncementFormRow>
      </AnnouncementFormSection>

      <AnnouncementFormSection
        title="生效时间"
        hint="留空表示不设边界；结束时间必须晚于开始时间。"
      >
        <AnnouncementTimeField
          id={`${prefix}-starts-at`}
          label="开始时间"
          value={draft.startsAt}
          invalid={invalidFields.has("startsAt")}
          onChange={(startsAt) => onChange({ ...draft, startsAt })}
        />
        <AnnouncementTimeField
          id={`${prefix}-ends-at`}
          label="结束时间"
          value={draft.endsAt}
          invalid={invalidFields.has("endsAt")}
          onChange={(endsAt) => onChange({ ...draft, endsAt })}
        />
      </AnnouncementFormSection>

      <footer className="announcement-admin-actions">
        {blockingIssue ? (
          <output className="announcement-admin-issue">{blockingIssue}</output>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={pending || !dirty || Boolean(blockingIssue)}
          onClick={onSave}
          data-testid="announcement-save"
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          保存
        </Button>
      </footer>
    </div>
  )
}

/**
 * 管理员公告配置面板体。
 *
 * 全量列表由工作台服务端组件作为 props 下发，权限判断落在页面边界，
 * 服务端不会为普通成员渲染这个组件。写操作仍由 API 独立强制 `isAdmin`，
 * 因此这里不能被当成授权依据。
 *
 * 抽屉外壳在 `announcement-admin-entry.tsx`，本组件只负责列表与表单，
 * 并由入口按需动态加载。面板默认停在列表，表单按需挂载。
 */
export function AnnouncementAdminPanel({
  initialAnnouncements,
}: {
  initialAnnouncements: AnnouncementOverview
}) {
  const router = useRouter()
  const [rows, setRows] = useState<AnnouncementRow[]>(() =>
    toRows(initialAnnouncements),
  )
  // 正在编辑的行；null 表示停在列表。
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [pendingClientId, setPendingClientId] = useState<string | null>(null)
  const newRowCount = useRef(0)

  // 每次写操作都会 router.refresh()，服务端随之带回新的全量列表。
  // 合并规则见 mergeRows：服务端决定哪些行存在，本地决定每行的内容。
  useEffect(() => {
    setRows((current) => mergeRows(initialAnnouncements, current))
  }, [initialAnnouncements])

  const persistedCount = rows.filter((row) => row.id !== null).length
  const activeRow = rows.find((row) => row.clientId === editingClientId) ?? null

  function handleCreate() {
    newRowCount.current += 1
    const clientId = `new-${newRowCount.current}`
    setRows((current) => [
      ...current,
      {
        clientId,
        id: null,
        draft: createEmptyAnnouncementInput(),
        saved: null,
      },
    ])
    setEditingClientId(clientId)
  }

  /**
   * 退出编辑。
   *
   * 新草稿直接丢弃：从未落库，留着只会让人以为配置已经生效。
   * 已保存的公告回滚到服务端值，否则下次点开编辑看到的是上次没保存的内容。
   */
  function handleLeaveEditor() {
    if (!activeRow) {
      setEditingClientId(null)
      return
    }
    setRows((current) =>
      current
        .map((row) =>
          row.clientId === activeRow.clientId && row.saved
            ? { ...row, draft: row.saved }
            : row,
        )
        .filter((row) => !(row.clientId === activeRow.clientId && row.id === null)),
    )
    setEditingClientId(null)
  }

  function handleChange(clientId: string, draft: AnnouncementInput) {
    setRows((current) =>
      current.map((row) => (row.clientId === clientId ? { ...row, draft } : row)),
    )
  }

  async function handleSave(row: AnnouncementRow) {
    // 直接复用服务端 Schema 做前置校验：
    // 与服务端同一份规则，避免管理员填完才收到 422。
    const parsed = announcementInputSchema.safeParse(row.draft)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      toast.error(firstIssue?.message ?? "公告内容不符合格式要求")
      return
    }

    setPendingClientId(row.clientId)
    try {
      const saved = row.id
        ? await updateAnnouncement(row.id, parsed.data)
        : await createAnnouncement(parsed.data)
      setRows((current) =>
        current.map((entry) =>
          entry.clientId === row.clientId
            ? {
                clientId: saved.id,
                id: saved.id,
                draft: toInput(saved),
                saved: toInput(saved),
              }
            : entry,
        ),
      )
      // 落库后的 clientId 会变成服务端 id，所以先退出编辑再刷新列表。
      setEditingClientId(null)
      toast.success(row.id ? "公告已更新" : "公告已创建")
    } catch (error) {
      toast.error(describeError(error))
    } finally {
      setPendingClientId(null)
      router.refresh()
    }
  }

  async function handleDelete(row: AnnouncementRow) {
    // 未落库的行只清掉本地状态，不需要请求服务端。
    if (row.id === null) {
      setRows((current) => current.filter((entry) => entry.clientId !== row.clientId))
      return
    }
    setPendingClientId(row.clientId)
    try {
      await deleteAnnouncement(row.id)
      setRows((current) => current.filter((entry) => entry.clientId !== row.clientId))
      toast.success("公告已删除")
    } catch (error) {
      toast.error(describeError(error))
    } finally {
      setPendingClientId(null)
      router.refresh()
    }
  }

  if (activeRow) {
    // 复用服务端 Schema 判定能否保存与哪些字段有问题：
    // 与服务端同一份规则，避免出现「按钮可点但必然 422」的死路。
    const validation = announcementInputSchema.safeParse(activeRow.draft)
    const blockingIssue = validation.success
      ? null
      : (validation.error.issues[0]?.message ?? "公告内容不符合格式要求")
    const invalidFields = new Set(
      validation.success
        ? []
        : validation.error.issues.map((issue) => String(issue.path[0])),
    )
    const isDirty = isRowDirty(activeRow)
    const isCreating = activeRow.id === null

    return (
      <div className="announcement-admin-panel">
        <div className="announcement-admin-toolbar">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleLeaveEditor}
            data-testid="announcement-cancel"
          >
            <ArrowLeftIcon data-icon="inline-start" />
            {isCreating ? "放弃草稿" : "返回列表"}
          </Button>
          <strong>{isCreating ? "新建公告" : "编辑公告"}</strong>
        </div>

        <AnnouncementForm
          draft={activeRow.draft}
          invalidFields={invalidFields}
          blockingIssue={blockingIssue}
          dirty={isDirty}
          pending={pendingClientId === activeRow.clientId}
          onChange={(next) => handleChange(activeRow.clientId, next)}
          onSave={() => void handleSave(activeRow)}
        />
      </div>
    )
  }

  return (
    <div className="announcement-admin-panel" data-testid="announcement-admin-body">
      <div className="announcement-admin-toolbar">
        <Badge variant="outline">
          <MegaphoneIcon data-icon="inline-start" />
          {persistedCount} / {maximumAnnouncementCount}
        </Badge>
        <Button
          type="button"
          size="sm"
          disabled={persistedCount >= maximumAnnouncementCount}
          onClick={handleCreate}
          data-testid="announcement-create"
        >
          <PlusIcon data-icon="inline-start" />
          新建公告
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="announcement-admin-empty">
          还没有公告，点击「新建公告」开始配置。
        </p>
      ) : null}

      <div className="announcement-admin-list">
        {rows.map((row) => {
          const isPending = pendingClientId === row.clientId
          return (
            <article className="announcement-admin-item" key={row.clientId}>
              <div className="announcement-admin-item-head">
                <Badge variant={row.draft.enabled ? "secondary" : "outline"}>
                  {levelLabels[row.draft.level]}
                </Badge>
                <strong>{row.draft.title || "未命名公告"}</strong>
                {row.id === null ? <Badge variant="outline">未保存</Badge> : null}
                {!row.draft.enabled ? <Badge variant="outline">已停用</Badge> : null}
              </div>
              {row.draft.body ? (
                <p className="announcement-admin-item-body">{row.draft.body}</p>
              ) : null}
              <dl className="announcement-admin-item-meta">
                <div>
                  <dt>排序</dt>
                  <dd>{row.draft.sortOrder}</dd>
                </div>
                <div>
                  <dt>生效</dt>
                  <dd>
                    {formatAnnouncementWindow(row.draft.startsAt, row.draft.endsAt)}
                  </dd>
                </div>
              </dl>
              <div className="announcement-admin-item-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setEditingClientId(row.clientId)}
                  data-testid="announcement-edit"
                >
                  <PencilIcon data-icon="inline-start" />
                  编辑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => void handleDelete(row)}
                  data-testid="announcement-delete"
                >
                  <Trash2Icon data-icon="inline-start" />
                  {row.id === null ? "放弃" : "删除"}
                </Button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
