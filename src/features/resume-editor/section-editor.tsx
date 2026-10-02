"use client"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ChevronDownIcon,
  GripVerticalIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog"
import { Button } from "../../components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../components/ui/collapsible"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Switch } from "../../components/ui/switch"
import { Textarea } from "../../components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { formatResumePeriod } from "../../shared/resume-schema/resume-period"
import {
  createResumeItem,
  type ResumeDocument,
  type ResumeItem,
  type ResumeSection,
} from "../../shared/resume-schema/resume-schema"
import type { EditorFocusRequest } from "./editor-focus-request"
import { ListTextarea } from "./list-textarea"
import { ProfileForm } from "./profile-form"

interface SectionEditorProps {
  document: ResumeDocument
  selectedSectionId: string
  focusRequest: EditorFocusRequest | null
  /** 仍有未应用 AI 建议的条目 ID，用于在卡片上显示待应用标记。 */
  pendingSuggestionItemIds: readonly string[]
  onChange: (document: ResumeDocument) => void
  onDeleteSection: (sectionId: string) => void
}

function ItemFields({
  item,
  section,
  onChange,
}: {
  item: ResumeItem
  section: ResumeSection
  onChange: (item: ResumeItem) => void
}) {
  function updateField<K extends keyof ResumeItem>(field: K, value: ResumeItem[K]) {
    onChange({ ...item, [field]: value })
  }

  const isSkills = section.type === "skills"

  return (
    <FieldGroup>
      <div className="editor-form-grid">
        <Field>
          <FieldLabel htmlFor={`${item.id}-title`}>标题</FieldLabel>
          <Input
            id={`${item.id}-title`}
            value={item.title}
            onChange={(event) => updateField("title", event.target.value)}
          />
        </Field>
        {!isSkills && (
          <Field>
            <FieldLabel htmlFor={`${item.id}-subtitle`}>机构 / 角色补充</FieldLabel>
            <Input
              id={`${item.id}-subtitle`}
              value={item.subtitle}
              onChange={(event) => updateField("subtitle", event.target.value)}
            />
          </Field>
        )}
      </div>

      {!isSkills && (
        <>
          <div className="editor-form-grid editor-form-grid-three">
            <Field>
              <FieldLabel htmlFor={`${item.id}-start`}>开始时间</FieldLabel>
              <Input
                id={`${item.id}-start`}
                value={item.startDate}
                onChange={(event) => updateField("startDate", event.target.value)}
                placeholder="2022.06"
              />
            </Field>
            <Field data-disabled={item.current}>
              <FieldLabel htmlFor={`${item.id}-end`}>结束时间</FieldLabel>
              <Input
                id={`${item.id}-end`}
                value={item.endDate}
                disabled={item.current}
                onChange={(event) => updateField("endDate", event.target.value)}
                placeholder="2024.08"
              />
            </Field>
            <Field orientation="horizontal" className="editor-current-field">
              <FieldLabel htmlFor={`${item.id}-current`}>至今</FieldLabel>
              <Switch
                id={`${item.id}-current`}
                checked={item.current}
                onCheckedChange={(checked) => updateField("current", checked)}
              />
            </Field>
          </div>
          <div className="editor-form-grid">
            <Field>
              <FieldLabel htmlFor={`${item.id}-location`}>地点</FieldLabel>
              <Input
                id={`${item.id}-location`}
                value={item.location}
                onChange={(event) => updateField("location", event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${item.id}-url`}>链接</FieldLabel>
              <Input
                id={`${item.id}-url`}
                value={item.url}
                onChange={(event) => updateField("url", event.target.value)}
                placeholder="https://"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={`${item.id}-description`}>背景描述</FieldLabel>
            <Textarea
              id={`${item.id}-description`}
              value={item.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows={3}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${item.id}-highlights`}>成果要点</FieldLabel>
            <ListTextarea
              id={`${item.id}-highlights`}
              mode="newline"
              value={item.highlights}
              onChange={(highlights) => updateField("highlights", highlights)}
              rows={4}
              placeholder="每行一条，建议使用动作 + 结果 + 影响"
            />
            <FieldDescription>每行将渲染为一个成果要点。</FieldDescription>
          </Field>
        </>
      )}

      <Field>
        <FieldLabel htmlFor={`${item.id}-skills`}>
          {isSkills ? "技能标签" : "相关技能"}
        </FieldLabel>
        <ListTextarea
          id={`${item.id}-skills`}
          mode="comma-or-newline"
          value={item.skills}
          onChange={(skills) => updateField("skills", skills)}
          rows={3}
          placeholder={"React, TypeScript\nNext.js"}
        />
        <FieldDescription>
          支持中文逗号（，）、英文逗号（,）或换行分隔。
        </FieldDescription>
      </Field>
    </FieldGroup>
  )
}

function SortableItemCard({
  item,
  section,
  index,
  open,
  focused,
  hasPendingSuggestion,
  onChange,
  onDelete,
  onOpenChange,
}: {
  item: ResumeItem
  section: ResumeSection
  index: number
  open: boolean
  focused: boolean
  hasPendingSuggestion: boolean
  onChange: (item: ResumeItem) => void
  onDelete: () => void
  onOpenChange: (open: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const period = formatResumePeriod(item)
  const summary =
    [item.subtitle, period].filter(Boolean).join(" · ") || "展开补充条目详情"

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card
        ref={setNodeRef}
        className={isDragging ? "editor-item-card is-dragging" : "editor-item-card"}
        data-editor-item-id={item.id}
        data-expanded={open}
        data-ai-focused={focused}
        data-ai-pending={hasPendingSuggestion}
        style={{ transform: CSS.Transform.toString(transform), transition }}
      >
        <CardHeader data-editor-item-focus-id={item.id}>
          <CardTitle>
            {String(index + 1).padStart(2, "0")} · {item.title || "未命名条目"}
          </CardTitle>
          <CardDescription>{summary}</CardDescription>
          {hasPendingSuggestion ? (
            <span className="editor-item-ai-badge">
              <SparklesIcon aria-hidden="true" />
              待应用建议
            </span>
          ) : null}
          <CardAction>
            <div className="editor-item-actions">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`拖动条目 ${index + 1}`}
                {...attributes}
                {...listeners}
              >
                <GripVerticalIcon />
              </Button>
              <CollapsibleTrigger asChild>
                <Button
                  className="editor-item-expand"
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${open ? "收起" : "展开"}条目 ${index + 1}`}
                >
                  <ChevronDownIcon />
                </Button>
              </CollapsibleTrigger>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`删除条目 ${index + 1}`}
                onClick={onDelete}
              >
                <Trash2Icon />
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <ItemFields item={item} section={section} onChange={onChange} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export function SectionEditor({
  document,
  selectedSectionId,
  focusRequest,
  pendingSuggestionItemIds,
  onChange,
  onDeleteSection,
}: SectionEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const selectedSection = document.sections.find(
    (entry) => entry.id === selectedSectionId,
  )
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const pendingSuggestionItemIdSet = useMemo(
    () => new Set(pendingSuggestionItemIds),
    [pendingSuggestionItemIds],
  )

  useEffect(() => {
    if (!selectedSection) {
      setExpandedItemId(null)
      return
    }
    setExpandedItemId((current) =>
      current && selectedSection.items.some((item) => item.id === current)
        ? current
        : (selectedSection.items[0]?.id ?? null),
    )
  }, [selectedSection])

  useEffect(() => {
    if (focusRequest?.sectionId !== selectedSectionId || !focusRequest.itemId) {
      return
    }
    // 仅定位时也展开目标条目，用户才能直接看到被建议的字段；
    // 其余条目的折叠状态保持不变。
    setExpandedItemId(focusRequest.itemId)
  }, [focusRequest, selectedSectionId])

  if (selectedSectionId === "profile") {
    return <ProfileForm document={document} onChange={onChange} />
  }

  const section = selectedSection
  if (!section) {
    return null
  }
  const activeSection: ResumeSection = section

  function updateSection(updatedSection: ResumeSection) {
    onChange({
      ...document,
      sections: document.sections.map((entry) =>
        entry.id === updatedSection.id ? updatedSection : entry,
      ),
    })
  }

  function updateItem(updatedItem: ResumeItem) {
    updateSection({
      ...activeSection,
      items: activeSection.items.map((item) =>
        item.id === updatedItem.id ? updatedItem : item,
      ),
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    const oldIndex = activeSection.items.findIndex((item) => item.id === active.id)
    const newIndex = activeSection.items.findIndex((item) => item.id === over.id)
    updateSection({
      ...activeSection,
      items: arrayMove(activeSection.items, oldIndex, newIndex),
    })
  }

  function addItem() {
    const item = createResumeItem(activeSection.type)
    updateSection({
      ...activeSection,
      items: [...activeSection.items, item],
    })
    setExpandedItemId(item.id)
  }

  return (
    <div className="editor-form-stack" data-editor-form-target>
      <Card className="editor-form-card editor-section-settings">
        <CardHeader>
          <CardTitle>{section.title}</CardTitle>
          <CardDescription>
            编辑区块标题、内容与排序，右侧预览会立即更新。
          </CardDescription>
          <CardAction>
            <div className="editor-section-actions">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label="添加条目"
                    onClick={addItem}
                  >
                    <PlusIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>添加条目</TooltipContent>
              </Tooltip>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="删除区块">
                    <Trash2Icon />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>删除“{section.title}”？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作会删除区块内的全部条目，可在保存前使用撤销恢复。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => onDeleteSection(section.id)}
                    >
                      删除区块
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor={`${section.id}-section-title`}>
              {section.type === "custom" ? "自定义区块名称" : "区块标题"}
            </FieldLabel>
            <Input
              id={`${section.id}-section-title`}
              value={section.title}
              placeholder={section.type === "custom" ? "例如：公开演讲" : undefined}
              onChange={(event) =>
                updateSection({ ...section, title: event.target.value })
              }
            />
            {section.type === "custom" && (
              <FieldDescription>
                名称会同步显示在左侧内容结构和 A4 简历中。
              </FieldDescription>
            )}
          </Field>
        </CardContent>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={section.items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="editor-form-stack">
            {section.items.map((item, index) => (
              <SortableItemCard
                key={item.id}
                item={item}
                section={section}
                index={index}
                open={expandedItemId === item.id}
                focused={
                  focusRequest?.itemId === item.id &&
                  focusRequest.sectionId === selectedSectionId
                }
                hasPendingSuggestion={pendingSuggestionItemIdSet.has(item.id)}
                onChange={updateItem}
                onOpenChange={(open) => setExpandedItemId(open ? item.id : null)}
                onDelete={() =>
                  updateSection({
                    ...section,
                    items: section.items.filter((entry) => entry.id !== item.id),
                  })
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
