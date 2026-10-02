import {
  findNodeAtLocation,
  getLocation,
  getNodeValue,
  type JSONPath,
  type Node,
  type ParseError,
  parseTree,
} from "jsonc-parser"
import type { ResumeLinkTarget } from "../../shared/resume-schema/resume-link-target"

export interface ResumeJsonLink {
  target: ResumeLinkTarget
  offset: number
  length: number
}

interface ParsedResumeJson {
  root: Node
  value: {
    profile?: unknown
    sections?: Array<{
      id?: unknown
      items?: Array<{
        id?: unknown
      }>
    }>
  }
}

function parseResumeJson(value: string): ParsedResumeJson | null {
  const errors: ParseError[] = []
  const root = parseTree(value, errors, {
    allowTrailingComma: false,
    disallowComments: true,
  })
  if (!root || errors.length > 0) {
    return null
  }
  const parsed = getNodeValue(root)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null
  }
  return {
    root,
    value: parsed as ParsedResumeJson["value"],
  }
}

function createLink(
  root: Node,
  path: JSONPath,
  target: ResumeLinkTarget,
): ResumeJsonLink | null {
  const node = findNodeAtLocation(root, path)
  return node
    ? {
        target,
        offset: node.offset,
        length: node.length,
      }
    : null
}

export function resolveResumeJsonLinkAtOffset(
  value: string,
  offset: number,
): ResumeJsonLink | null {
  const parsed = parseResumeJson(value)
  if (!parsed) {
    return null
  }

  const path = getLocation(value, Math.min(Math.max(0, offset), value.length)).path
  if (path[0] === "profile") {
    return createLink(parsed.root, ["profile"], { kind: "profile" })
  }
  if (path[0] !== "sections" || typeof path[1] !== "number") {
    return null
  }

  const sectionIndex = path[1]
  const section = parsed.value.sections?.[sectionIndex]
  if (!section || typeof section.id !== "string") {
    return null
  }
  if (path[2] === "items" && typeof path[3] === "number") {
    const itemIndex = path[3]
    const item = section.items?.[itemIndex]
    if (!item || typeof item.id !== "string") {
      return null
    }
    return createLink(parsed.root, ["sections", sectionIndex, "items", itemIndex], {
      kind: "item",
      sectionId: section.id,
      itemId: item.id,
    })
  }
  return createLink(parsed.root, ["sections", sectionIndex], {
    kind: "section",
    sectionId: section.id,
  })
}

export function findResumeJsonLink(
  value: string,
  target: ResumeLinkTarget,
): ResumeJsonLink | null {
  const parsed = parseResumeJson(value)
  if (!parsed) {
    return null
  }
  if (target.kind === "profile") {
    return createLink(parsed.root, ["profile"], target)
  }

  const sectionIndex = parsed.value.sections?.findIndex(
    (section) => section.id === target.sectionId,
  )
  if (sectionIndex === undefined || sectionIndex < 0) {
    return null
  }
  if (target.kind === "section") {
    return createLink(parsed.root, ["sections", sectionIndex], target)
  }

  const itemIndex = parsed.value.sections?.[sectionIndex]?.items?.findIndex(
    (item) => item.id === target.itemId,
  )
  if (itemIndex === undefined || itemIndex < 0) {
    return null
  }
  return createLink(parsed.root, ["sections", sectionIndex, "items", itemIndex], target)
}
