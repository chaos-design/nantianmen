"use client"

import { MegaphoneIcon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "../../components/ui/field"
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
  type Announcement,
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

const levelLabels: Record<AnnouncementLevel, string> = {
  info: "通知",
  success: "好消息",
  warning: "提醒",
  danger: "重要",
}

/** 时间输入框使用 datetime-local，需要在 UTC 与本地时间之间转换。 */
function toLocalInputValue(iso: string | null): string {
  if (!iso) {
    return ""
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const offsetAdjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetAdjusted.toISOString().slice(0, 16)
}

function toIsoValue(value: string): string | null {
  if (!value.trim()) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toInput(announcement: Announcement): AnnouncementInput {
  return {
    level: announcement.level,
    title: announcement.title,
    body: announcement.body,
    linkLabel: announcement.linkLabel,
    linkHref: announcement.linkHref,
    enabled: announcement.enabled,
    sortOrder: announcement.sortOrder,
    startsAt: announcement.startsAt,
    endsAt: announcement.endsAt,
  }
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
 * `saved` 记录服务端原值，用于判断是否有改动。
 */
interface AnnouncementRow {
  clientId: string
  id: string | null
  draft: AnnouncementInput
  saved: AnnouncementInput | null
}

function toRows(overview: AnnouncementOverview): AnnouncementRow[] {
  return overview.announcements.map((announcement) => {
    const input = toInput(announcement)
    return {
      clientId: announcement.id,
      id: announcement.id,
      draft: input,
      saved: input,
    }
  })
}

interface AnnouncementEditorProps {
  initial: AnnouncementInput
  onChange: (next: AnnouncementInput) => void
  idPrefix: string
}

function AnnouncementEditor({ initial, onChange, idPrefix }: AnnouncementEditorProps) {
  return (
    <div className="announcement-admin-fields">
      <Field orientation="horizontal">
        <FieldLabel htmlFor={`${idPrefix}-enabled`}>启用</FieldLabel>
        <FieldContent>
          <Switch
            id={`${idPrefix}-enabled`}
            checked={initial.enabled}
            onCheckedChange={(enabled) => onChange({ ...initial, enabled })}
          />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-level`}>级别</FieldLabel>
        <Select
          value={initial.level}
          onValueChange={(level) =>
            onChange({ ...initial, level: level as AnnouncementLevel })
          }
        >
          <SelectTrigger id={`${idPrefix}-level`} className="w-full">
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
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-title`}>标题</FieldLabel>
        <Input
          id={`${idPrefix}-title`}
          value={initial.title}
          maxLength={80}
          onChange={(event) => onChange({ ...initial, title: event.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-body`}>正文</FieldLabel>
        <Textarea
          id={`${idPrefix}-body`}
          value={initial.body}
          maxLength={240}
          onChange={(event) => onChange({ ...initial, body: event.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-link-label`}>链接文案</FieldLabel>
        <Input
          id={`${idPrefix}-link-label`}
          value={initial.linkLabel}
          maxLength={24}
          placeholder="选填，例如「查看详情」"
          onChange={(event) => onChange({ ...initial, linkLabel: event.target.value })}
        />
        <FieldDescription>
          填写链接文案时必须同时填写公告链接，只允许站内绝对路径或 http(s) 地址。
        </FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-link-href`}>公告链接</FieldLabel>
        <Input
          id={`${idPrefix}-link-href`}
          value={initial.linkHref}
          maxLength={500}
          placeholder="选填，例如 /terms"
          onChange={(event) => onChange({ ...initial, linkHref: event.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-sort-order`}>排序权重</FieldLabel>
        <Input
          id={`${idPrefix}-sort-order`}
          type="number"
          min={0}
          max={999}
          value={initial.sortOrder}
          onChange={(event) => {
            const parsed = Number(event.target.value)
            onChange({
              ...initial,
              sortOrder: Number.isFinite(parsed) ? parsed : initial.sortOrder,
            })
          }}
        />
        <FieldDescription>数值越小越靠前。</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-starts-at`}>开始时间</FieldLabel>
        <Input
          id={`${idPrefix}-starts-at`}
          type="datetime-local"
          value={toLocalInputValue(initial.startsAt)}
          onChange={(event) =>
            onChange({ ...initial, startsAt: toIsoValue(event.target.value) })
          }
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-ends-at`}>结束时间</FieldLabel>
        <Input
          id={`${idPrefix}-ends-at`}
          type="datetime-local"
          value={toLocalInputValue(initial.endsAt)}
          onChange={(event) =>
            onChange({ ...initial, endsAt: toIsoValue(event.target.value) })
          }
        />
      </Field>
    </div>
  )
}

/**
 * 管理员公告配置面板。
 *
 * 全量列表由工作台服务端组件作为 props 下发，权限判断落在页面边界，
 * 服务端不会为普通成员渲染这个组件。写操作仍由 API 独立强制 `isAdmin`，
 * 因此这里不能被当成授权依据。
 */
export function AnnouncementAdminPanel({
  initialAnnouncements,
}: {
  initialAnnouncements: AnnouncementOverview
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<AnnouncementRow[]>(() =>
    toRows(initialAnnouncements),
  )
  const [pendingClientId, setPendingClientId] = useState<string | null>(null)
  const newRowCount = useRef(0)

  // 每次写操作都会 router.refresh()，服务端会带回新的全量列表。
  // 不跟着 props 同步就会显示陈旧数据，也会把刚删掉的行带回来。
  // 未落库的新草稿不能被覆盖掉，否则管理员填到一半的内容会消失。
  useEffect(() => {
    setRows((current) => {
      const unsaved = current.filter((row) => row.id === null)
      const merged = toRows(initialAnnouncements)
      const knownIds = new Set(merged.map((row) => row.clientId))
      return [...merged, ...unsaved.filter((row) => !knownIds.has(row.clientId))]
    })
  }, [initialAnnouncements])

  const persistedCount = rows.filter((row) => row.id !== null).length

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
  }

  function handleDiscard(clientId: string) {
    setRows((current) => current.filter((row) => row.clientId !== clientId))
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
      handleDiscard(row.clientId)
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          // 关闭时丢弃未保存的新草稿，避免下次打开看到残留。
          setRows((current) => current.filter((row) => row.id !== null))
          router.refresh()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="open-announcement-admin"
        >
          <SettingsIcon data-icon="inline-start" />
          公告配置
        </Button>
      </DialogTrigger>
      <DialogContent
        className="announcement-admin-dialog"
        data-testid="announcement-admin-panel"
      >
        <DialogHeader>
          <DialogTitle>全局公告配置</DialogTitle>
          <DialogDescription>
            公告在登录后对所有用户展示。用户可以自行关闭单条公告，停用公告则对所有人隐藏。
          </DialogDescription>
        </DialogHeader>

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
            const isDirty =
              row.saved === null ||
              JSON.stringify(row.draft) !== JSON.stringify(row.saved)
            // 复用服务端 Schema 判定能否保存：
            // 与服务端同一份规则，避免出现「按钮可点但必然 422」的死路。
            const validation = announcementInputSchema.safeParse(row.draft)
            const blockingIssue = validation.success
              ? null
              : (validation.error.issues[0]?.message ?? "公告内容不符合格式要求")
            return (
              <article className="announcement-admin-item" key={row.clientId}>
                <header>
                  <Badge variant={row.draft.enabled ? "secondary" : "outline"}>
                    {levelLabels[row.draft.level]}
                  </Badge>
                  <strong>{row.draft.title || "未命名公告"}</strong>
                  {row.id === null ? <Badge variant="outline">未保存</Badge> : null}
                  {!row.draft.enabled ? <Badge variant="outline">已停用</Badge> : null}
                </header>
                <AnnouncementEditor
                  initial={row.draft}
                  idPrefix={`announcement-${row.clientId}`}
                  onChange={(next) => handleChange(row.clientId, next)}
                />
                <footer>
                  {blockingIssue ? (
                    <output className="announcement-admin-issue">
                      {blockingIssue}
                    </output>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => void handleDelete(row)}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    {row.id === null ? "放弃" : "删除"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending || !isDirty || Boolean(blockingIssue)}
                    onClick={() => void handleSave(row)}
                    data-testid="announcement-save"
                  >
                    {isPending ? <Spinner data-icon="inline-start" /> : null}
                    保存
                  </Button>
                </footer>
              </article>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
