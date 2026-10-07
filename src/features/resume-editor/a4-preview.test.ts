import { describe, expect, it } from "vitest"
import {
  A4_PAGE_HEIGHT,
  createResumeDocument,
  createResumeItem,
} from "../../shared/resume-schema/resume-schema"
import {
  clampPlacementPageIndex,
  getPaginatedSourceItemIds,
  getPaginationMetrics,
} from "../resume-renderer/resume-pagination"
import {
  calculateAnchoredScrollPosition,
  calculateDampedScrollPosition,
  calculateDampedZoom,
  calculateFitZoom,
  calculateWheelZoom,
  clampPreviewZoom,
  MAX_PREVIEW_ZOOM,
  paginateResumeDocument,
} from "./a4-preview"

describe("A4 preview zoom", () => {
  it("clamps manual zoom to the supported range", () => {
    expect(clampPreviewZoom(20)).toBe(40)
    expect(clampPreviewZoom(70)).toBe(70)
    expect(clampPreviewZoom(130)).toBe(130)
    expect(clampPreviewZoom(MAX_PREVIEW_ZOOM + 20)).toBe(MAX_PREVIEW_ZOOM)
  })

  it("calculates a stepped fit zoom from the available width", () => {
    expect(calculateFitZoom(0)).toBe(60)
    expect(calculateFitZoom(Number.NaN)).toBe(60)
    expect(calculateFitZoom(200)).toBe(40)
    expect(calculateFitZoom(600)).toBe(60)
    expect(calculateFitZoom(1200)).toBe(140)
  })

  it("calculates precise multiplicative wheel zoom", () => {
    expect(calculateWheelZoom(60, -10)).toBeGreaterThan(60)
    expect(calculateWheelZoom(60, -10)).toBeLessThan(61)
    expect(calculateWheelZoom(60, 10)).toBeLessThan(60)
    expect(calculateWheelZoom(MAX_PREVIEW_ZOOM, -120)).toBe(MAX_PREVIEW_ZOOM)
  })

  it("damps zoom monotonically toward a bounded target", () => {
    const firstFrame = calculateDampedZoom(60, 90, 16)
    const secondFrame = calculateDampedZoom(firstFrame, 90, 16)

    expect(firstFrame).toBeGreaterThan(60)
    expect(firstFrame).toBeLessThan(90)
    expect(secondFrame).toBeGreaterThan(firstFrame)
    expect(secondFrame).toBeLessThanOrEqual(90)
    expect(calculateDampedZoom(99.99, 100, 64)).toBe(100)
    expect(
      calculateDampedZoom(MAX_PREVIEW_ZOOM - 0.01, MAX_PREVIEW_ZOOM + 20, 64),
    ).toBe(MAX_PREVIEW_ZOOM)
  })

  it("settles a typical wheel zoom within a tight animation window", () => {
    const targetZoom = calculateWheelZoom(60, -120)
    let currentZoom = 60

    for (let frame = 0; frame < 10 && currentZoom !== targetZoom; frame += 1) {
      currentZoom = calculateDampedZoom(currentZoom, targetZoom, 16)
    }

    expect(currentZoom).toBe(targetZoom)
  })

  it("keeps a safe value for invalid damping input", () => {
    expect(calculateDampedZoom(Number.NaN, 75, 16)).toBeGreaterThan(60)
    expect(calculateDampedZoom(70, Number.NaN, 16)).toBe(70)
    expect(calculateDampedZoom(70, 90, Number.NaN)).toBe(70)
  })

  it("damps anchored scroll movement toward the zoom target", () => {
    const firstFrame = calculateDampedScrollPosition(120, 260, 16)
    const secondFrame = calculateDampedScrollPosition(firstFrame, 260, 16)

    expect(firstFrame).toBeGreaterThan(120)
    expect(firstFrame).toBeLessThan(260)
    expect(secondFrame).toBeGreaterThan(firstFrame)
    expect(secondFrame).toBeLessThanOrEqual(260)
    expect(calculateDampedScrollPosition(259.8, 260, 64)).toBe(260)
  })

  it("keeps a safe scroll value for invalid damping input", () => {
    expect(calculateDampedScrollPosition(Number.NaN, 120, 16)).toBeGreaterThan(0)
    expect(calculateDampedScrollPosition(80, Number.NaN, 16)).toBe(80)
    expect(calculateDampedScrollPosition(80, 120, Number.NaN)).toBe(80)
  })

  it("keeps the page point under the pointer while zooming", () => {
    expect(calculateAnchoredScrollPosition(200, 500, 350, 400, 0.375)).toBe(200)
    expect(calculateAnchoredScrollPosition(200, 500, 350, 480, 0.375)).toBe(230)
    expect(calculateAnchoredScrollPosition(200, 500, 350, 320, 0.375)).toBe(170)
  })

  it("keeps a safe scroll position for invalid anchor geometry", () => {
    expect(calculateAnchoredScrollPosition(200, Number.NaN, 350, 400, 0.375)).toBe(200)
    expect(calculateAnchoredScrollPosition(Number.NaN, 500, 350, 400, 0.375)).toBe(0)
  })
})

