import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  PlusIcon,
  UserRoundIcon,
} from "lucide-react"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import { Separator } from "../../components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { cn } from "../../lib/utils"
import {
  type ResumeSection,
  type ResumeSectionType,
  sectionTypeLabels,
  sectionTypes,
} from "../../shared/resume-schema/resume-schema"
import { reorderSections } from "./reorder-sections"

interface SectionNavigationProps {
  sections: ResumeSection[]
  selectedSectionId: string
  onSelect: (sectionId: string) => void
  onReorder: (sections: ResumeSection[]) => void
  onToggleVisibility: (sectionId: string) => void
  onAddSection: (type: ResumeSectionType) => void
}

interface SectionRowProps {
  section: ResumeSection
  selected: boolean
  /** 拖拽中的浮层渲染为实心卡片，不显示手柄交互。 */
  overlay?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>
  onSelect: () => void
  onToggleVisibility: () => void
}

/**
 * 区块行的唯一渲染来源。列表内、拖拽浮层复用同一份结构，
 * 保证浮层里的整块外观与列表一致，不会出现「拖起来变了样」。
 */
function SectionRow({
  section,
  selected,
  overlay = false,
  dragHandleProps,
  onSelect,
  onToggleVisibility,
}: SectionRowProps) {
  return (
    <div
      className={cn(
        "editor-section-row",
        selected && "is-selected",
        overlay && "is-overlay",
      )}
    >
      <button
        type="button"
        className="editor-drag-handle"
        aria-label={`拖动${section.title}`}
        {...dragHandleProps}
      >
        <GripVerticalIcon />
      </button>
      <button type="button" className="editor-section-select" onClick={onSelect}>
        <span>{section.title}</span>
        <small>{section.items.length} 条</small>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={
              section.visible ? `隐藏${section.title}` : `显示${section.title}`
            }
            onClick={onToggleVisibility}
          >
            {section.visible ? <EyeIcon /> : <EyeOffIcon />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{section.visible ? "从简历隐藏" : "在简历显示"}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function SortableSection({
  section,
  selected,
  onSelect,
  onToggleVisibility,
}: {
  section: ResumeSection
  selected: boolean
  onSelect: () => void
  onToggleVisibility: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-dragging={isDragging}
      className="editor-section-slot"
    >
      <SectionRow
        section={section}
        selected={selected}
        dragHandleProps={{ ...attributes, ...listeners }}
        onSelect={onSelect}
        onToggleVisibility={onToggleVisibility}
      />
    </div>
  )
}

export function SectionNavigation({
  sections,
  selectedSectionId,
  onSelect,
  onReorder,
  onToggleVisibility,
  onAddSection,
}: SectionNavigationProps) {
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragStart(event: DragStartEvent) {
    setDraggingSectionId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingSectionId(null)
    const { active, over } = event
    if (!over) {
      return
    }
    const next = reorderSections(sections, String(active.id), String(over.id))
    if (next !== sections) {
      onReorder(next)
    }
  }

  function handleDragCancel() {
    setDraggingSectionId(null)
  }

  const draggingSection = sections.find((section) => section.id === draggingSectionId)

  return (
    <section className="editor-outline" aria-label="简历内容结构">
      <div className="editor-outline-heading">
        <h2>内容结构</h2>
        <span>{sections.length + 1} 个区块</span>
      </div>
      <button
        type="button"
        className={cn(
          "editor-profile-row",
          selectedSectionId === "profile" && "is-selected",
        )}
        onClick={() => onSelect("profile")}
      >
        <UserRoundIcon />
        <span>个人信息</span>
      </button>
      <Separator />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={sections.map((section) => section.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="editor-section-list">
            {sections.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                selected={selectedSectionId === section.id}
                onSelect={() => onSelect(section.id)}
                onToggleVisibility={() => onToggleVisibility(section.id)}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {draggingSection ? (
            <SectionRow
              section={draggingSection}
              selected={selectedSectionId === draggingSection.id}
              overlay
              onSelect={() => onSelect(draggingSection.id)}
              onToggleVisibility={() => onToggleVisibility(draggingSection.id)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="editor-add-section">
            <PlusIcon data-icon="inline-start" />
            添加区块
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            {sectionTypes.map((type) => (
              <DropdownMenuItem key={type} onSelect={() => onAddSection(type)}>
                {sectionTypeLabels[type]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </section>
  )
}
