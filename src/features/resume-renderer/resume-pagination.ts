import type {
  ResumeDocument,
  ResumeItem,
  ResumeSection,
} from "../../shared/resume-schema/resume-schema"
import { A4_PAGE_HEIGHT, A4_PAGE_WIDTH } from "../../shared/resume-schema/resume-schema"
import { getTemplateScheme } from "../../shared/resume-template/template-schemes"

export interface ResumePage {
  document: ResumeDocument
  showProfile: boolean
}

export interface PaginationMetrics {
  firstPageCapacity: number
  firstPageMainWidth: number
  continuationPageCapacity: number
  continuationMainWidth: number
  firstPageContentScale: number
  continuationPageContentScale: number
}

const MAIN_TOP_PADDING = 28
const MIN_FRAGMENT_HEIGHT = 48
const HEIGHT_ESTIMATION_FACTOR = 1.09
const CONTINUATION_ID_PATTERN = /::continuation-(\d+)$/

function weightedTextLength(value: string): number {
  let length = 0
  for (const character of value) {
    if (/\s/.test(character)) {
      length += 0.35
    } else if (character.charCodeAt(0) <= 255) {
      length += 0.56
    } else {
      length += 1
    }
  }
  return length
}

function estimateLineCount(value: string, width: number, fontSize: number): number {
  if (!value) {
    return 0
  }
  const lineCapacity = Math.max(6, width / Math.max(1, fontSize))
  return Math.max(1, Math.ceil(weightedTextLength(value) / lineCapacity))
}

function estimateProfileHeight(
  document: ResumeDocument,
  width: number,
  contactsInSidebar: boolean,
): number {
  const fontSize = document.style.baseFontSize
  const lineHeight = fontSize * document.style.lineHeight
  const nameLines = estimateLineCount(
    document.profile.name || "未命名候选人",
    width,
    42,
  )
  const headlineLines = estimateLineCount(document.profile.headline, width, 14)
  const summaryLines = estimateLineCount(document.profile.summary, width, fontSize)
  const contactText = [
    document.profile.email,
    document.profile.phone,
    document.profile.location,
    document.profile.website,
  ]
    .filter(Boolean)
    .join("  ")
  const contactLines = contactsInSidebar ? 0 : estimateLineCount(contactText, width, 9)

  return (
    (document.metadata.targetRole ? 18 : 0) +
    nameLines * 48 +
    (headlineLines > 0 ? 8 + headlineLines * 19 : 0) +
    (contactLines > 0 ? 18 + contactLines * 15 : 0) +
    (summaryLines > 0 ? 18 + summaryLines * lineHeight : 0) +
    30
  )
}

export function getPaginationMetrics(document: ResumeDocument): PaginationMetrics {
  const scheme = getTemplateScheme(document.template.id)
  // 分页估算基于字符宽度模型，不依赖真实字体度量；CI Linux runner 上的英文字体
  // 是 DejaVu（无 SFMono/Avenir/Consolas/PingFang），实测会让同一份文字比估算
  // 多占一行。底部预留至少「正文行高」，让最坏情况下的行出现不会顶到页底留白。
  const estimatedLineHeight = document.style.baseFontSize * document.style.lineHeight
  const bottomEstimationReserve =
    document.style.pageMargin + Math.ceil(estimatedLineHeight)
  const pageContentHeight =
    A4_PAGE_HEIGHT - document.style.pageMargin * 2 - bottomEstimationReserve
  const singleColumnWidth = A4_PAGE_WIDTH - document.style.pageMargin * 2
  const firstPageMainWidth =
    scheme.layout === "sidebar"
      ? A4_PAGE_WIDTH - (scheme.sidebar?.width ?? 0) - document.style.pageMargin * 2
      : singleColumnWidth
  const continuationMainWidth =
    scheme.layout === "sidebar" ? firstPageMainWidth : singleColumnWidth
  const profileHeight = estimateProfileHeight(
    document,
    firstPageMainWidth,
    scheme.layout === "sidebar",
  )
  const contentScale = scheme.pagination?.contentScale ?? 1

  return {
    firstPageCapacity: Math.max(
      180,
      pageContentHeight - profileHeight - MAIN_TOP_PADDING,
    ),
    firstPageMainWidth: Math.max(240, firstPageMainWidth),
    continuationPageCapacity: Math.max(320, pageContentHeight),
    continuationMainWidth: Math.max(320, continuationMainWidth),
    firstPageContentScale: scheme.pagination?.firstPageScale ?? contentScale,
    continuationPageContentScale:
      scheme.pagination?.continuationPageScale ?? contentScale,
  }
}

