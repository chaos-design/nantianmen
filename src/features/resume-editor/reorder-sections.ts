import { arrayMove } from "@dnd-kit/sortable"
import type { ResumeSection } from "../../shared/resume-schema/resume-schema"

/**
 * 按拖拽结果重排区块。activeId 或 overId 不在列表中时原样返回，
 * 避免拖拽过程中的无效事件写坏文档。
 */
export function reorderSections(
  sections: ResumeSection[],
  activeId: string,
  overId: string,
): ResumeSection[] {
  if (activeId === overId) {
    return sections
  }
  const oldIndex = sections.findIndex((section) => section.id === activeId)
  const newIndex = sections.findIndex((section) => section.id === overId)
  if (oldIndex < 0 || newIndex < 0) {
    return sections
  }
  return arrayMove(sections, oldIndex, newIndex)
}