describe("A4 preview pagination", () => {
  it("clamps orphaned image placements to the available page range", () => {
    expect(clampPlacementPageIndex(4, 2)).toBe(1)
    expect(clampPlacementPageIndex(-1, 2)).toBe(0)
    expect(clampPlacementPageIndex(0, 0)).toBe(0)
  })

  it("splits long items to use the available space on ordered A4 pages", () => {
    const document = createResumeDocument()
    const workSection = document.sections[0]
    const items = Array.from({ length: 12 }, (_, index) => ({
      ...createResumeItem("workExperience"),
      id: `long-work-${index}`,
      title: `高级工程师 ${index + 1}`,
      description: "负责复杂产品架构、跨团队推进和长期技术治理。".repeat(5),
      highlights: [
        "推动关键项目落地并建立可量化的交付指标。",
        "通过架构改造持续改善性能和维护效率。",
      ],
    }))
    const longDocument = {
      ...document,
      sections: [{ ...workSection, items }],
    }

    const pages = paginateResumeDocument(longDocument)
    expect(pages.length).toBeGreaterThan(1)
    expect(pages[0].showProfile).toBe(true)
    expect(pages.slice(1).every((page) => !page.showProfile)).toBe(true)
    expect(getPaginatedSourceItemIds(pages)).toEqual(items.map((item) => item.id))
    const continuationFragments = pages.flatMap((page) =>
      page.document.sections.flatMap((section) =>
        section.items.filter((item) => item.id.includes("::continuation-")),
      ),
    )
    expect(continuationFragments.length).toBeGreaterThan(0)
    expect(continuationFragments.every((item) => item.title === "")).toBe(true)
    expect(
      pages.every((page) =>
        page.document.sections.some(
          (section) =>
            section.id === workSection.id && section.title === workSection.title,
        ),
      ),
    ).toBe(true)
  })

  it("keeps short ordered content on the first page", () => {
    const document = createResumeDocument()
    const workSection = document.sections[0]
    const items = Array.from({ length: 3 }, (_, index) => ({
      ...createResumeItem("workExperience"),
      id: `short-work-${index}`,
      title: `工程师 ${index + 1}`,
      description: "负责核心产品交付与质量改进。",
    }))

    const pages = paginateResumeDocument({
      ...document,
      sections: [{ ...workSection, items }],
    })

    expect(pages).toHaveLength(1)
    expect(getPaginatedSourceItemIds(pages)).toEqual(items.map((item) => item.id))
  })

  it("splits only an oversized item without adding a continuation title", () => {
    const document = createResumeDocument()
    const workSection = document.sections[0]
    const item = {
      ...createResumeItem("workExperience"),
      id: "oversized-highlight",
      title: "大型治理项目",
      description: "",
      highlights: [
        "持续推进跨团队架构治理、性能优化、质量建设和交付改进。".repeat(200),
      ],
    }

    const pages = paginateResumeDocument({
      ...document,
      sections: [{ ...workSection, items: [item] }],
    })

    expect(pages.length).toBeGreaterThan(1)
    expect(getPaginatedSourceItemIds(pages)).toEqual([item.id])
    const fragments = pages.flatMap((page) =>
      page.document.sections.flatMap((section) => section.items),
    )
    const continuationFragments = fragments.filter((candidate) =>
      candidate.id.includes("::continuation-"),
    )
    expect(continuationFragments.length).toBeGreaterThan(0)
    expect(continuationFragments.every((candidate) => candidate.title === "")).toBe(
      true,
    )
    expect(fragments.flatMap((fragment) => fragment.highlights).join("")).toBe(
      item.highlights[0],
    )
    expect(fragments.every((fragment) => !fragment.title.includes("续"))).toBe(true)
  })

  it("pins sidebar sections to the first page", () => {
    const document = createResumeDocument()
    const sidebarDocument = {
      ...document,
      template: { ...document.template, id: "clean-sidebar" as const },
    }

    const pages = paginateResumeDocument(sidebarDocument)
    const metrics = getPaginationMetrics(sidebarDocument)

    expect(
      pages[0].document.sections.some((section) => section.type === "skills"),
    ).toBe(true)
    expect(
      pages
        .slice(1)
        .every((page) =>
          page.document.sections.every((section) => section.type !== "skills"),
        ),
    ).toBe(true)
    expect(metrics.firstPageMainWidth).toBe(metrics.continuationMainWidth)
    expect(metrics.firstPageCapacity).toBeLessThan(metrics.continuationPageCapacity)
    expect(metrics.firstPageContentScale).toBe(metrics.continuationPageContentScale)
    expect(metrics.continuationPageCapacity).toBe(
      A4_PAGE_HEIGHT -
        document.style.pageMargin * 3 -
        Math.ceil(document.style.baseFontSize * document.style.lineHeight),
    )
    expect(metrics.firstPageCapacity).toBeLessThanOrEqual(
      A4_PAGE_HEIGHT - document.style.pageMargin * 3 - 28,
    )
  })
})