function getSectionFontSize(section: ResumeSection, document: ResumeDocument): number {
  return section.style.fontSize ?? document.style.baseFontSize
}

function estimateSkillRows(skills: string[], width: number, fontSize: number): number {
  if (skills.length === 0) {
    return 0
  }
  const availableUnits = Math.max(8, width / Math.max(1, fontSize * 0.72))
  let rows = 1
  let rowUnits = 0
  for (const skill of skills) {
    const skillUnits = weightedTextLength(skill) + 2.8
    if (rowUnits > 0 && rowUnits + skillUnits > availableUnits) {
      rows += 1
      rowUnits = skillUnits
    } else {
      rowUnits += skillUnits
    }
  }
  return rows
}

export function estimateResumeItemHeight(
  item: ResumeItem,
  section: ResumeSection,
  document: ResumeDocument,
  width: number,
): number {
  const fontSize = getSectionFontSize(section, document)
  const lineHeight = fontSize * document.style.lineHeight

  if (section.type === "skills") {
    return (
      estimateLineCount(item.title, width, fontSize + 1) * (lineHeight + 1) +
      (item.skills.length > 0
        ? 9 + estimateSkillRows(item.skills, width, fontSize) * 18
        : 0)
    )
  }

  const titleWidth = width * 0.62
  const titleLines = estimateLineCount(item.title, titleWidth, fontSize + 1)
  const subtitleLines = estimateLineCount(item.subtitle, titleWidth, fontSize - 1)
  const metaText = [item.startDate, item.current ? "至今" : item.endDate, item.location]
    .filter(Boolean)
    .join(" ")
  const metaLines = estimateLineCount(metaText, width * 0.32, 8)
  const headerHeight = Math.max(
    titleLines * (lineHeight + 1) + subtitleLines * (lineHeight - 1),
    metaLines * 12,
  )
  const descriptionLines = estimateLineCount(item.description, width, fontSize)
  const highlightsHeight = item.highlights.reduce(
    (height, highlight) =>
      height +
      estimateLineCount(highlight, Math.max(1, width - 14), fontSize) * lineHeight +
      5,
    0,
  )
  const skillRows = estimateSkillRows(item.skills, width, fontSize)

  return (
    headerHeight +
    (descriptionLines > 0 ? 8 + descriptionLines * lineHeight : 0) +
    (item.highlights.length > 0 ? 8 + highlightsHeight : 0) +
    (skillRows > 0 ? 9 + skillRows * 18 : 0) +
    (item.url ? 18 : 0)
  )
}

function getSectionChromeHeight(section: ResumeSection): number {
  const presetPadding = section.style.preset === "card" ? 36 : 0
  return 28 + section.style.spacingBefore + section.style.spacingAfter + presetPadding
}

function getItemGap(section: ResumeSection): number {
  return section.style.preset === "compact" ? 10 : 20
}

function getContinuationId(item: ResumeItem): string {
  const match = item.id.match(CONTINUATION_ID_PATTERN)
  const sourceId = match ? item.id.slice(0, match.index) : item.id
  const continuationIndex = match ? Number(match[1]) + 1 : 1
  return `${sourceId}::continuation-${continuationIndex}`
}

function splitTextAtBoundary(value: string, index: number): [string, string] {
  if (index >= value.length) {
    return [value, ""]
  }
  const minimumBoundary = Math.floor(index * 0.65)
  const candidate = value.slice(minimumBoundary, index)
  const relativeBoundary = Math.max(
    candidate.lastIndexOf("。"),
    candidate.lastIndexOf("；"),
    candidate.lastIndexOf("，"),
    candidate.lastIndexOf(" "),
  )
  const boundary =
    relativeBoundary >= 0 ? minimumBoundary + relativeBoundary + 1 : index
  return [value.slice(0, boundary).trim(), value.slice(boundary).trim()]
}

function fitDescriptionPrefix(
  item: ResumeItem,
  section: ResumeSection,
  document: ResumeDocument,
  width: number,
  availableHeight: number,
): number {
  let low = 0
  let high = item.description.length
  let best = 0
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = {
      ...item,
      description: item.description.slice(0, middle),
      highlights: [],
      skills: [],
      url: "",
    }
    if (
      estimateResumeItemHeight(candidate, section, document, width) <= availableHeight
    ) {
      best = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return best
}

function fitHighlightPrefix(
  item: ResumeItem,
  highlight: string,
  section: ResumeSection,
  document: ResumeDocument,
  width: number,
  availableHeight: number,
): number {
  let low = 0
  let high = highlight.length
  let best = 0
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = {
      ...item,
      description: "",
      highlights: [highlight.slice(0, middle)],
      skills: [],
      url: "",
    }
    if (
      estimateResumeItemHeight(candidate, section, document, width) <= availableHeight
    ) {
      best = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return best
}

function splitItemToFit(
  item: ResumeItem,
  section: ResumeSection,
  document: ResumeDocument,
  width: number,
  availableHeight: number,
): [ResumeItem, ResumeItem] | null {
  if (availableHeight < MIN_FRAGMENT_HEIGHT) {
    return null
  }

  const head: ResumeItem = {
    ...item,
    description: "",
    highlights: [],
    skills: [],
    url: "",
  }
  const tail: ResumeItem = {
    ...item,
    id: getContinuationId(item),
    title: "",
    subtitle: "",
    startDate: "",
    endDate: "",
    current: false,
    location: "",
  }

  if (item.description) {
    const fittedLength = fitDescriptionPrefix(
      item,
      section,
      document,
      width,
      availableHeight,
    )
    if (fittedLength === 0) {
      return null
    }
    const [fittedDescription, remainingDescription] = splitTextAtBoundary(
      item.description,
      fittedLength,
    )
    head.description = fittedDescription
    tail.description = remainingDescription
    if (remainingDescription) {
      return [head, tail]
    }
  }

  tail.description = ""
  let fittedHighlightCount = 0
  for (const highlight of item.highlights) {
    const candidate = {
      ...head,
      highlights: [...head.highlights, highlight],
    }
    if (
      estimateResumeItemHeight(candidate, section, document, width) > availableHeight
    ) {
      break
    }
    head.highlights = candidate.highlights
    fittedHighlightCount += 1
  }
  tail.highlights = item.highlights.slice(fittedHighlightCount)
  if (tail.highlights.length > 0) {
    if (fittedHighlightCount === 0 && !head.description) {
      const fittedLength = fitHighlightPrefix(
        item,
        item.highlights[0],
        section,
        document,
        width,
        availableHeight,
      )
      if (fittedLength === 0) {
        return null
      }
      const [fittedHighlight, remainingHighlight] = splitTextAtBoundary(
        item.highlights[0],
        fittedLength,
      )
      head.highlights = [fittedHighlight]
      tail.highlights = [
        ...(remainingHighlight ? [remainingHighlight] : []),
        ...item.highlights.slice(1),
      ]
    }
    return [head, tail]
  }

  let fittedSkillCount = 0
  for (const skill of item.skills) {
    const candidate = {
      ...head,
      skills: [...head.skills, skill],
    }
    if (
      estimateResumeItemHeight(candidate, section, document, width) > availableHeight
    ) {
      break
    }
    head.skills = candidate.skills
    fittedSkillCount += 1
  }
  tail.skills = item.skills.slice(fittedSkillCount)
  if (tail.skills.length > 0) {
    if (fittedSkillCount === 0 && !head.description && head.highlights.length === 0) {
      return null
    }
    return [head, tail]
  }

  if (item.url) {
    const candidate = { ...head, url: item.url }
    if (
      estimateResumeItemHeight(candidate, section, document, width) <= availableHeight
    ) {
      head.url = item.url
      tail.url = ""
    } else {
      tail.url = item.url
      return [head, tail]
    }
  }

  return null
}

function getSourceItemId(itemId: string): string {
  return itemId.replace(CONTINUATION_ID_PATTERN, "")
}

export function paginateResumeDocument(document: ResumeDocument): ResumePage[] {
  const visibleSections = document.sections.filter((section) => section.visible)
  const scheme = getTemplateScheme(document.template.id)
  const sidebarSections =
    scheme.layout === "sidebar"
      ? visibleSections.filter((section) =>
          ["skills", "certification"].includes(section.type),
        )
      : []
  const flowSections =
    scheme.layout === "sidebar"
      ? visibleSections.filter(
          (section) => !["skills", "certification"].includes(section.type),
        )
      : visibleSections
  const metrics = getPaginationMetrics(document)
  const pages: ResumePage[] = []
  let pageSections: ResumeSection[] = sidebarSections
  let showProfile = true
  let remainingHeight = metrics.firstPageCapacity
  let flowItemCount = 0

  function getCurrentWidth(): number {
    return showProfile ? metrics.firstPageMainWidth : metrics.continuationMainWidth
  }

  function getCurrentContentScale(): number {
    return showProfile
      ? metrics.firstPageContentScale
      : metrics.continuationPageContentScale
  }

  function flushPage() {
    pages.push({
      document: { ...document, sections: pageSections },
      showProfile,
    })
    pageSections = []
    showProfile = false
    remainingHeight = metrics.continuationPageCapacity
    flowItemCount = 0
  }

  for (const section of flowSections) {
    for (const sourceItem of section.items) {
      let pendingItem: ResumeItem | null = sourceItem
      while (pendingItem) {
        const existingSection = pageSections.find(
          (candidate) => candidate.id === section.id,
        )
        const itemHeight = estimateResumeItemHeight(
          pendingItem,
          section,
          document,
          getCurrentWidth(),
        )
        const itemChrome = existingSection
          ? getItemGap(section)
          : getSectionChromeHeight(section)
        const heightScale = getCurrentContentScale() * HEIGHT_ESTIMATION_FACTOR
        const requiredHeight = (itemChrome + itemHeight) * heightScale

        if (requiredHeight <= remainingHeight) {
          if (existingSection) {
            existingSection.items.push(pendingItem)
          } else {
            pageSections.push({ ...section, items: [pendingItem] })
          }
          remainingHeight -= requiredHeight
          flowItemCount += 1
          pendingItem = null
          continue
        }

        const availableItemHeight = remainingHeight / heightScale - itemChrome
        const splitResult: [ResumeItem, ResumeItem] | null =
          availableItemHeight >= MIN_FRAGMENT_HEIGHT
            ? splitItemToFit(
                pendingItem,
                section,
                document,
                getCurrentWidth(),
                availableItemHeight,
              )
            : null
        if (splitResult) {
          const [head, tail]: [ResumeItem, ResumeItem] = splitResult
          if (existingSection) {
            existingSection.items.push(head)
          } else {
            pageSections.push({ ...section, items: [head] })
          }
          remainingHeight -=
            (itemChrome +
              estimateResumeItemHeight(head, section, document, getCurrentWidth())) *
            heightScale
          flowItemCount += 1
          pendingItem = tail
          flushPage()
          continue
        }

        if (flowItemCount > 0 || showProfile) {
          flushPage()
          continue
        }

        pageSections.push({ ...section, items: [pendingItem] })
        remainingHeight = 0
        flowItemCount += 1
        pendingItem = null
      }
    }
  }

  if (pageSections.length > 0 || pages.length === 0) {
    flushPage()
  }

  return pages
}

export function getPaginatedSourceItemIds(pages: ResumePage[]): string[] {
  const itemIds = pages.flatMap((page) =>
    page.document.sections.flatMap((section) =>
      section.items.map((item) => getSourceItemId(item.id)),
    ),
  )
  return itemIds.filter((itemId, index) => itemIds[index - 1] !== itemId)
}

export function clampPlacementPageIndex(pageIndex: number, pageCount: number): number {
  return Math.min(Math.max(0, pageCount - 1), Math.max(0, pageIndex))
}
