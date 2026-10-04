import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

interface MonacoModel {
  getPositionAt: (offset: number) => {
    lineNumber: number
    column: number
  }
  getValue: () => string
  setValue: (value: string) => void
  uri: {
    path: string
  }
}

interface MonacoEditorInstance {
  focus: () => void
  getModel: () => MonacoModel | null
  setPosition: (position: { lineNumber: number; column: number }) => void
}

interface MonacoWindow extends Window {
  monaco: {
    editor: {
      getEditors: () => MonacoEditorInstance[]
      getModels: () => MonacoModel[]
    }
  }
}

const pngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
)

async function createResumeFromLanding(page: Page, templateName?: string) {
  await page.getByRole("link", { name: "进入工作台选择模板" }).first().click()
  await expect(page).toHaveURL(/\/workspace$/)
  await expect(page.locator(".workspace-footer")).toHaveCount(0)

  const newResumeButton = page.getByTestId("new-resume")
  if (await newResumeButton.isVisible()) {
    await expect(page.getByTestId("workspace-template-library")).toHaveCount(0)
    await newResumeButton.click()
    await expect(page.getByTestId("workspace-template-dialog")).toBeVisible()
  } else {
    await expect(page.getByTestId("workspace-template-library")).toBeVisible()
  }

  const createButton = page.getByTestId("create-resume")
  await expect(createButton).toBeDisabled()
  const templateOption = templateName
    ? page.getByRole("button", { name: `选择${templateName}模板` })
    : page.getByTestId("workspace-template-option").first()
  await templateOption.click()
  await expect(templateOption).toHaveAttribute("aria-pressed", "true")
  await expect(createButton).toBeEnabled()
  await createButton.click()
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/)
}

async function openEditorLinkedPage(page: Page, target: "preview" | "web") {
  const href = await page.locator(`a[href$="/${target}"]`).first().getAttribute("href")
  if (!href) {
    throw new Error(`编辑器缺少 ${target} 链接`)
  }
  await page.goto(new URL(href, page.url()).toString())
}

async function selectWebTemplateByName(page: Page, templateName: string) {
  await page.getByLabel("Web 模板").getByText(templateName, { exact: true }).click()
}

test("renders complete landing template previews", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  await page.goto("/#templates")
  const carousel = page.locator(".landing-template-grid")
  const sourceGroup = carousel.locator('[data-carousel-source="true"]')
  const cloneGroup = carousel.locator('[data-carousel-clone="true"]')
  const previews = sourceGroup.locator(".landing-template-sheet")
  await expect(previews).toHaveCount(24)
  await expect(cloneGroup).toHaveCount(1)
  await expect(cloneGroup.locator(".landing-template-sheet")).toHaveCount(24)
  await expect(cloneGroup).toHaveAttribute("aria-hidden", "true")
  await expect(cloneGroup).toHaveAttribute("inert", "")
  await expect(page.getByTestId("create-resume")).toHaveCount(0)
  await expect(page.getByTestId("create-resume-from-template")).toHaveCount(0)
  await expect(
    page.getByRole("link", { name: "进入工作台选择模板" }).first(),
  ).toBeVisible()
  await expect(sourceGroup.locator(".landing-template-document")).toHaveCount(24)
  await expect(previews.locator(".resume-document")).toHaveCount(24)
  await expect(previews.locator(".resume-profile")).toHaveCount(24)

  const audit = await previews.evaluateAll((sheets) =>
    sheets.map((sheet) => {
      const sheetRect = sheet.getBoundingClientRect()
      const renderedPage = sheet.querySelector(".resume-page-content")
      const renderedDocument = sheet.querySelector(".resume-document")
      const pageRect = renderedPage?.getBoundingClientRect()
      const documentRect = renderedDocument?.getBoundingClientRect()
      const focusableLinks = Array.from(sheet.querySelectorAll("a")).filter((link) => {
        link.focus()
        return document.activeElement === link
      })
      return {
        template: sheet.getAttribute("data-template"),
        pageCount: Number(sheet.getAttribute("data-page-count")),
        ariaHidden: sheet.getAttribute("aria-hidden"),
        inert: sheet.hasAttribute("inert"),
        widthDelta: pageRect
          ? Math.abs(pageRect.width - sheetRect.width)
          : Number.POSITIVE_INFINITY,
        heightDelta: pageRect
          ? Math.abs(pageRect.height - sheetRect.height)
          : Number.POSITIVE_INFINITY,
        documentWidthDelta: documentRect
          ? Math.abs(documentRect.width - sheetRect.width)
          : Number.POSITIVE_INFINITY,
        documentHeightDelta: documentRect
          ? Math.abs(documentRect.height - sheetRect.height)
          : Number.POSITIVE_INFINITY,
        sectionTypes: Array.from(
          renderedDocument?.querySelectorAll<HTMLElement>(".resume-section") ?? [],
          (section) => section.dataset.sectionType,
        ).toSorted(),
        focusableLinks: focusableLinks.length,
      }
    }),
  )

  expect(
    audit.filter(
      ({
        ariaHidden,
        documentHeightDelta,
        documentWidthDelta,
        focusableLinks,
        heightDelta,
        inert,
        pageCount,
        sectionTypes,
        widthDelta,
      }) =>
        pageCount !== 1 ||
        ariaHidden !== "true" ||
        !inert ||
        widthDelta > 1 ||
        heightDelta > 1 ||
        documentWidthDelta > 1 ||
        documentHeightDelta > 1 ||
        sectionTypes.join(",") !==
          "certification,education,project,skills,workExperience" ||
        focusableLinks > 0,
    ),
  ).toEqual([])

  await expect(carousel).toHaveAttribute("data-carousel-ready", "true")
  const initialScrollPosition = await carousel.evaluate((element) => element.scrollLeft)
  await expect
    .poll(() => carousel.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(initialScrollPosition + 4)

  await carousel.hover()
  await expect(carousel).toHaveAttribute("data-carousel-paused", "true")
  const pausedScrollPosition = await carousel.evaluate((element) => element.scrollLeft)
  await page.waitForTimeout(350)
  await expect
    .poll(() => carousel.evaluate((element) => element.scrollLeft))
    .toBeCloseTo(pausedScrollPosition, 0)

  await page.mouse.move(0, 0)
  await expect(carousel).toHaveAttribute("data-carousel-paused", "false")
  await expect
    .poll(() => carousel.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(pausedScrollPosition + 4)

  await createResumeFromLanding(page, "创意分栏")
  await expect(page.locator(".resume-document").first()).toHaveClass(
    /template-creative/,
  )
  await expect(page.locator(".style-template-current")).toContainText("创意分栏")

  await page.goto("/workspace")
  await expect(page.getByTestId("workspace-template-library")).toHaveCount(0)
  await expect(page.locator(".workspace-resume-grid").first()).toBeVisible()
  await page.getByTestId("new-resume").click()
  await expect(page.getByTestId("workspace-template-dialog")).toBeVisible()
  const dialogCreateButton = page.getByTestId("create-resume")
  await expect(dialogCreateButton).toBeDisabled()
  await page.getByRole("button", { name: "选择技术深色模板" }).click()
  await expect(dialogCreateButton).toBeEnabled()
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("workspace-template-dialog")).toHaveCount(0)
  await page.getByTestId("new-resume").click()
  await expect(page.getByTestId("workspace-template-dialog")).toBeVisible()
  await expect(dialogCreateButton).toBeDisabled()
  await page.getByRole("button", { name: "选择技术深色模板" }).click()
  await expect(dialogCreateButton).toBeEnabled()
  await dialogCreateButton.click()
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/)
  expect(consoleErrors).toEqual([])
})

test("animates landing navigation direction and smooth section jumps", async ({
  page,
}) => {
  await page.goto("/")
  const templatesLink = page.getByRole("link", { name: "模板", exact: true })
  const linkBox = await templatesLink.boundingBox()
  expect(linkBox).not.toBeNull()
  if (!linkBox) {
    return
  }

  const linkY = linkBox.y + linkBox.height / 2

  // 组件的 data-line-side 默认值就是 "left"，所以必须先制造 "right"，
  // 两个断言才都不是在验证默认值。
  // 在元素内部移动不会重新触发 pointerenter，只能靠从边缘离开来切换方向。
  await page.mouse.move(linkBox.x + linkBox.width + 60, linkY)
  await page.mouse.move(linkBox.x + linkBox.width - 2, linkY)
  await expect(templatesLink).toHaveAttribute("data-line-side", "right")
  await page.mouse.move(linkBox.x - 60, linkY)
  await expect(templatesLink).toHaveAttribute("data-line-side", "left")

  await templatesLink.click()
  await expect(page).toHaveURL(/#templates$/)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
})

test("connects the landing story through a shared editorial workbench", async ({
  page,
}) => {
  await page.goto("/")

  await expect(page.locator(".landing-section-index > span")).toHaveText([
    "02",
    "03",
    "04",
    "05",
    "06",
  ])
  await expect(page.locator(".landing-capability-grid > article")).toHaveCount(6)
  await expect(page.locator(".landing-workflow-track > article")).toHaveCount(3)
  await expect(page.locator(".landing-outcomes-source")).toContainText("ONE SOURCE")
  await expect(page.locator(".landing-template-context")).toContainText(
    "REAL A4 RENDER",
  )
  await expect(page.locator(".landing-nav")).toHaveCSS("position", "sticky")

  const footerRepositoryLink = page.getByRole("link", { name: /GitHub/ })
  await expect(footerRepositoryLink).toHaveAttribute(
    "href",
    "https://github.com/chaos-design/nantianmen",
  )
  await expect(footerRepositoryLink).toHaveAttribute("target", "_blank")
  await expect(footerRepositoryLink.locator("svg")).toHaveCount(1)
  await expect(page.locator(".landing-footer-links")).toContainText("服务条款")
  await expect(page.locator(".landing-footer-links")).toContainText("隐私政策")

  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.reload()
  const reducedMotionCarousel = page.locator(".landing-template-grid")
  await reducedMotionCarousel.scrollIntoViewIfNeeded()
  await expect(reducedMotionCarousel).toHaveAttribute("data-carousel-paused", "true")
  const reducedMotionScrollPosition = await reducedMotionCarousel.evaluate(
    (element) => element.scrollLeft,
  )
  await page.waitForTimeout(350)
  expect(
    await reducedMotionCarousel.evaluate((element) => element.scrollLeft),
  ).toBeCloseTo(reducedMotionScrollPosition, 0)
  const motionAudit = await page.evaluate(() => {
    const getAnimationName = (selector: string) => {
      const element = document.querySelector(selector)
      return element ? window.getComputedStyle(element).animationName : "missing"
    }
    return {
      capability: getAnimationName(".landing-capability-grid > article"),
      previewState: getAnimationName(".landing-preview-state i"),
      workflow: getAnimationName(".landing-workflow-track > article"),
    }
  })
  expect(motionAudit).toEqual({
    capability: "none",
    previewState: "none",
    workflow: "none",
  })
})

test("keeps the landing story focused and horizontally contained on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /简历写一次.*PDF 与链接都能直接交付。/,
    }),
  ).toBeVisible()
  await expect(
    page.getByText("不用到处找模板，不用打开 Word 反复调格式。", {
      exact: false,
    }),
  ).toBeVisible()

  const mobileCarousel = page.locator(".landing-template-grid")
  await mobileCarousel.scrollIntoViewIfNeeded()
  await expect(mobileCarousel).toHaveAttribute("data-carousel-ready", "true")

  const audit = await page.evaluate(() => {
    const templateGrid = document.querySelector<HTMLElement>(".landing-template-grid")
    const templateTrack = document.querySelector<HTMLElement>(".landing-template-track")
    const templateGroup = document.querySelector<HTMLElement>(".landing-template-group")
    const impact = document.querySelector<HTMLElement>(".landing-impact-comparison")
    const firstTemplate = templateGrid?.querySelector<HTMLElement>("article")
    const nav = document.querySelector<HTMLElement>(".landing-nav")

    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      templateTrackDisplay: templateTrack
        ? window.getComputedStyle(templateTrack).display
        : null,
      templateGroupDisplay: templateGroup
        ? window.getComputedStyle(templateGroup).display
        : null,
      templateClientWidth: templateGrid?.clientWidth ?? 0,
      templateScrollWidth: templateGrid?.scrollWidth ?? 0,
      firstTemplateWidth: firstTemplate?.getBoundingClientRect().width ?? 0,
      impactColumns: impact
        ? window.getComputedStyle(impact).gridTemplateColumns.split(" ").length
        : 0,
      navPosition: nav ? window.getComputedStyle(nav).position : "missing",
    }
  })

  expect(audit.pageWidth).toBeLessThanOrEqual(audit.viewportWidth + 1)
  expect(audit.templateTrackDisplay).toBe("flex")
  expect(audit.templateGroupDisplay).toBe("flex")
  expect(audit.templateScrollWidth).toBeGreaterThan(audit.templateClientWidth)
  expect(audit.firstTemplateWidth).toBeGreaterThan(250)
  expect(audit.firstTemplateWidth).toBeLessThan(audit.viewportWidth * 0.8)
  expect(audit.impactColumns).toBe(1)
  expect(audit.navPosition).toBe("relative")

  const mobileInitialPosition = await mobileCarousel.evaluate(
    (element) => element.scrollLeft,
  )
  await expect
    .poll(() => mobileCarousel.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(mobileInitialPosition + 4)

  await mobileCarousel.dispatchEvent("pointerdown", {
    bubbles: true,
    pointerId: 1,
    pointerType: "touch",
  })
  await expect(mobileCarousel).toHaveAttribute("data-carousel-paused", "true")
  const positionBeforeManualScroll = await mobileCarousel.evaluate(
    (element) => element.scrollLeft,
  )
  const manualScrollPosition = await mobileCarousel.evaluate((element) => {
    element.scrollLeft += 120
    return element.scrollLeft
  })
  expect(manualScrollPosition).toBeGreaterThan(positionBeforeManualScroll + 100)
  await page.waitForTimeout(350)
  expect(await mobileCarousel.evaluate((element) => element.scrollLeft)).toBeCloseTo(
    manualScrollPosition,
    0,
  )
  await page.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerId: 1,
        pointerType: "touch",
      }),
    )
  })
})

test("requires a workspace template selection and stays contained on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.getByRole("link", { name: "进入工作台选择模板" }).first().click()
  await expect(page).toHaveURL(/\/workspace$/)

  const newResumeButton = page.getByTestId("new-resume")
  const hasExistingResumes = await newResumeButton.isVisible()
  if (hasExistingResumes) {
    await expect(page.getByTestId("workspace-template-library")).toHaveCount(0)
    await newResumeButton.click()
  }

  const templateLibrary = hasExistingResumes
    ? page.getByTestId("workspace-template-dialog")
    : page.getByTestId("workspace-template-library")
  const workspaceHeader = page.locator(".workspace-header")
  const createButton = page.getByTestId("create-resume")
  const firstTemplate = page.getByTestId("workspace-template-option").first()
  await expect(templateLibrary).toBeVisible()
  await expect(workspaceHeader).toHaveCSS("position", "sticky")
  await expect(workspaceHeader).toHaveCSS("border-bottom-width", "0px")
  await expect(workspaceHeader).toHaveAttribute("data-scrolled", "false")
  await expect(page.getByTestId("workspace-template-option")).toHaveCount(24)
  await expect(createButton).toBeDisabled()

  const audit = await templateLibrary.evaluate((element) => {
    const grid = element.querySelector<HTMLElement>(".workspace-template-grid")
    const firstOption = grid?.querySelector<HTMLElement>(".workspace-template-option")
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      gridClientWidth: grid?.clientWidth ?? 0,
      gridScrollWidth: grid?.scrollWidth ?? 0,
      firstOptionWidth: firstOption?.getBoundingClientRect().width ?? 0,
    }
  })
  expect(audit.pageWidth).toBeLessThanOrEqual(audit.viewportWidth + 1)
  expect(audit.gridScrollWidth).toBeLessThanOrEqual(audit.gridClientWidth + 1)
  expect(audit.firstOptionWidth).toBeGreaterThan(140)
  expect(audit.firstOptionWidth).toBeLessThan(audit.gridClientWidth)

  await page.evaluate(() => window.scrollTo(0, 320))
  await expect(workspaceHeader).toHaveAttribute("data-scrolled", "true")
  await expect(workspaceHeader).not.toHaveCSS("box-shadow", "none")

  await firstTemplate.click()
  await expect(firstTemplate).toHaveAttribute("aria-pressed", "true")
  await expect(createButton).toBeEnabled()
})

test("exports every resume page when printing from the editor", async ({ page }) => {
  await page.goto("/")
  const origin = new URL(page.url()).origin
  const created = await page.request.post(`${origin}/api/resumes`, {
    headers: { origin },
    data: {},
  })
  const { data } = (await created.json()) as {
    data: { resume: { id: string; version: number; document: unknown } }
  }

  // 扩到多页，确保打印不是「只导出一页」这种无法从单页断言发现的缺陷。
  const resumeDocument = data.resume.document as {
    sections: Array<{
      items: Array<{ description: string; highlights: string[] }>
    }>
  }
  for (const section of resumeDocument.sections) {
    for (const item of section.items) {
      item.description = Array.from({ length: 6 }, (_, index) =>
        `第 ${index + 1} 段经历背景说明，`.repeat(6),
      ).join(" ")
      item.highlights = Array.from({ length: 6 }, (_, i) => `成果要点 ${i + 1}`)
    }
  }
  const patched = await page.request.patch(`${origin}/api/resumes/${data.resume.id}`, {
    headers: { origin },
    data: { expectedVersion: data.resume.version, document: resumeDocument },
  })
  expect(patched.ok()).toBe(true)

  await page.goto(`/editor/${data.resume.id}`)
  await page.locator(".a4-canvas").waitFor({ timeout: 30_000 })
  const pageWraps = await page.locator(".a4-page-wrap").count()
  expect(pageWraps).toBeGreaterThan(1)

  // 打印样式不能把页面容器压成单页高，否则多页简历只会导出一页。
  // 屏幕下预览是带缩放的，必须切到 print 媒体再量高度。
  await page.emulateMedia({ media: "print" })
  const printedHeights = await page.evaluate(() => {
    const wraps = Array.from(document.querySelectorAll<HTMLElement>(".a4-page-wrap"))
    return wraps.map((element) => element.getBoundingClientRect().height)
  })
  await page.emulateMedia({ media: null })
  expect(printedHeights.length).toBe(pageWraps)
  for (const height of printedHeights) {
    // A4 = 297mm ≈ 1123px @96dpi，允许亚像素误差。
    expect(height).toBeGreaterThan(1100)
  }

  const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true })
  const pdfPages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length
  expect(pdfPages).toBe(pageWraps)
})

test("drags a section block with a ghost slot that follows the pointer", async ({
  page,
}) => {
  await page.goto("/")
  // 本用例的主题是拖拽交互，用 API 建简历作为前置，避免 UI 导航的时序噪声。
  const origin = new URL(page.url() ?? "/").origin
  const created = await page.request.post(`${origin}/api/resumes`, {
    headers: { origin },
    data: {},
  })
  expect(created.ok()).toBe(true)
  const resumeId = (
    (await created.json()) as {
      data: { resume: { id: string } }
    }
  ).data.resume.id

  await page.goto(`/editor/${resumeId}`)

  const outline = page.locator(".editor-outline")
  // 内容结构在简历详情加载完成后才渲染，加载慢时需要比默认更长的等待。
  await expect(outline).toBeVisible({ timeout: 30_000 })
  const slots = outline.locator(".editor-section-slot")
  await expect(slots).not.toHaveCount(0)
  // 面板可能处于滚动位置，必须先把区块列表滚进视口，
  // 否则 boundingBox 的纵坐标为负，鼠标事件落在视口外，拖拽不会启动。
  await slots.first().scrollIntoViewIfNeeded()

  const titlesBefore = await outline
    .locator(".editor-section-select > span")
    .allTextContents()

  // 仅手柄可拖：在标题区域按下不应启动拖拽。
  // 这一步会切换 selectedSectionId，进而触发面板自动滚动，
  // 因此必须在它之后重新测量坐标，否则后续鼠标事件全部落空。
  const selectBox = await outline
    .locator(".editor-section-select")
    .first()
    .boundingBox()
  await page.mouse.move(
    (selectBox?.x ?? 0) + 8,
    (selectBox?.y ?? 0) + (selectBox?.height ?? 0) / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    (selectBox?.x ?? 0) + 8,
    (selectBox?.y ?? 0) + (selectBox?.height ?? 0) / 2 + 30,
    { steps: 6 },
  )
  await page.mouse.up()
  await expect(page.locator(".editor-section-row.is-overlay")).toHaveCount(0)

  // 从手柄拖起：整块浮层跟随指针，原位留下虚线幽灵槽位。
  await slots.first().scrollIntoViewIfNeeded()
  const sourceBox = await outline.locator(".editor-drag-handle").first().boundingBox()
  const secondBox = await slots.nth(1).boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  await page.mouse.move(
    (sourceBox?.x ?? 0) + (sourceBox?.width ?? 0) / 2,
    (sourceBox?.y ?? 0) + (sourceBox?.height ?? 0) / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    (sourceBox?.x ?? 0) + (sourceBox?.width ?? 0) / 2,
    (secondBox?.y ?? 0) + (secondBox?.height ?? 0) / 2,
    { steps: 12 },
  )

  // 幽灵槽位在被拖区块上，且随目标位置移动到第 2 个槽位之下。
  const ghostSlot = outline.locator('.editor-section-slot[data-dragging="true"]')
  await expect(ghostSlot).toHaveCount(1)
  // 虚线加在内层区块行上，槽位本身只是定位容器。
  await expect(ghostSlot.locator(".editor-section-row")).toHaveCSS(
    "border-style",
    "dashed",
  )
  const slotBox = await slots.nth(1).boundingBox()
  const ghostBox = await ghostSlot.boundingBox()
  expect(ghostBox?.y ?? 0).toBeGreaterThan((slotBox?.y ?? 0) + 1)

  // DragOverlay 渲染在 body 的 portal 中，不在 outline 内部。
  const overlay = page.locator(".editor-section-row.is-overlay")
  await expect(overlay).toHaveCount(1)
  // 浮层是整块卡片，不是只有手柄图标。
  const overlayBox = await overlay.boundingBox()
  expect(overlayBox?.width ?? 0).toBeGreaterThan((slotBox?.width ?? 0) * 0.8)

  await page.mouse.up()

  await expect(overlay).toHaveCount(0)
  await expect(outline.locator('[data-dragging="true"]')).toHaveCount(0)
  const titlesAfter = await outline
    .locator(".editor-section-select > span")
    .allTextContents()
  expect(titlesAfter).toEqual([
    titlesBefore[1],
    titlesBefore[0],
    ...titlesBefore.slice(2),
  ])
})

test("keeps workspace filters available and exposes complete card actions", async ({
  page,
}) => {
  await page.goto("/workspace")
  if (await page.getByTestId("workspace-template-library").isVisible()) {
    await page.getByTestId("workspace-template-option").first().click()
    await page.getByTestId("create-resume").click()
    await expect(page).toHaveURL(/\/editor\/[^/]+$/)
    await page.goto("/workspace")
  }

  const stickyFilters = page.locator(".workspace-library-sticky")
  const templateFilter = page.locator(".workspace-template-filter-trigger")
  await expect(stickyFilters).toHaveCSS("position", "sticky")
  await expect(templateFilter).toHaveAttribute("aria-label", "按模板筛选，全部模板")

  const templateFilterBox = await templateFilter.boundingBox()
  await templateFilter.click()
  const templateOptions = page.getByRole("menuitemcheckbox")
  const templateFilterMenu = page.locator(".workspace-template-filter-menu")
  await expect(templateOptions).toHaveCount(25)
  await expect(templateFilterMenu).toHaveAttribute("data-side", "bottom")
  await expect(templateFilterMenu).toHaveCSS("overflow-y", "auto")
  await templateFilterMenu.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  )
  const templateFilterMenuBox = await templateFilterMenu.boundingBox()
  expect(templateFilterBox).not.toBeNull()
  expect(templateFilterMenuBox).not.toBeNull()
  expect(templateFilterMenuBox?.y ?? 0).toBeGreaterThanOrEqual(
    (templateFilterBox?.y ?? 0) + (templateFilterBox?.height ?? 0),
  )
  expect(
    (templateFilterMenuBox?.y ?? 0) + (templateFilterMenuBox?.height ?? 0),
  ).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0)
  const menuScrollMetrics = await templateFilterMenu.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(menuScrollMetrics.scrollHeight).toBeGreaterThan(menuScrollMetrics.clientHeight)

  await templateFilterMenu.hover()
  await page.mouse.wheel(0, 2_000)
  await expect
    .poll(() =>
      templateFilterMenu.evaluate(
        (element) => element.scrollHeight - element.clientHeight - element.scrollTop,
      ),
    )
    .toBe(0)
  const lastTemplateOption = page.getByRole("menuitemcheckbox", {
    name: /奢尚零售/,
  })
  await lastTemplateOption.click()
  await expect(lastTemplateOption).toHaveAttribute("data-state", "checked")
  await expect(templateFilter).toContainText("奢尚零售")

  await page.mouse.wheel(0, -2_000)
  await expect
    .poll(() => templateFilterMenu.evaluate((element) => element.scrollTop))
    .toBe(0)
  await page.getByRole("menuitemcheckbox", { name: "全部模板" }).click()
  await page.getByRole("menuitemcheckbox", { name: /现代极简/ }).click()
  await page.getByRole("menuitemcheckbox", { name: /技术深色/ }).click()
  await expect(page.locator(".workspace-template-filter-trigger")).toContainText(
    "已选 2 个",
  )
  const filteredGroupCount = await page.locator(".workspace-resume-group").count()
  expect(filteredGroupCount).toBeGreaterThanOrEqual(1)
  expect(filteredGroupCount).toBeLessThanOrEqual(2)
  await page.getByRole("menuitemcheckbox", { name: "全部模板" }).click()
  await page.keyboard.press("Escape")

  const firstCard = page.locator(".workspace-resume-card").first()
  await expect(firstCard).toHaveCSS("cursor", "pointer")
  await firstCard.hover()
  await expect(firstCard.getByRole("link", { name: "进入编辑" })).toBeVisible()
  await expect(firstCard.getByRole("link", { name: "A4 预览" })).toBeVisible()
  await expect(firstCard.getByRole("button", { name: "删除简历" })).toBeVisible()

  const publishedCard = page
    .locator('.workspace-resume-card[data-published="true"]')
    .first()
  if ((await publishedCard.count()) > 0) {
    await publishedCard.hover()
    await expect(
      publishedCard.getByRole("link", { name: "打开 Web 分享页" }),
    ).toHaveAttribute("href", /\/r\/[^/]+\/web$/)
  } else {
    await expect(page.getByRole("link", { name: "打开 Web 分享页" })).toHaveCount(0)
  }

  await page.getByRole("button", { name: "管理" }).click()
  const firstManagedCard = page.locator(".workspace-resume-card").first()
  await expect(page.locator(".workspace-resume-actions")).toHaveCount(0)
  await expect(firstManagedCard).toHaveAttribute("role", "checkbox")
  await expect(firstManagedCard).toHaveAttribute("aria-checked", "false")
  await firstManagedCard.click()
  await expect(firstManagedCard).toHaveAttribute("aria-checked", "true")
  await expect(page.getByRole("button", { name: "批量删除" })).toBeVisible()
  await firstManagedCard.press("Enter")
  await expect(firstManagedCard).toHaveAttribute("aria-checked", "false")
  await page.getByRole("button", { name: "退出管理" }).click()

  const initialTop = await stickyFilters.evaluate(
    (element) => element.getBoundingClientRect().top,
  )
  await page.evaluate(() => window.scrollBy(0, 900))
  await expect
    .poll(() =>
      stickyFilters.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThanOrEqual(initialTop)
  await expect
    .poll(() =>
      stickyFilters.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeGreaterThanOrEqual(0)

  await page.getByTestId("new-resume").click()
  const createButton = page.getByTestId("create-resume")
  await expect(createButton).toHaveText("确定")
  await expect(page.getByText("尚未选择模板")).toBeVisible()
  await expect(
    page.getByText("创建后仍可在编辑器中更换模板和完善内容。", {
      exact: false,
    }),
  ).toBeVisible()
  await page.getByRole("button", { name: "选择现代极简模板" }).click()
  await expect(page.getByText("已选择「现代极简」")).toBeVisible()
})

test("uses a dense output console to close the landing page", async ({ page }) => {
  await page.goto("/")

  const finalCta = page.locator(".landing-final-cta")
  const outputConsole = page.getByRole("region", {
    name: "可生成的简历展示结果",
  })
  await expect(finalCta).toContainText("YOUR STORY, SHARPER")
  await expect(finalCta).toContainText("写一次，导出 PDF，也能直接发链接。")
  await expect(outputConsole.getByRole("article")).toHaveCount(3)
  await expect(outputConsole).toContainText("A4 简历")
  await expect(outputConsole).toContainText("Web 页面")
  await expect(outputConsole).toContainText("只读分享")

  const desktopAudit = await finalCta.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    columns: window.getComputedStyle(element).gridTemplateColumns.split(" ").length,
  }))
  expect(desktopAudit.height).toBeGreaterThanOrEqual(550)
  expect(desktopAudit.columns).toBe(2)

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileAudit = await finalCta.evaluate((element) => ({
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    columns: window.getComputedStyle(element).gridTemplateColumns.split(" ").length,
  }))
  expect(mobileAudit.pageWidth).toBeLessThanOrEqual(mobileAudit.viewportWidth + 1)
  expect(mobileAudit.columns).toBe(1)
})

test("generates and applies AI suggestions with explicit confirmation", async ({
  page,
}) => {
  const revisedDescription =
    "参与数据协作平台核心模块建设，并通过工程化治理持续改善交付质量。"
  const browserProvider = {
    modelName: "e2e-personal-model",
    baseUrl: "https://provider.example.com/v1",
    apiKey: "e2e-personal-key",
  }
  const globalProvider = {
    modelName: "e2e-global-model",
    baseUrl: "https://global-provider.example.com/v1",
    apiKey: "e2e-global-key",
  }
  let defaultConfigRequests = 0
  let targetItemId = ""
  let targetSectionItems: Array<{ id: string; description: string }> = []
  let receivedProviderConfig: typeof browserProvider | undefined
  await page.route("**/api/ai/default-config", async (route) => {
    defaultConfigRequests += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { providerConfig: globalProvider },
        requestId: "e2e-default-ai-config",
      }),
    })
  })
  await page.route("**/api/ai/test", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ok: true,
          provider: browserProvider.modelName,
        },
        requestId: "e2e-ai-test-request",
      }),
    })
  })
  await page.route("**/api/resumes/*/ai", async (route) => {
    const body = route.request().postDataJSON() as {
      task: "improve-content" | "interview-questions"
      targetSectionId: string | null
      providerConfig?: typeof browserProvider
      document: {
        sections: Array<{
          id: string
          items: Array<{
            id: string
            description: string
          }>
        }>
      }
    }
    receivedProviderConfig = body.providerConfig
    const targetSection = body.document.sections.find(
      (section) => section.id === body.targetSectionId,
    )
    targetSectionItems = targetSection?.items ?? []
    const targetItem = targetSectionItems[1] ?? targetSectionItems[0]
    targetItemId = targetItem?.id ?? ""
    // 模拟服务端按条目逐个生成：每个 item 一条建议，定位信息由服务端回填。
    const improvedItems = targetSection?.items ?? []
    const output =
      body.task === "improve-content"
        ? {
            type: "improve-content",
            suggestions: improvedItems.map((item) => ({
              id: `e2e-suggestion-${item.id}`,
              target: {
                sectionId: targetSection?.id ?? null,
                itemId: item.id,
                field: "description",
                index: null,
              },
              original: item.description,
              revised:
                item.id === targetItem?.id
                  ? revisedDescription
                  : `${item.description}（逐条独立优化）`,
              rationale: "突出动作与交付结果。",
            })),
          }
        : {
            type: "interview-questions",
            disclaimer: "基于简历内容生成，仅供面试准备参考。",
            questions: [
              {
                id: "e2e-question",
                category: "技术深度",
                question: "最关键的技术取舍是什么？",
                answerDirection: "说明候选方案、约束和最终决策。",
                keyPoints: ["候选方案", "约束条件", "最终决策"],
                suggestedAnswer:
                  "我会先说明可选方案，再结合性能与交付约束解释最终决策，并补充验证结果。",
                difficulty: "深入",
                relatedItemId: null,
              },
            ],
          }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          output,
          provider: "e2e-model",
        },
        requestId: "e2e-ai-request",
      }),
    })
  })

  await page.goto("/")
  await createResumeFromLanding(page)
  await page.getByRole("button", { name: "工作经历 2 条" }).click()

  const aiAssistantButton = page.getByRole("button", { name: "AI 助手" })
  await expect(aiAssistantButton).toBeEnabled()
  await expect(aiAssistantButton).toHaveCSS("cursor", "pointer")
  await expect(page.locator(".a4-page").first()).toHaveCSS("cursor", "pointer")
  await page.getByRole("button", { name: "更多操作" }).click()
  await expect(page.getByRole("menuitem", { name: "导入 JSON" })).toHaveCSS(
    "cursor",
    "pointer",
  )
  await page.keyboard.press("Escape")
  await aiAssistantButton.click()
  const assistant = page.locator(".ai-sheet")
  await expect(
    assistant.getByRole("heading", { name: "让表达经得起追问" }),
  ).toBeVisible()
  expect(defaultConfigRequests).toBe(1)
  await assistant.getByRole("button", { name: "模型配置" }).click()
  await expect(assistant.getByText("全局默认 Provider", { exact: true })).toBeVisible()
  await expect(
    assistant.getByText(globalProvider.modelName, { exact: true }),
  ).toBeVisible()
  await expect(
    assistant.getByText("当前值来自服务端全局配置", {
      exact: false,
    }),
  ).toBeVisible()
  await expect(assistant.getByLabel("模型名称")).toHaveValue(globalProvider.modelName)
  await expect(assistant.getByLabel("Base URL")).toHaveValue(globalProvider.baseUrl)
  await expect(assistant.locator("#ai-provider-api-key")).toHaveValue(
    globalProvider.apiKey,
  )
  await assistant.getByLabel("模型名称").fill(browserProvider.modelName)
  await assistant.getByLabel("Base URL").fill(browserProvider.baseUrl)
  await assistant.locator("#ai-provider-api-key").fill(browserProvider.apiKey)
  await assistant.getByRole("button", { name: "保存配置" }).click()
  await expect(assistant.getByText("浏览器 Provider", { exact: true })).toBeVisible()
  await expect(
    assistant.getByText(browserProvider.modelName, { exact: true }),
  ).toBeVisible()
  await expect(assistant.getByLabel("模型名称")).toHaveValue(browserProvider.modelName)
  await expect(assistant.getByLabel("Base URL")).toHaveValue(browserProvider.baseUrl)
  await expect(assistant.locator("#ai-provider-api-key")).toHaveAttribute(
    "type",
    "password",
  )
  await expect(
    page.getByText("模型配置已保存在当前浏览器", { exact: true }),
  ).toBeVisible()
  await assistant.getByRole("button", { name: "测试连接" }).click()
  await expect(page.getByText(`连接成功：${browserProvider.modelName}`)).toBeVisible()
  await assistant.getByRole("button", { name: "模型配置" }).click()

  // 指令抽屉：与 AI 助手同宽、位于右侧、关闭按钮明确。
  await assistant.getByRole("button", { name: "AI 指令" }).click()
  const promptSheet = page.locator(".ai-prompt-sheet")
  await expect(promptSheet.getByText("AI 指令", { exact: true })).toBeVisible()
  await expect(promptSheet.getByText("使用默认", { exact: true })).toBeVisible()
  const closeButton = promptSheet.getByRole("button", { name: "关闭指令面板" })
  await expect(closeButton).toBeVisible()
  const sheetWidth = (await promptSheet.boundingBox())?.width ?? 0
  expect(Math.round(sheetWidth)).toBe(560)

  // 一整块可编辑的完整 prompt，用户所见即模型所得。
  const promptEditor = promptSheet.getByLabel("AI 指令全文")
  await expect(promptEditor).toBeVisible()
  const defaultPrompt = await promptEditor.inputValue()
  // 内容以资深从业者视角写成，而不是流程说明。
  expect(defaultPrompt).toContain("你是资深技术招聘顾问")
  expect(defaultPrompt).toContain("6 秒")
  expect(defaultPrompt).toContain("输出结构")
  expect(defaultPrompt).toContain("必须为每个 unitId 恰好返回一条建议")
  // 不再有「系统固定部分」这类只读区域。
  await expect(promptSheet.getByTestId("ai-prompt-locked")).toHaveCount(0)
  await expect(promptSheet.getByText("系统固定部分")).toHaveCount(0)

  // 改一句，其余保持原样。
  await promptEditor.fill(defaultPrompt.replace("删掉装饰性表达", "删掉所有装饰性表达"))
  await expect(promptSheet.getByText("已自定义", { exact: true })).toBeVisible()
  const editedPrompt = await promptEditor.inputValue()
  expect(editedPrompt).toContain("删掉所有装饰性表达")
  // 核心保证：只改一句不会丢掉其余默认指令。
  expect(editedPrompt).toContain("你是资深技术招聘顾问")
  expect(editedPrompt).toContain("必须为每个 unitId 恰好返回一条建议")

  // 删掉输出结构时给出警告，点保存后弹出确认框，取消则不落盘。
  await promptEditor.fill("只回答一句话。")
  await expect(promptSheet.getByRole("alert")).toContainText("输出结构定义不完整")
  await promptSheet.getByRole("button", { name: "保存" }).click()

  const structureDialog = page.getByRole("alertdialog")
  await expect(structureDialog).toBeVisible()
  await expect(structureDialog).toContainText("输出结构")
  // toBeVisible 不检测遮挡。确认框嵌在 z-60 的抽屉里，必须额外验证
  // 它确实是该位置最上层的元素，否则会被抽屉整个盖住。
  const topmostIsDialog = await structureDialog.evaluate((node) => {
    const rect = node.getBoundingClientRect()
    const top = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    )
    return Boolean(top && node.contains(top))
  })
  expect(topmostIsDialog).toBe(true)
  await structureDialog.getByRole("button", { name: "返回修改" }).click()
  await expect(structureDialog).toHaveCount(0)
  // 取消后不应写入任何本地存储。
  expect(
    await page.evaluate(() =>
      Object.keys(window.localStorage).find((key) =>
        key.startsWith("resume-ai:prompts:v3:"),
      ),
    ),
  ).toBeUndefined()

  // 恢复完整内容后正常保存。
  await promptEditor.fill(editedPrompt)
  await promptSheet.getByRole("button", { name: "保存" }).click()
  await expect(page.getByText("指令已保存，下次生成时生效")).toBeVisible()

  // 只持久化被改过的那一项，另一个任务保持默认。
  const storedPrompts = await page.evaluate(() => {
    const entry = Object.entries(window.localStorage).find(([key]) =>
      key.startsWith("resume-ai:prompts:v3:"),
    )
    return entry?.[1] ?? null
  })
  expect(storedPrompts).toContain("删掉所有装饰性表达")
  expect(storedPrompts).toContain('"interviewQuestions":""')

  await closeButton.click()

  await expect(assistant.getByRole("tab", { name: "内容优化" })).toHaveCSS(
    "cursor",
    "pointer",
  )
  await assistant.getByRole("button", { name: "生成内容优化" }).click()
  await expect.poll(() => receivedProviderConfig).toEqual(browserProvider)
  // 每个条目一条建议，互不合并。
  await expect(assistant.locator('[data-result-kind="improvement"]')).toHaveCount(2)
  await expect(assistant.locator("[data-locator]")).toHaveCount(2)
  const improvementCard = assistant.locator('[data-result-kind="improvement"]').first()
  await expect(improvementCard.getByText("优化理由", { exact: true })).toBeVisible()
  await expect(improvementCard.getByText("原文", { exact: true })).toBeVisible()
  await expect(improvementCard.getByText("优化稿", { exact: true })).toBeVisible()
  await expect(assistant.getByText(revisedDescription, { exact: true })).toBeVisible()
  await expect(assistant.locator(".ai-pending-count")).toBeVisible()
  const comparisonColors = await improvementCard.evaluate((element) => {
    const original = element.querySelector<HTMLElement>('[data-tone="original"]')
    const revised = element.querySelector<HTMLElement>('[data-tone="revised"]')
    return {
      originalBackground: original ? getComputedStyle(original).backgroundImage : "",
      revisedBackground: revised ? getComputedStyle(revised).backgroundImage : "",
      originalBorder: original ? getComputedStyle(original).borderColor : "",
      revisedBorder: revised ? getComputedStyle(revised).borderColor : "",
    }
  })
  expect(comparisonColors.revisedBackground).not.toBe(
    comparisonColors.originalBackground,
  )
  expect(comparisonColors.revisedBorder).not.toBe(comparisonColors.originalBorder)
  // 未应用前，编辑器对应条目显示待应用标记。
  const pendingItemId = targetSectionItems?.[0]?.id
  if (pendingItemId && pendingItemId !== targetItemId) {
    await expect(
      page.locator(`[data-editor-item-id="${pendingItemId}"]`),
    ).toHaveAttribute("data-ai-pending", "true")
  }

  // 定位按钮只跳转不写入：按条目顺序定位到目标条目的那张卡片。
  const targetCardIndex = targetSectionItems.findIndex(
    (item) => item.id === targetItemId,
  )
  // 差异高亮落在真正被改写的那张卡片上：原文标删除，优化稿标新增。
  const diffMarks = await assistant
    .locator('[data-result-kind="improvement"]')
    .nth(targetCardIndex)
    .evaluate((element) => ({
      removed: Array.from(
        element.querySelectorAll('[data-tone="original"] mark[data-diff="removed"]'),
      ).map((node) => node.textContent ?? ""),
      added: Array.from(
        element.querySelectorAll('[data-tone="revised"] mark[data-diff="added"]'),
      ).map((node) => node.textContent ?? ""),
      originalText:
        element.querySelector<HTMLElement>('[data-tone="original"] p')?.textContent ??
        "",
      revisedText:
        element.querySelector<HTMLElement>('[data-tone="revised"] p')?.textContent ??
        "",
    }))
  // 高亮只是文本的划分：去掉标记后两侧文本必须与原文/优化稿完全一致。
  expect(diffMarks.originalText).toBe(targetSectionItems[targetCardIndex].description)
  expect(diffMarks.revisedText).toBe(revisedDescription)
  expect(diffMarks.removed.join("")).not.toBe("")
  expect(diffMarks.added.join("")).not.toBe("")
  // 共有字符不应被整体标红。
  expect(diffMarks.added.join("").length).toBeLessThan(revisedDescription.length)
  await assistant
    .locator('[data-result-kind="improvement"]')
    .nth(targetCardIndex)
    .getByRole("button", { name: "定位" })
    .click()
  await expect(page.locator(`[data-editor-item-id="${targetItemId}"]`)).toHaveAttribute(
    "data-ai-focused",
    "true",
  )

  await assistant
    .locator('[data-result-kind="improvement"]')
    .nth(targetCardIndex)
    .getByRole("button", { name: "应用建议" })
    .click()
  await expect(
    assistant
      .locator('[data-result-kind="improvement"]')
      .nth(targetCardIndex)
      .getByRole("button", { name: "已应用" }),
  ).toBeDisabled()
  await expect(
    page.getByText("已应用到：工作经历 / 前端工程师 / 描述", {
      exact: true,
    }),
  ).toBeVisible()
  const editorTarget = page.locator(`[data-editor-item-id="${targetItemId}"]`)
  await expect(editorTarget).toHaveAttribute("data-expanded", "true")
  const editorFocusTarget = page.locator(
    `[data-editor-item-focus-id="${targetItemId}"]`,
  )
  await expect
    .poll(() =>
      editorFocusTarget.evaluate((element) => {
        const viewport = element
          .closest(".content-editor-panel")
          ?.querySelector<HTMLElement>(
            '.content-editor-scroll [data-slot="scroll-area-viewport"]',
          )
        if (!viewport) {
          return false
        }
        const targetRect = element.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        return (
          targetRect.top >= viewportRect.top && targetRect.bottom <= viewportRect.bottom
        )
      }),
    )
    .toBe(true)
  const previewTarget = page
    .locator(`.a4-canvas [data-item-id="${targetItemId}"]`)
    .first()
  await expect(previewTarget).toHaveAttribute("data-json-linked", "true")
  await expect(assistant.getByText("模型：e2e-model")).toBeVisible()

  await assistant.getByRole("tab", { name: "面试问题" }).click()
  await assistant.getByRole("button", { name: "生成面试问题" }).click()
  const questionCard = assistant.locator('[data-result-kind="interview"]').first()
  await expect(questionCard).toHaveAttribute("data-difficulty", "深入")
  await expect(questionCard.getByText("01", { exact: true })).toBeVisible()
  await expect(
    questionCard.getByText("最关键的技术取舍是什么？", { exact: true }),
  ).toBeVisible()
  await expect(questionCard.getByText("回答重点", { exact: true })).toBeVisible()
  for (const point of ["候选方案", "约束条件", "最终决策"]) {
    await expect(questionCard.getByText(point, { exact: true })).toBeVisible()
  }
  await expect(questionCard.getByText("答题思路", { exact: true })).toBeVisible()
  await expect(
    questionCard.getByText("说明候选方案、约束和最终决策。", { exact: true }),
  ).toBeVisible()
  await expect(questionCard.getByText("建议回答", { exact: true })).toBeVisible()
  await expect(
    questionCard.getByText(
      "我会先说明可选方案，再结合性能与交付约束解释最终决策，并补充验证结果。",
      { exact: true },
    ),
  ).toBeVisible()
  const interviewColors = await questionCard.evaluate((element) => {
    const category = element.querySelector<HTMLElement>(".ai-question-category")
    const difficulty = element.querySelector<HTMLElement>(".ai-question-difficulty")
    const keyPoints = element.querySelector<HTMLElement>(".ai-key-points")
    const suggestedAnswer = element.querySelector<HTMLElement>(".ai-suggested-answer")
    return {
      categoryColor: category ? getComputedStyle(category).color : "",
      difficultyColor: difficulty ? getComputedStyle(difficulty).color : "",
      keyPointsBorder: keyPoints ? getComputedStyle(keyPoints).borderColor : "",
      suggestedAnswerBorder: suggestedAnswer
        ? getComputedStyle(suggestedAnswer).borderColor
        : "",
    }
  })
  expect(interviewColors.categoryColor).not.toBe(interviewColors.difficultyColor)
  expect(interviewColors.keyPointsBorder).not.toBe(
    interviewColors.suggestedAnswerBorder,
  )

  await page.reload()
  await page.getByRole("button", { name: "AI 助手" }).click()
  const reloadedAssistant = page.locator(".ai-sheet")
  await reloadedAssistant.getByRole("button", { name: "模型配置" }).click()
  await expect(
    reloadedAssistant.getByText("浏览器 Provider", { exact: true }),
  ).toBeVisible()
  await expect(
    reloadedAssistant.getByText(browserProvider.modelName, { exact: true }),
  ).toBeVisible()
  expect(defaultConfigRequests).toBe(1)
  await reloadedAssistant.getByRole("button", { name: "删除个人配置" }).click()
  await reloadedAssistant.getByRole("button", { name: "模型配置" }).click()
  await expect(
    reloadedAssistant.getByText("全局默认 Provider", { exact: true }),
  ).toBeVisible()
  await expect(
    reloadedAssistant.getByText(globalProvider.modelName, { exact: true }),
  ).toBeVisible()
  expect(defaultConfigRequests).toBe(2)
  await expect(
    reloadedAssistant.getByRole("button", { name: "生成内容优化" }),
  ).toBeEnabled()
})

test("preserves native form editing and scrolls selected sections into preview", async ({
  page,
}) => {
  await page.goto("/")
  await createResumeFromLanding(page)
  await page.getByRole("button", { name: "工作经历 2 条" }).click()

  const title = page.getByLabel("标题").first()
  const description = page.getByLabel("背景描述").first()
  const highlights = page.getByLabel("成果要点").first()
  const skills = page.getByLabel("相关技能").first()

  await skills.fill("React, TypeScript")
  await skills.evaluate((element) => {
    ;(element as HTMLTextAreaElement).setSelectionRange(5, 5)
  })
  await skills.press(",")
  await expect
    .poll(() =>
      skills.evaluate((element) => (element as HTMLTextAreaElement).selectionStart),
    )
    .toBe(6)
  await page.keyboard.insertText(" Vue")
  await expect(skills).toHaveValue("React, Vue, TypeScript")

  await highlights.fill("第一条成果")
  await highlights.press("End")
  await highlights.press("Enter")
  await expect(highlights).toHaveValue("第一条成果\n")
  await page.keyboard.insertText("第二条成果")
  await expect(highlights).toHaveValue("第一条成果\n第二条成果")

  for (const [field, replacement] of [
    [title, "全选替换标题"],
    [description, "全选替换背景描述"],
    [highlights, "全选替换成果"],
    [skills, "React，TypeScript\nNext.js"],
  ] as const) {
    await field.fill("等待全选替换")
    await field.focus()
    await page.keyboard.press("Control+A")
    await page.keyboard.insertText(`Ctrl ${replacement}`)
    await expect(field).toHaveValue(`Ctrl ${replacement}`)
    await page.keyboard.press("Meta+A")
    await page.keyboard.insertText(replacement)
    await expect(field).toHaveValue(replacement)
  }

  const fontSize = page.getByLabel("正文字号")
  await fontSize.fill("12")
  await fontSize.focus()
  await page.keyboard.press("Control+A")
  await page.keyboard.insertText("14")
  await expect(fontSize).toHaveValue("14")
  await page.keyboard.press("Meta+A")
  await page.keyboard.insertText("13")
  await expect(fontSize).toHaveValue("13")

  const colorShortcutPrevented = await page
    .getByLabel("强调色颜色选择器")
    .evaluate((element) => {
      const event = new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      element.dispatchEvent(event)
      return event.defaultPrevented
    })
  expect(colorShortcutPrevented).toBe(false)

  await expect(
    page
      .locator(".a4-canvas .resume-inline-skills")
      .getByText("React", {
        exact: true,
      })
      .first(),
  ).toBeVisible()
  await expect(
    page
      .locator(".a4-canvas .resume-inline-skills")
      .getByText("TypeScript", {
        exact: true,
      })
      .first(),
  ).toBeVisible()
  await expect(
    page
      .locator(".a4-canvas .resume-inline-skills")
      .getByText("Next.js", {
        exact: true,
      })
      .first(),
  ).toBeVisible()

  const canvas = page.locator(".a4-canvas")
  const previewViewport = page.locator(
    '.editor-stage-scroll [data-slot="scroll-area-viewport"]',
  )
  const laterSection = await canvas
    .locator("[data-section-id]")
    .evaluateAll((elements) => {
      const sections = elements
        .map((element) => ({
          id: element.getAttribute("data-section-id") ?? "",
          pageIndex: Number(
            element.closest<HTMLElement>("[data-page-index]")?.dataset.pageIndex,
          ),
          title: element.querySelector("h2")?.textContent?.trim() ?? "",
        }))
        .filter(
          (section) =>
            section.id &&
            section.title &&
            Number.isInteger(section.pageIndex) &&
            section.pageIndex >= 0,
        )
      return (
        sections.find(
          (section) =>
            section.pageIndex > 0 &&
            !sections.some(
              (candidate) =>
                candidate.id === section.id && candidate.pageIndex < section.pageIndex,
            ),
        ) ?? null
      )
    })

  expect(laterSection).not.toBeNull()
  if (!laterSection) {
    throw new Error("测试简历缺少后续页区块")
  }

  await previewViewport.evaluate((element) => {
    element.scrollTop = 0
  })
  await page
    .locator(".editor-section-select")
    .filter({ hasText: laterSection.title })
    .first()
    .click()

  const laterTarget = canvas.locator(
    `[data-page-index="${laterSection.pageIndex}"] [data-section-id="${laterSection.id}"]`,
  )
  await expect
    .poll(() =>
      laterTarget.evaluate((element) => {
        const viewport = element
          .closest(".editor-stage-panel")
          ?.querySelector('.editor-stage-scroll [data-slot="scroll-area-viewport"]')
        if (!viewport) {
          return false
        }
        const targetRect = element.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        return (
          targetRect.bottom > viewportRect.top && targetRect.top < viewportRect.bottom
        )
      }),
    )
    .toBe(true)
  await expect(
    canvas.locator(`[data-page-index="${laterSection.pageIndex}"]`),
  ).toHaveAttribute("data-selected", "true")

  await previewViewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.getByRole("button", { name: "个人信息" }).click()
  const profileTarget = canvas.locator('[data-section-id="profile"]').first()
  await expect
    .poll(() =>
      profileTarget.evaluate((element) => {
        const viewport = element
          .closest(".editor-stage-panel")
          ?.querySelector('.editor-stage-scroll [data-slot="scroll-area-viewport"]')
        if (!viewport) {
          return false
        }
        const targetRect = element.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        return (
          targetRect.bottom > viewportRect.top && targetRect.top < viewportRect.bottom
        )
      }),
    )
    .toBe(true)
  await expect(canvas.locator('[data-page-index="0"]')).toHaveAttribute(
    "data-selected",
    "true",
  )
})

test("renders every web resume template without saving", async ({ page }) => {
  const consoleErrors: string[] = []
  let patchRequests = 0
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      /\/api\/resumes\/[^/]+$/.test(new URL(request.url()).pathname)
    ) {
      patchRequests += 1
    }
  })

  await page.goto("/")
  await createResumeFromLanding(page)
  await openEditorLinkedPage(page, "web")
  const preview = page.locator(".resume-web-page")
  const webContent = preview.locator(".web-resume-content")
  const templates = [
    ["digital-archive", "数字档案"],
    ["editorial-canvas", "编辑画布"],
    ["kinetic-grid", "动态网格"],
    ["executive-noir", "高管黑金"],
    ["portfolio-studio", "作品工作室"],
    ["terminal-signal", "终端信号"],
    ["paper-journal", "纸张期刊"],
    ["swiss-ledger", "瑞士账本"],
    ["bauhaus-poster", "包豪斯海报"],
    ["aurora-glass", "极光玻璃"],
    ["botanical-editorial", "植物编辑"],
    ["mono-brutalist", "黑白粗野"],
    ["clay-studio", "陶土工作室"],
    ["midnight-product", "午夜产品"],
    ["solar-future", "日光未来"],
    ["analog-radio", "模拟电台"],
    ["capital-deck", "资本路演"],
    ["luxury-retail", "奢华零售"],
    ["cloud-architecture", "云端架构"],
    ["security-command", "安全指挥"],
  ] as const
  const visualTokens: string[] = []
  const motionFamilies: string[] = []

  await expect(page.getByText(/\d{2} templates/)).toBeVisible()
  await expect(page.getByRole("radio")).toHaveCount(templates.length)
  await expect(preview).toHaveAttribute("data-template-ready", "true")
  await expect(preview).toHaveAttribute("data-gsap-motion", "active")
  await expect(preview).toHaveAttribute("data-gsap-family", "archive-orbit")
  await expect(preview.locator("[data-gsap-layer]")).toHaveCount(3)
  await expect(preview.getByRole("link", { name: /个人信息/ })).toBeVisible()
  await expect(preview.locator(".web-resume-hero-visual")).toHaveCount(0)
  await expect(preview.locator(".web-resume-hero img")).toHaveCount(0)
  const profilePosition = await preview.locator(".web-resume-hero").evaluate((hero) => {
    const copy = hero.querySelector<HTMLElement>(".web-resume-hero-copy")
    const root = hero.closest<HTMLElement>(".resume-web-page")
    if (!copy || !root) {
      return null
    }
    const heroRect = hero.getBoundingClientRect()
    const copyRect = copy.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    return {
      centerRatio:
        (copyRect.top + copyRect.height / 2 - rootRect.top) / root.clientHeight,
      heroCenterRatio:
        (copyRect.top + copyRect.height / 2 - heroRect.top) / heroRect.height,
    }
  })
  expect(profilePosition).not.toBeNull()
  expect(profilePosition?.centerRatio).toBeGreaterThan(0.38)
  expect(profilePosition?.centerRatio).toBeLessThan(0.48)
  expect(profilePosition?.heroCenterRatio).toBeGreaterThan(0.3)
  expect(profilePosition?.heroCenterRatio).toBeLessThan(0.49)
  await expect(preview.locator(".web-resume-hero-copy")).toHaveCSS(
    "animation-duration",
    "0.9s",
  )
  await expect(preview.locator(".web-resume-summary")).toHaveCSS(
    "animation-name",
    "web-profile-detail-in",
  )
  await page.waitForTimeout(1_200)
  const profileCopy = preview.locator(".web-resume-hero-copy")
  const profilePositionBeforeAmbientMotion = await profileCopy.boundingBox()
  await page.waitForTimeout(600)
  const profilePositionAfterAmbientMotion = await profileCopy.boundingBox()
  expect(profilePositionBeforeAmbientMotion).not.toBeNull()
  expect(profilePositionAfterAmbientMotion).not.toBeNull()
  expect(
    Math.abs(
      (profilePositionAfterAmbientMotion?.x ?? 0) -
        (profilePositionBeforeAmbientMotion?.x ?? 0),
    ),
  ).toBeLessThanOrEqual(0.5)
  expect(
    Math.abs(
      (profilePositionAfterAmbientMotion?.y ?? 0) -
        (profilePositionBeforeAmbientMotion?.y ?? 0),
    ),
  ).toBeLessThanOrEqual(0.5)

  const sidebar = page.locator(".web-template-sidebar")
  const sidebarHeading = sidebar.locator(".web-template-sidebar-heading")
  const sidebarHeadingBox = await sidebarHeading.boundingBox()
  expect(sidebarHeadingBox).not.toBeNull()
  expect(sidebarHeadingBox?.height ?? 0).toBeGreaterThanOrEqual(64)
  expect(sidebarHeadingBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(132)
  const stickyAudit = await sidebar.evaluate((element) => {
    const heading = element.querySelector<HTMLElement>(".web-template-sidebar-heading")
    if (!heading) {
      return null
    }
    const sidebarTop = element.getBoundingClientRect().top
    const initialTop = heading.getBoundingClientRect().top
    element.scrollTop = element.scrollHeight
    return {
      position: getComputedStyle(heading).position,
      topGap: Math.abs(initialTop - sidebarTop),
      topDelta: Math.abs(heading.getBoundingClientRect().top - initialTop),
    }
  })
  expect(stickyAudit).toEqual({ position: "sticky", topGap: 0, topDelta: 0 })
  await sidebar.evaluate((element) => {
    element.scrollTop = 0
  })

  expect(
    await preview
      .locator(".web-resume-hero h1")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeLessThanOrEqual(112)

  await webContent.evaluate((element) => {
    element.style.scrollBehavior = "auto"
    element.scrollTop = 160
  })
  await expect.poll(() => webContent.evaluate((element) => element.scrollTop)).toBe(160)
  await selectWebTemplateByName(page, "编辑画布")
  await expect(preview).toHaveAttribute("data-template-motion", "editorial-canvas")
  await expect(preview).toHaveAttribute("data-template-ready", "true")
  expect(
    await webContent.evaluate((element) => element.scrollTop),
  ).toBeGreaterThanOrEqual(150)
  await selectWebTemplateByName(page, "数字档案")
  await expect(preview).toHaveAttribute("data-template-ready", "true")
  await webContent.evaluate((element) => {
    element.scrollTop = 0
  })

  for (const [templateId, templateName] of templates) {
    if (templateId !== "digital-archive") {
      await selectWebTemplateByName(page, templateName)
    }
    await expect(preview).toHaveAttribute("data-web-template", templateId)
    await expect(preview).toHaveAttribute("data-template-motion", templateId)
    await expect(preview).toHaveAttribute("data-template-ready", "true")
    await expect(preview).toHaveAttribute("data-gsap-motion", "active")
    motionFamilies.push((await preview.getAttribute("data-gsap-family")) ?? "")
    visualTokens.push(
      await preview.evaluate((element) => {
        const style = getComputedStyle(element)
        return [
          style.getPropertyValue("--web-background"),
          style.getPropertyValue("--web-accent"),
          element.getAttribute("data-composition"),
        ].join("|")
      }),
    )
  }

  expect(new Set(visualTokens).size).toBe(20)
  expect(new Set(motionFamilies).size).toBe(20)

  await selectWebTemplateByName(page, "数字档案")
  await expect(preview).toHaveAttribute("data-template-ready", "true")
  await expect(preview.locator(".web-resume-module-items").first()).toHaveCSS(
    "border-left-width",
    "1px",
  )

  await selectWebTemplateByName(page, "编辑画布")
  await expect(preview).toHaveAttribute("data-template-ready", "true")
  await expect(preview.locator(".web-resume-module-items").first()).toHaveCSS(
    "display",
    "flex",
  )
  await expect(preview.locator(".web-resume-module-items").first()).toHaveCSS(
    "flex-direction",
    "column",
  )

  await selectWebTemplateByName(page, "作品工作室")
  await expect(preview).toHaveAttribute("data-template-ready", "true")
  await expect(
    preview.locator(
      '.web-resume-module[data-module-type="project"] .web-resume-module-items',
    ),
  ).toHaveCSS("display", "flex")

  await selectWebTemplateByName(page, "午夜产品")
  await expect(preview).toHaveAttribute("data-template-ready", "true")
  await expect(preview.locator(".web-resume-module-items").first()).toHaveCSS(
    "display",
    "flex",
  )
  await expect(preview.locator(".web-resume-module-items").first()).toHaveCSS(
    "flex-direction",
    "column",
  )

  await page.emulateMedia({ reducedMotion: "reduce" })
  await selectWebTemplateByName(page, "终端信号")
  await expect(preview).toHaveAttribute("data-template-ready", "true")
  await expect(preview).toHaveAttribute("data-gsap-motion", "reduced")
  await expect(preview.locator("[data-gsap-layer]").first()).toHaveCSS(
    "transform",
    "none",
  )
  await expect(preview.locator(".web-resume-grid")).toHaveCSS("animation-name", "none")
  await expect(preview.locator(".web-resume-summary")).toHaveCSS(
    "animation-name",
    "none",
  )
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await expect(preview).toHaveAttribute("data-gsap-motion", "active")

  expect(patchRequests).toBe(0)
  await expect(page.getByRole("button", { name: "分享当前效果" })).toBeDisabled()
  await expect(page.getByText("请先返回编辑器发布后再分享")).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(sidebarHeading).toHaveCSS("position", "static")
  await expect(preview.locator(".web-resume-hero-copy")).toHaveCSS("transform", "none")
  for (const [templateId, templateName] of [
    ["bauhaus-poster", "包豪斯海报"],
    ["midnight-product", "午夜产品"],
    ["solar-future", "日光未来"],
    ["analog-radio", "模拟电台"],
  ] as const) {
    await selectWebTemplateByName(page, templateName)
    await expect(preview).toHaveAttribute("data-web-template", templateId)
    await page.waitForTimeout(1_000)
    const overflowAudit = await preview.evaluate((element) => {
      const rootRect = element.getBoundingClientRect()
      return Array.from(element.querySelectorAll<HTMLElement>("*"))
        .map((child) => {
          const rect = child.getBoundingClientRect()
          return {
            selector: `${child.tagName.toLowerCase()}.${child.className}`,
            left: Math.round((rootRect.left - rect.left) * 10) / 10,
            right: Math.round((rect.right - rootRect.right) * 10) / 10,
          }
        })
        .filter(({ left, right }) => left > 1 || right > 1)
        .slice(0, 8)
    })
    expect(overflowAudit).toEqual([])
    expect(
      await preview.locator(".web-resume-hero").evaluate((element) => {
        const columns = getComputedStyle(element).gridTemplateColumns
        return columns.split(" ").filter(Boolean).length
      }),
    ).toBe(1)
  }

  await page.reload()
  await expect(page.getByRole("radio", { name: /数字档案/ })).toBeChecked()
  await expect(preview).toHaveAttribute("data-web-template", "digital-archive")
  expect(consoleErrors).toEqual([])
})

test("copies the current web template to clipboard without platform footer", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.goto("/")
  await createResumeFromLanding(page)
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/)
  await page.getByTestId("publish-resume").click()
  await expect(page.getByRole("heading", { name: "简历已发布" })).toBeVisible()
  const shareUrl = await page.getByLabel("分享链接").inputValue()
  await page.keyboard.press("Escape")

  const webPageHref = await page
    .getByRole("link", { name: "Web 页面" })
    .getAttribute("href")
  if (!webPageHref) {
    throw new Error("Web 页面链接缺少 href")
  }
  await page.goto(webPageHref)
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => Promise.reject(new Error("不应调用 navigator.share")),
    })
  })
  await expect(page.locator(".web-resume-footer")).toHaveCount(0)
  await expect(page.getByText("基于结构化简历数据生成")).toHaveCount(0)
  await selectWebTemplateByName(page, "终端信号")
  await expect(page.getByRole("radio", { name: /终端信号/ })).toBeChecked()
  await page.getByRole("button", { name: "分享当前效果" }).click()
  await expect(page.getByText("分享链接已复制")).toBeVisible()

  const sharedWebUrl = await page.evaluate(() => navigator.clipboard.readText())
  expect(sharedWebUrl).toBe(`${shareUrl}/web?template=terminal-signal`)
  await page.goto(sharedWebUrl)
  await expect(page.locator(".resume-web-page")).toHaveAttribute(
    "data-web-template",
    "terminal-signal",
  )
  await expect(page.locator(".web-resume-footer")).toHaveCount(0)
  await expect(page.getByText("基于结构化简历数据生成")).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})

test("creates, edits, publishes, and shares a resume", async ({ page }) => {
  // 这是全流程最长的一条用例：建简历、表单/JSON/A4/样式/模板多轮编辑、
  // 面板折叠展开、发布、分享与资源授权校验，单条就覆盖上千行断言。默认
  // 180s（即便放宽到 300s）在冷编译或 CI 上仍会超时，这里按实测留足余量。
  test.setTimeout(600_000)
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    })
  })

  await page.goto("/")
  await createResumeFromLanding(page)
  await expect(page.getByRole("tab", { name: "表单编辑" })).toHaveAttribute(
    "data-state",
    "active",
  )
  await expect(page.locator(".editor-stage-header")).toHaveCount(0)
  await expect(page.locator(".style-inspector-header")).toHaveCount(0)
  await expect(
    page.locator('.editor-toolbar [data-testid="save-status"]'),
  ).toBeVisible()
  await expect(
    page.locator('.editor-brand-area [data-testid="save-status"]'),
  ).toHaveCount(0)
  for (const name of ["全页预览", "Web 页面"]) {
    const action = page.getByRole("link", { name, exact: true })
    await expect(action).toHaveAttribute("aria-label", name)
    await expect(action).toHaveCSS("width", "32px")
    await expect(action.locator(".editor-preview-action-label")).toBeHidden()
    expect(
      await action.evaluate((element) => {
        const icon = element.querySelector("svg")
        if (!icon) {
          return Number.POSITIVE_INFINITY
        }
        const actionRect = element.getBoundingClientRect()
        const iconRect = icon.getBoundingClientRect()
        return Math.abs(
          actionRect.left + actionRect.width / 2 - (iconRect.left + iconRect.width / 2),
        )
      }),
    ).toBeLessThan(0.5)
    await action.hover()
    await expect(page.getByRole("tooltip").filter({ hasText: name })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("tooltip")).toBeHidden()
  }

  const contentPanel = page.locator(".content-editor-panel")
  const panelResizer = page.getByRole("separator", {
    name: "调整表单编辑区域宽度",
  })
  const initialPanelWidth = (await contentPanel.boundingBox())?.width ?? 0
  const resizerBox = await panelResizer.boundingBox()
  if (!resizerBox) {
    throw new Error("左栏拖拽分隔条不可见")
  }
  await page.mouse.move(
    resizerBox.x + resizerBox.width / 2,
    resizerBox.y + resizerBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    resizerBox.x + resizerBox.width / 2 + 72,
    resizerBox.y + resizerBox.height / 2,
  )
  await page.mouse.up()
  await expect
    .poll(async () => (await contentPanel.boundingBox())?.width ?? 0)
    .toBeGreaterThan(initialPanelWidth)

  await panelResizer.focus()
  await panelResizer.press("End")
  const viewportWidth = page.viewportSize()?.width ?? 1280
  await expect
    .poll(async () => (await contentPanel.boundingBox())?.width ?? 0)
    .toBeLessThanOrEqual(Math.floor(viewportWidth * 0.4) + 1)
  await panelResizer.press("Home")
  await expect
    .poll(async () => Math.round((await contentPanel.boundingBox())?.width ?? 0))
    .toBe(300)
  await panelResizer.dblclick()
  await expect
    .poll(async () => Math.round((await contentPanel.boundingBox())?.width ?? 0))
    .toBe(360)
  await page.getByRole("button", { name: "折叠内容编辑区域" }).click()
  await expect(page.locator(".editor-workspace")).toHaveAttribute(
    "data-content-collapsed",
    "true",
  )
  await expect(
    page.getByRole("separator", { name: "调整表单编辑区域宽度" }),
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "展开内容编辑区域" })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("resume-editor:content-panel-collapsed"),
      ),
    )
    .toBe("true")
  await page.reload()
  await expect(page.getByRole("button", { name: "展开内容编辑区域" })).toBeVisible()
  await page.getByRole("button", { name: "展开内容编辑区域" }).click()
  await expect(page.locator(".editor-workspace")).toHaveAttribute(
    "data-content-collapsed",
    "false",
  )
  await expect(
    page.getByRole("separator", { name: "调整表单编辑区域宽度" }),
  ).toBeVisible()

  const previewPanel = page.locator(".editor-stage-panel")
  const workspace = page.locator(".editor-workspace")
  const previewWidthBeforeCollapse = (await previewPanel.boundingBox())?.width ?? 0
  await expect
    .poll(async () => Math.round((await previewPanel.boundingBox())?.width ?? 0))
    .toBe(Math.round((await workspace.boundingBox())?.width ?? 0))
  await page.getByRole("button", { name: "折叠样式调整区域" }).click()
  await expect
    .poll(async () =>
      Math.round((await page.locator(".style-inspector").boundingBox())?.width ?? 0),
    )
    .toBeLessThanOrEqual(40)
  await expect
    .poll(async () => Math.round((await previewPanel.boundingBox())?.width ?? 0))
    .toBe(Math.round(previewWidthBeforeCollapse))
  const collapsedInspectorBox = await page
    .getByRole("button", { name: "展开样式调整区域" })
    .boundingBox()
  const previewPanelBox = await previewPanel.boundingBox()
  expect(collapsedInspectorBox).not.toBeNull()
  expect(previewPanelBox).not.toBeNull()
  expect(collapsedInspectorBox?.y ?? 0).toBeLessThan((previewPanelBox?.y ?? 0) + 60)
  await page.getByRole("button", { name: "展开样式调整区域" }).click()
  await expect(page.getByRole("tab", { name: "文档" })).toBeVisible()
  await expect
    .poll(async () => Math.round((await previewPanel.boundingBox())?.width ?? 0))
    .toBe(Math.round(previewWidthBeforeCollapse))
  const inspectorBox = await page.locator(".style-inspector").boundingBox()
  expect(Math.round(inspectorBox?.y ?? -1)).toBe(Math.round(previewPanelBox?.y ?? 0))
  expect(Math.round(inspectorBox?.height ?? 0)).toBe(
    Math.round(previewPanelBox?.height ?? 0),
  )

  const canvas = page.locator(".a4-canvas")
  await expect(canvas).toBeVisible()
  const workPreview = canvas.locator('[data-section-type="workExperience"]').first()
  await expect(workPreview).toHaveCSS("cursor", "pointer")
  // 单次 hover() 的结果会在面板过渡或重排中丢失，此时读到的是未悬停的
  // box-shadow（none）。这里每次重试都重新建立 hover 再读取，断言的仍然是
  // 「hover 会产生阴影」，只是不依赖那一次 hover 一直存活。
  await expect
    .poll(
      async () => {
        await workPreview.hover()
        return await workPreview.evaluate(
          (element) => getComputedStyle(element).boxShadow,
        )
      },
      { timeout: 30_000 },
    )
    .not.toBe("none")
  await expect
    .poll(() =>
      workPreview.evaluate((element) =>
        getComputedStyle(element, "::before").content.replaceAll('"', ""),
      ),
    )
    .toBe("点击编辑")
  await page.getByLabel("姓名").fill("E2E 表单候选人")
  await expect(canvas.getByRole("heading", { name: "E2E 表单候选人" })).toBeVisible()
  await page.getByRole("button", { name: "添加区块" }).click()
  await page.getByRole("menuitem", { name: "自定义区块" }).click()
  await page.getByLabel("自定义区块名称").fill("公开演讲")
  await expect(page.getByRole("button", { name: "公开演讲 1 条" })).toBeVisible()
  await expect(canvas.getByRole("heading", { name: "公开演讲" })).toBeVisible()
  const sectionSettings = page.locator(".editor-section-settings")
  const addItemButton = sectionSettings.getByRole("button", { name: "添加条目" })
  await expect(addItemButton).toBeVisible()
  await expect(addItemButton).toHaveText("")
  await expect
    .poll(async () => (await addItemButton.boundingBox())?.width ?? 0)
    .toBeLessThanOrEqual(26)
  await page.getByRole("button", { name: "收起条目 1" }).click()
  const expandFirstItem = page.getByRole("button", { name: "展开条目 1" })
  await expect(expandFirstItem).toBeVisible()
  const firstItemActions = [
    page.getByRole("button", { name: "拖动条目 1" }),
    expandFirstItem,
    page.getByRole("button", { name: "删除条目 1" }),
  ]
  for (const action of firstItemActions) {
    await expect
      .poll(async () => (await action.boundingBox())?.width ?? 0)
      .toBeLessThanOrEqual(26)
  }
  await expandFirstItem.click()
  await addItemButton.click()
  await expect(page.getByRole("button", { name: "收起条目 2" })).toBeVisible()
  await expect(page.getByRole("button", { name: "公开演讲 2 条" })).toBeVisible()

  const fittedZoom = Number(await canvas.getAttribute("data-zoom"))
  const zoomRange = page.getByRole("slider", { name: "预览缩放" })
  await zoomRange.fill("73")
  await expect(zoomRange).toHaveValue("73")
  await expect(canvas).toHaveAttribute("data-zoom", "73")
  await expect(page.getByRole("button", { name: "快速自适应预览" })).toHaveAttribute(
    "aria-pressed",
    "false",
  )
  await page.getByRole("button", { name: "快速自适应预览" }).click()
  await expect(canvas).toHaveAttribute("data-zoom", String(fittedZoom))
  const zoomIn = page.getByRole("button", { name: "放大预览" })
  const maximumZoom = await zoomRange.getAttribute("max")
  expect(maximumZoom).not.toBeNull()
  while (await zoomIn.isEnabled()) {
    await zoomIn.click()
  }
  await expect(canvas).toHaveAttribute("data-zoom", maximumZoom ?? "")
  await expect(
    page.locator(
      '.editor-canvas-scroll [data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]',
    ),
  ).toBeAttached()
  const previewViewport = page.locator(
    '.editor-canvas-scroll [data-slot="scroll-area-viewport"]',
  )
  const scrollPosition = await previewViewport.evaluate((element) => {
    element.scrollTo({ left: element.scrollWidth, top: element.scrollHeight })
    return {
      left: element.scrollLeft,
      top: element.scrollTop,
      horizontalOverflow: element.scrollWidth > element.clientWidth,
      verticalOverflow: element.scrollHeight > element.clientHeight,
    }
  })
  expect(scrollPosition.horizontalOverflow).toBe(true)
  expect(scrollPosition.verticalOverflow).toBe(true)
  expect(scrollPosition.left).toBeGreaterThan(0)
  expect(scrollPosition.top).toBeGreaterThan(0)
  await expect(page.locator(".preview-zoom-controls")).toHaveCSS("bottom", "17.6px")
  const fitPreviewButton = page.getByRole("button", { name: "快速自适应预览" })
  await fitPreviewButton.hover()
  await expect(
    page.getByRole("tooltip").filter({ hasText: "自适应预览" }),
  ).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("tooltip")).toBeHidden()
  await fitPreviewButton.click()
  await expect(canvas).toHaveAttribute("data-zoom", String(fittedZoom))
  await canvas.hover()
  await page.keyboard.down("Control")
  await page.mouse.wheel(0, -120)
  await page.keyboard.up("Control")
  let wheelZoom = fittedZoom
  await expect
    .poll(async () => {
      wheelZoom = Number(await canvas.getAttribute("data-zoom"))
      return wheelZoom
    })
    .toBeGreaterThan(fittedZoom)
  expect(wheelZoom % 1).not.toBe(0)
  await page.getByRole("button", { name: "快速自适应预览" }).click()
  await expect(canvas).toHaveAttribute("data-zoom", String(fittedZoom))

  const anchorPage = canvas.locator(".a4-page").first()
  await anchorPage.evaluate((element) => {
    element.scrollIntoView({
      block: "center",
      inline: "center",
    })
  })
  const [anchorPageBefore, previewViewportBox] = await Promise.all([
    anchorPage.boundingBox(),
    previewViewport.boundingBox(),
  ])
  expect(anchorPageBefore).not.toBeNull()
  expect(previewViewportBox).not.toBeNull()
  if (!anchorPageBefore || !previewViewportBox) {
    throw new Error("无法读取缩放锚点")
  }
  const pointerX = Math.max(
    previewViewportBox.x + 24,
    Math.min(
      previewViewportBox.x + previewViewportBox.width - 24,
      anchorPageBefore.x + anchorPageBefore.width * 0.5,
    ),
  )
  const pointerY = Math.max(
    previewViewportBox.y + 24,
    Math.min(
      previewViewportBox.y + previewViewportBox.height - 24,
      anchorPageBefore.y + anchorPageBefore.height * 0.38,
    ),
  )
  const anchorRatioX = (pointerX - anchorPageBefore.x) / anchorPageBefore.width
  const anchorRatioY = (pointerY - anchorPageBefore.y) / anchorPageBefore.height
  await page.mouse.move(pointerX, pointerY)
  await page.keyboard.down("Control")
  for (let index = 0; index < 3; index += 1) {
    await page.mouse.wheel(0, -40)
  }
  await page.keyboard.up("Control")
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-zoom")))
    .toBeGreaterThan(fittedZoom)
  await page.waitForTimeout(250)
  const anchorPageAfter = await anchorPage.boundingBox()
  expect(anchorPageAfter).not.toBeNull()
  if (!anchorPageAfter) {
    throw new Error("缩放后锚点页面不可见")
  }
  const anchoredPointerX = anchorPageAfter.x + anchorPageAfter.width * anchorRatioX
  const anchoredPointerY = anchorPageAfter.y + anchorPageAfter.height * anchorRatioY
  expect(Math.abs(anchoredPointerX - pointerX)).toBeLessThanOrEqual(2)
  expect(Math.abs(anchoredPointerY - pointerY)).toBeLessThanOrEqual(6)
  await page.getByRole("button", { name: "快速自适应预览" }).click()
  await expect(canvas).toHaveAttribute("data-zoom", String(fittedZoom))

  const editorUrl = page.url()
  const expectedPageCount = await canvas.locator(".a4-page").count()
  await openEditorLinkedPage(page, "preview")
  await expect(page).toHaveURL(`${editorUrl}/preview`)
  const fullPreview = page.locator(".resume-draft-preview-shell")
  await expect(fullPreview.locator(".resume-full-preview-page")).toHaveCount(
    expectedPageCount,
  )
  await expect(
    fullPreview.locator(".resume-full-preview-page .resume-document").first(),
  ).toBeVisible()
  await page.goto(editorUrl)
  await expect(page).toHaveURL(editorUrl)
  await expect(canvas).toBeVisible()

  await openEditorLinkedPage(page, "web")
  await expect(page).toHaveURL(`${editorUrl}/web`)
  await expect(page.getByRole("heading", { name: "Web 简历生成器" })).toBeVisible()
  await expect(page.getByRole("radio")).toHaveCount(20)
  const webPreview = page.locator(".resume-web-builder-preview")
  await expect(webPreview.locator(".resume-web-page")).toHaveAttribute(
    "data-web-template",
    "digital-archive",
  )
  await expect(
    webPreview.getByRole("navigation", { name: "简历区块导航" }),
  ).toBeVisible()
  await selectWebTemplateByName(page, "终端信号")
  await expect(page.getByRole("radio", { name: /终端信号/ })).toBeChecked()
  await expect(webPreview.locator(".resume-web-page")).toHaveAttribute(
    "data-web-template",
    "terminal-signal",
  )
  await page.goto(editorUrl)
  await expect(page).toHaveURL(editorUrl)
  await openEditorLinkedPage(page, "web")
  await expect(page.getByRole("radio", { name: /数字档案/ })).toBeChecked()
  await expect(page.locator(".resume-web-page")).toHaveAttribute(
    "data-web-template",
    "digital-archive",
  )
  await page.goto(editorUrl)
  await expect(page).toHaveURL(editorUrl)

  await expect(page.locator(".monaco-editor")).toHaveCount(0)
  await page.getByRole("tab", { name: "JSON" }).click()
  const jsonDialog = page.getByRole("dialog", { name: "编辑简历 JSON" })
  await expect(jsonDialog).toHaveCount(0)
  await expect(page.locator(".content-editor-json-tab .monaco-editor")).toBeVisible({
    timeout: 20_000,
  })
  const jsonPanelWidthBefore = (await contentPanel.boundingBox())?.width ?? 0
  const styleInspector = page.locator(".style-inspector")
  await expect(styleInspector).toHaveAttribute("data-collapsed", "false")
  const canvasPaddingBefore = await canvas.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).paddingLeft),
  )
  await page.getByRole("button", { name: "放大 JSON 编辑区域" }).click()
  await expect(workspace).toHaveAttribute("data-json-maximized", "true")
  await expect(workspace).toHaveAttribute("data-inspector-collapsed", "true")
  await expect(styleInspector).toHaveAttribute("data-collapsed", "true")
  await expect(page.getByRole("button", { name: "展开样式调整区域" })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("resume-editor:inspector-collapsed")),
    )
    .toBe("false")
  await expect(
    page.getByRole("button", { name: "恢复 JSON 编辑宽度" }),
  ).toHaveAttribute("aria-pressed", "true")
  await expect(jsonDialog).toHaveCount(0)
  await expect(page.locator(".monaco-editor")).toHaveCount(1)
  await expect
    .poll(async () => Math.round((await contentPanel.boundingBox())?.width ?? 0))
    .toBe(Math.floor((page.viewportSize()?.width ?? 0) * 0.4))
  await expect
    .poll(() =>
      canvas.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingLeft),
      ),
    )
    .toBeGreaterThan(canvasPaddingBefore)
  await expect(canvas).toBeVisible()
  await page.getByRole("button", { name: "恢复 JSON 编辑宽度" }).click()
  await expect(workspace).toHaveAttribute("data-json-maximized", "false")
  await expect(workspace).toHaveAttribute("data-inspector-collapsed", "false")
  await expect(styleInspector).toHaveAttribute("data-collapsed", "false")
  await expect
    .poll(async () => Math.round((await contentPanel.boundingBox())?.width ?? 0))
    .toBe(Math.round(jsonPanelWidthBefore))

  await page.getByRole("button", { name: "折叠样式调整区域" }).click()
  await page.getByRole("button", { name: "放大 JSON 编辑区域" }).click()
  await page.getByRole("button", { name: "恢复 JSON 编辑宽度" }).click()
  await expect(styleInspector).toHaveAttribute("data-collapsed", "true")
  await page.getByRole("button", { name: "展开样式调整区域" }).click()
  await expect(styleInspector).toHaveAttribute("data-collapsed", "false")

  await page.getByRole("button", { name: "放大 JSON 编辑区域" }).click()
  await page.getByRole("button", { name: "展开样式调整区域" }).click()
  await expect(workspace).toHaveAttribute("data-json-maximized", "false")
  await expect(styleInspector).toHaveAttribute("data-collapsed", "false")

  await page.getByRole("button", { name: "放大 JSON 编辑区域" }).click()
  await page.getByRole("tab", { name: "表单编辑" }).click()
  await expect(workspace).toHaveAttribute("data-json-maximized", "false")
  await expect(styleInspector).toHaveAttribute("data-collapsed", "false")
  await expect
    .poll(async () => Math.round((await contentPanel.boundingBox())?.width ?? 0))
    .toBe(Math.round(jsonPanelWidthBefore))
  await page.getByRole("tab", { name: "JSON" }).click()
  await expect(page.locator(".content-editor-json-tab .monaco-editor")).toBeVisible()
  await expect(
    page.locator('.content-editor-json-tab [data-slot="scroll-area-viewport"]'),
  ).toHaveCount(0)
  await expect(page.locator(".monaco-scrollable-element").first()).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const inlineModel = (window as unknown as MonacoWindow).monaco.editor
          .getModels()
          .find((model) => model.uri.path.endsWith("document-inline.json"))
        return inlineModel?.getValue().length ?? 0
      }),
    )
    .toBeGreaterThan(0)

  await canvas.getByRole("heading", { name: "工作经历" }).first().click()
  await expect(page.locator(".content-editor-json-tab .monaco-editor")).toBeVisible()
  await expect(workPreview).toHaveAttribute("data-json-linked", "true")
  await expect(page.locator(".resume-json-linked-line")).not.toHaveCount(0)

  const linkedItem = await page.evaluate(() => {
    const monaco = (window as unknown as MonacoWindow).monaco
    const model = monaco.editor
      .getModels()
      .find((candidate) => candidate.uri.path.endsWith("document-inline.json"))
    const editor = monaco.editor
      .getEditors()
      .find((candidate) => candidate.getModel() === model)
    if (!model || !editor) {
      throw new Error("内联 JSON 编辑器不存在")
    }
    const document = JSON.parse(model.getValue()) as {
      sections: Array<{
        id: string
        type: string
        items: Array<{ id: string }>
      }>
    }
    const section = document.sections.find(
      (candidate) => candidate.type === "workExperience",
    )
    const item = section?.items[0]
    if (!section || !item) {
      throw new Error("工作经历测试条目不存在")
    }
    const offset = model.getValue().indexOf(`"id": "${item.id}"`)
    editor.setPosition(model.getPositionAt(offset))
    editor.focus()
    return {
      itemId: item.id,
      sectionId: section.id,
    }
  })
  const linkedPreviewItem = canvas
    .locator(`[data-section-id="${linkedItem.sectionId}"]`)
    .locator(`[data-item-id="${linkedItem.itemId}"]`)
    .first()
  await expect(linkedPreviewItem).toHaveAttribute("data-json-linked", "true")
  await expect(workPreview).not.toHaveAttribute("data-json-linked", "true")

  const sourceDocument = JSON.parse(
    await page.evaluate(() => {
      const inlineModel = (window as unknown as MonacoWindow).monaco.editor
        .getModels()
        .find((model) => model.uri.path.endsWith("document-inline.json"))
      if (!inlineModel) {
        throw new Error("内联 JSON 模型不存在")
      }
      return inlineModel.getValue()
    }),
  )
  await page.evaluate(() => {
    const inlineModel = (window as unknown as MonacoWindow).monaco.editor
      .getModels()
      .find((model) => model.uri.path.endsWith("document-inline.json"))
    inlineModel?.setValue("{")
  })
  await page.getByRole("button", { name: "应用 JSON" }).click()
  const jsonError = contentPanel.locator('[data-slot="field-error"]')
  await expect(jsonError).toBeVisible()

  sourceDocument.profile.name = "E2E JSON 候选人"
  const workSection = sourceDocument.sections.find(
    (section: { type: string }) => section.type === "workExperience",
  )
  const originalWorkItem = workSection.items[0]
  workSection.items = Array.from({ length: 8 }, (_, index) => ({
    ...originalWorkItem,
    id: `e2e-work-${index}`,
    title: `高级工程师 ${index + 1}`,
    description: "负责复杂产品架构、跨团队交付与长期工程治理。".repeat(4),
  }))
  await page.evaluate(
    (value) => {
      const inlineModel = (window as unknown as MonacoWindow).monaco.editor
        .getModels()
        .find((model) => model.uri.path.endsWith("document-inline.json"))
      inlineModel?.setValue(value)
    },
    JSON.stringify(sourceDocument, null, 2),
  )
  await page.getByRole("button", { name: "应用 JSON" }).click()
  await expect(jsonDialog).toHaveCount(0)
  await expect(page.locator('[data-slot="field-error"]')).toHaveCount(0)
  await expect(
    canvas.getByRole("heading", {
      name: "E2E JSON 候选人",
    }),
  ).toBeVisible()

  await canvas.getByRole("heading", { name: "工作经历" }).first().click()
  await expect(workPreview).toHaveAttribute("data-json-linked", "true")
  await expect(workPreview).toHaveAttribute("data-selected", "false")
  await expect(page.getByRole("tab", { name: "JSON" })).toHaveAttribute(
    "data-state",
    "active",
  )
  await expect(page.locator(".resume-json-linked-line")).not.toHaveCount(0)
  await page.getByRole("tab", { name: "表单编辑" }).click()
  await expect(workPreview).toHaveAttribute("data-selected", "true")
  await expect
    .poll(() =>
      workPreview.evaluate((element) =>
        getComputedStyle(element, "::before").content.replaceAll('"', ""),
      ),
    )
    .toBe("正在编辑")
  await expect(page.getByRole("tab", { name: "表单编辑" })).toHaveAttribute(
    "data-state",
    "active",
  )
  const formTarget = page.locator("[data-editor-form-target]")
  await expect
    .poll(() =>
      formTarget.evaluate((element) => {
        const viewport = element.closest('[data-slot="scroll-area-viewport"]')
        if (!viewport) {
          return false
        }
        const targetRect = element.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        return (
          targetRect.top >= viewportRect.top && targetRect.top < viewportRect.bottom
        )
      }),
    )
    .toBe(true)
  await page.getByRole("tab", { name: "当前区块" }).click()
  await page.getByRole("radio", { name: "强调" }).click()
  await expect(
    page.locator('[data-section-type="workExperience"]').first(),
  ).toHaveAttribute("data-style-preset", "accent")
  await page.getByLabel("下方间距").scrollIntoViewIfNeeded()
  await expect(page.getByLabel("下方间距")).toBeVisible()

  await page.getByRole("tab", { name: "文档" }).click()
  const openTemplateLibrary = async () => {
    const templateLibrary = page.getByLabel("完整模板库")
    if (!(await templateLibrary.isVisible())) {
      await page.getByRole("button", { name: "更换文档模板" }).click()
    }
    await expect(templateLibrary).toBeVisible()
  }
  await expect(page.getByRole("button", { name: /^应用.+模板$/ })).toHaveCount(0)
  await openTemplateLibrary()
  await expect(page.getByRole("button", { name: /^应用.+模板$/ })).toHaveCount(24)
  const creativeTemplate = page.getByRole("button", {
    name: "应用创意分栏模板",
  })
  await creativeTemplate.click()
  await expect(page.getByLabel("完整模板库")).toBeVisible()
  await expect(page.locator(".style-template-current")).toContainText("创意分栏")
  const firstResumePage = canvas.locator(".resume-document").first()
  const sidebar = firstResumePage.locator(".resume-sidebar")
  await expect(sidebar.locator(".resume-sidebar-contact")).toBeVisible()
  await expect(sidebar.locator(".resume-contact-item")).toHaveCount(4)
  await expect(sidebar.locator('[data-section-type="skills"]')).toBeVisible()
  await expect(sidebar).toHaveCSS("background-color", "rgb(37, 32, 43)")
  await expect(sidebar.locator(".resume-item-header").first()).toHaveCSS(
    "flex-direction",
    "column",
  )
  await expect(sidebar.locator(".resume-item-subtitle").first()).toHaveCSS(
    "color",
    "rgb(255, 156, 145)",
  )
  await expect(sidebar.locator(".resume-item-meta").first()).toHaveCSS(
    "color",
    "rgb(216, 206, 218)",
  )
  await expect(sidebar.locator(".resume-item-link").first()).toHaveCSS(
    "color",
    "rgb(255, 156, 145)",
  )
  await expect
    .poll(() =>
      sidebar
        .locator(".resume-item-header")
        .first()
        .evaluate((header) => {
          const title = header.firstElementChild
          const meta = header.querySelector(".resume-item-meta")
          if (!title || !meta) {
            return false
          }
          return (
            meta.getBoundingClientRect().top >= title.getBoundingClientRect().bottom
          )
        }),
    )
    .toBe(true)
  await expect
    .poll(() =>
      firstResumePage.evaluate((element) => {
        const layout = element.querySelector(".resume-split-layout")
        return layout ? getComputedStyle(layout).gridTemplateColumns : ""
      }),
    )
    .toMatch(/^220px /)
  await expect
    .poll(async () => {
      const documentBox = await firstResumePage.boundingBox()
      const sidebarBox = await sidebar.boundingBox()
      return documentBox && sidebarBox
        ? Math.abs(documentBox.y - sidebarBox.y)
        : Number.POSITIVE_INFINITY
    })
    .toBeLessThanOrEqual(1)
  await openTemplateLibrary()
  await page.getByRole("button", { name: "应用数据实验室模板" }).click()
  const dataLabProfile = firstResumePage.locator(".resume-profile")
  await expect(dataLabProfile).toHaveCSS("margin-left", "0px")
  await expect
    .poll(() =>
      firstResumePage.evaluate((element) => {
        const layout = element.querySelector(".resume-split-layout")
        return layout ? getComputedStyle(layout).gridTemplateColumns : ""
      }),
    )
    .toMatch(/^230px /)
  await openTemplateLibrary()
  await page.getByRole("button", { name: "应用奢尚零售模板" }).click()
  const luxuryProfile = firstResumePage.locator(".resume-profile")
  await expect(luxuryProfile).toHaveCSS("margin-left", "0px")
  await expect
    .poll(() =>
      firstResumePage.evaluate((element) => {
        const layout = element.querySelector(".resume-split-layout")
        return layout ? getComputedStyle(layout).gridTemplateColumns : ""
      }),
    )
    .toMatch(/^220px /)
  await openTemplateLibrary()
  await page.getByRole("button", { name: "应用金融账簿模板" }).click()
  await expect(page.locator(".style-template-current")).toContainText("金融账簿")
  await expect(canvas.locator(".resume-document").first()).toHaveClass(
    /template-finance/,
  )

  await openTemplateLibrary()
  const templateNames = await page
    .getByRole("button", { name: /^应用.+模板$/ })
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label") ?? ""),
    )
  await page.getByRole("button", { name: "收起模板库" }).click()
  const templateAudit: Array<{
    template: string
    overflowPages: Array<{ page: number; overflow: number }>
    firstPageGap: number
    layouts: Array<string | null>
    continuationMarkers: number
    continuationMarginPages: number[]
    continuationTitles: number
    bottomMarginPages: Array<{
      page: number
      mainGap: number
      mainRequired: number
      sidebarGap: number | null
      sidebarRequired: number | null
    }>
  }> = []
  for (const templateName of templateNames) {
    await test.step(templateName, async () => {
      await openTemplateLibrary()
      const templateButton = page.getByRole("button", {
        name: templateName,
        exact: true,
      })
      await templateButton.click()
      await expect(page.locator(".style-template-current")).toContainText(
        templateName.replace(/^应用|模板$/g, ""),
      )
      const documents = canvas.locator(".resume-document")
      await page.waitForTimeout(50)
      const overflowPages = await documents.evaluateAll((pages) =>
        pages
          .map((document, pageIndex) => ({
            page: pageIndex + 1,
            overflow: (() => {
              const documentRect = document.getBoundingClientRect()
              const scale = documentRect.height / 1123
              const content = [
                document.querySelector(".resume-main > :last-child"),
                document.querySelector(".resume-sidebar > :last-child"),
              ].filter((element): element is Element => Boolean(element))
              return Math.max(
                0,
                ...content.map(
                  (element) =>
                    (element.getBoundingClientRect().bottom - documentRect.bottom) /
                    scale,
                ),
              )
            })(),
          }))
          .filter(({ overflow }) => overflow > 1),
      )
      templateAudit.push({
        template: templateName,
        overflowPages,
        firstPageGap: await documents.first().evaluate((document) => {
          const section = document.querySelector(
            ".resume-main .resume-section:last-child",
          )
          if (!section) {
            return Number.POSITIVE_INFINITY
          }
          const documentRect = document.getBoundingClientRect()
          const sectionRect = section.getBoundingClientRect()
          const scale = documentRect.height / 1123
          return (documentRect.bottom - sectionRect.bottom) / scale
        }),
        layouts: await documents.evaluateAll((pages) =>
          pages.map((document) => document.getAttribute("data-layout")),
        ),
        continuationMarkers: await documents
          .locator(".resume-sidebar-page-marker")
          .count(),
        continuationMarginPages: await documents.evaluateAll((pages) =>
          pages.flatMap((document, index) => {
            if (index === 0) {
              return []
            }
            const contentRoot =
              document.getAttribute("data-layout") === "sidebar"
                ? document.querySelector(".resume-primary")
                : document
            const main = document.querySelector(".resume-main")
            if (!contentRoot || !main) {
              return [index + 1]
            }
            const contentStyle = getComputedStyle(contentRoot)
            const top = Number.parseFloat(contentStyle.paddingTop)
            const bottom = Number.parseFloat(contentStyle.paddingBottom)
            const mainTop = Number.parseFloat(getComputedStyle(main).paddingTop)
            return Math.abs(top - bottom) > 1 || mainTop > 1 ? [index + 1] : []
          }),
        ),
        continuationTitles: await documents.evaluateAll((pages) =>
          pages.reduce(
            (count, document) =>
              count +
              Array.from(document.querySelectorAll(".resume-item h3")).filter(
                (heading) => heading.textContent?.includes("（续）"),
              ).length,
            0,
          ),
        ),
        bottomMarginPages: await documents.evaluateAll((pages) =>
          pages.flatMap((document, index) => {
            const documentRect = document.getBoundingClientRect()
            const scale = documentRect.height / 1123
            const mainContent =
              document.querySelector(".resume-main > :last-child") ??
              document.querySelector(".resume-profile")
            const mainGap = mainContent
              ? (documentRect.bottom - mainContent.getBoundingClientRect().bottom) /
                scale
              : Number.NEGATIVE_INFINITY
            const mainRequired = Number.parseFloat(
              getComputedStyle(document).getPropertyValue("--resume-page-margin"),
            )
            const sidebar = document.querySelector(".resume-sidebar")
            const sidebarContent = sidebar?.lastElementChild
            const sidebarGap =
              sidebar && sidebarContent
                ? (documentRect.bottom -
                    sidebarContent.getBoundingClientRect().bottom) /
                  scale
                : null
            const sidebarRequired = sidebar
              ? Number.parseFloat(getComputedStyle(sidebar).paddingBottom)
              : null
            const invalidMain = mainGap < mainRequired - 1
            const invalidSidebar =
              sidebarGap !== null &&
              sidebarRequired !== null &&
              sidebarGap < sidebarRequired - 1
            return invalidMain || invalidSidebar
              ? [
                  {
                    page: index + 1,
                    mainGap,
                    mainRequired,
                    sidebarGap,
                    sidebarRequired,
                  },
                ]
              : []
          }),
        ),
      })
    })
  }
  expect(
    templateAudit.filter(
      ({
        overflowPages,
        firstPageGap,
        layouts,
        continuationMarkers,
        continuationMarginPages,
        continuationTitles,
        bottomMarginPages,
      }) =>
        overflowPages.length > 0 ||
        firstPageGap > 220 ||
        continuationMarginPages.length > 0 ||
        continuationTitles > 0 ||
        bottomMarginPages.length > 0 ||
        (layouts[0] === "sidebar" &&
          (layouts.some((layout) => layout !== "sidebar") ||
            continuationMarkers !== 0)),
    ),
  ).toEqual([])
  await openTemplateLibrary()
  await page.getByRole("button", { name: "应用金融账簿模板" }).click()
  await expect(page.locator(".style-template-current")).toContainText("金融账簿")

  await expect.poll(() => page.locator(".a4-page-wrap").count()).toBeGreaterThan(1)
  const renderedDocuments = canvas.locator(".resume-document")
  await expect
    .poll(() =>
      renderedDocuments.evaluateAll((documents) =>
        documents
          .map((document, index) => ({
            page: index + 1,
            overflow: (() => {
              const documentRect = document.getBoundingClientRect()
              const scale = documentRect.height / 1123
              const content = [
                document.querySelector(".resume-main > :last-child"),
                document.querySelector(".resume-sidebar > :last-child"),
              ].filter((element): element is Element => Boolean(element))
              return Math.max(
                0,
                ...content.map(
                  (element) =>
                    (element.getBoundingClientRect().bottom - documentRect.bottom) /
                    scale,
                ),
              )
            })(),
          }))
          .filter(({ overflow }) => overflow > 1),
      ),
    )
    .toEqual([])
  await expect(renderedDocuments.nth(1)).toHaveAttribute("data-layout", "single")
  await expect(canvas.getByText(/（续）/)).toHaveCount(0)
  const continuationSpacing = await renderedDocuments.nth(1).evaluate((document) => {
    const documentStyle = getComputedStyle(document)
    const contentRoot =
      document.getAttribute("data-layout") === "sidebar"
        ? document.querySelector(".resume-primary")
        : document
    const main = document.querySelector(".resume-main")
    if (!contentRoot || !main) {
      return null
    }
    const contentStyle = getComputedStyle(contentRoot)
    return {
      configuredMargin: Number.parseFloat(
        documentStyle.getPropertyValue("--resume-page-margin"),
      ),
      paddingTop: Number.parseFloat(contentStyle.paddingTop),
      paddingBottom: Number.parseFloat(contentStyle.paddingBottom),
      mainPaddingTop: Number.parseFloat(getComputedStyle(main).paddingTop),
    }
  })
  expect(continuationSpacing).not.toBeNull()
  expect(continuationSpacing?.paddingTop).toBe(continuationSpacing?.paddingBottom)
  expect(continuationSpacing?.paddingTop).toBe(continuationSpacing?.configuredMargin)
  expect(continuationSpacing?.mainPaddingTop).toBe(0)
  await page.getByRole("tab", { name: "资源" }).click()
  const uploadInput = page.getByLabel("选择图片资源")
  await uploadInput.setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  })
  await expect(page.getByText("仅支持 PNG、JPEG 和 WebP 图片")).toBeVisible()
  consoleErrors.length = 0

  await uploadInput.setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  })
  const portraitCard = page.locator(".resource-card").filter({
    hasText: "portrait.png",
  })
  await expect(portraitCard).toBeVisible()
  await portraitCard.getByRole("button", { name: "添加资源 portrait.png" }).click()
  const firstPlacement = canvas.locator(".resume-image-placement").first()
  await expect(firstPlacement).toBeVisible()
  const placementX = page.getByRole("spinbutton", { name: "X", exact: true })
  const placementY = page.getByRole("spinbutton", { name: "Y", exact: true })
  const placementWidth = page.getByRole("spinbutton", {
    name: "宽度",
    exact: true,
  })
  const placementHeight = page.getByRole("spinbutton", {
    name: "高度",
    exact: true,
  })
  await page.getByRole("radio", { name: "圆角" }).click()
  await placementWidth.fill("210")
  await placementHeight.fill("130")
  await placementHeight.press("Enter")
  await expect(firstPlacement).toHaveAttribute("data-shape", "rounded")
  await expect(placementWidth).toHaveValue("210")
  await expect(placementHeight).toHaveValue("130")
  await placementWidth.fill("900")
  await placementWidth.press("Tab")
  await expect(placementWidth).toHaveValue("900")
  await expect(page.getByText(/宽度不能大于/)).toBeVisible()
  await expect(firstPlacement).toHaveCSS("width", "210px")
  await placementWidth.fill("210")
  await placementWidth.press("Enter")
  await expect(page.getByText(/宽度不能大于/)).toHaveCount(0)
  await page.getByRole("combobox").click()
  await page.getByRole("option", { name: "完整显示" }).click()
  await expect(firstPlacement.locator("img")).toHaveCSS("object-fit", "contain")
  await page.getByRole("radio", { name: "圆形" }).click()
  await expect(placementWidth).toHaveValue("130")
  await expect(placementHeight).toHaveValue("130")
  await placementWidth.fill("180")
  await placementWidth.press("Enter")
  await expect(placementHeight).toHaveValue("180")
  await placementX.fill("100")
  await placementY.fill("120")
  const placementBox = await firstPlacement.boundingBox()
  if (!placementBox) {
    throw new Error("图片位置不可见")
  }
  await page.mouse.move(
    placementBox.x + placementBox.width / 2,
    placementBox.y + placementBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    placementBox.x + placementBox.width / 2 + 30,
    placementBox.y + placementBox.height / 2 + 20,
  )
  await page.mouse.up()
  await expect
    .poll(async () => Number(await placementX.inputValue()))
    .toBeGreaterThan(100)

  const widthBeforeResize = Number(await placementWidth.inputValue())
  const resizeHandle = firstPlacement.getByRole("button", {
    name: "拖动调整图片大小",
  })
  const resizeBox = await resizeHandle.boundingBox()
  if (!resizeBox) {
    throw new Error("图片缩放手柄不可见")
  }
  await page.mouse.move(
    resizeBox.x + resizeBox.width / 2,
    resizeBox.y + resizeBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    resizeBox.x + resizeBox.width / 2 + 24,
    resizeBox.y + resizeBox.height / 2 + 18,
  )
  await page.mouse.up()
  await expect
    .poll(async () => Number(await placementWidth.inputValue()))
    .toBeGreaterThan(widthBeforeResize)
  await placementWidth.fill("0")
  await placementWidth.press("Enter")
  await expect(placementWidth).toHaveValue("0")
  await expect(placementHeight).toHaveValue("0")
  await expect(firstPlacement).toHaveAttribute("data-zero-size", "true")
  await expect(firstPlacement.locator(".resume-image-zero-locator")).toBeVisible()

  await uploadInput.setInputFiles({
    name: "project.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  })
  const secondPage = canvas.locator('[data-page-index="1"] .a4-page')
  await secondPage.scrollIntoViewIfNeeded()
  await secondPage.click({ position: { x: 20, y: 20 } })
  const projectCard = page.locator(".resource-card").filter({
    hasText: "project.png",
  })
  await projectCard.getByRole("button", { name: "添加资源 project.png" }).click()
  await expect(canvas.locator(".resume-image-placement")).toHaveCount(2)

  await uploadInput.setInputFiles({
    name: "unreferenced.png",
    mimeType: "image/png",
    buffer: pngBuffer,
  })
  const unreferencedCard = page.locator(".resource-card").filter({
    hasText: "unreferenced.png",
  })
  await expect(unreferencedCard).toBeVisible()
  const unreferencedAssetId = await unreferencedCard.getAttribute("data-asset-id")
  expect(unreferencedAssetId).toBeTruthy()
  await unreferencedCard
    .getByRole("button", { name: "删除资源 unreferenced.png" })
    .click()
  await page.getByRole("button", { name: "删除图片" }).click()
  await expect(unreferencedCard).toHaveCount(0)

  await expect(page.getByTestId("save-status")).toContainText("待保存")
  await page.getByRole("button", { name: "保存", exact: true }).click()
  await expect(page.getByTestId("save-status")).toContainText("已保存", {
    timeout: 15_000,
  })
  await page.reload()
  await expect(page.locator(".resume-image-placement")).toHaveCount(2)

  await page.getByTestId("publish-resume").click()
  await expect(page.getByRole("heading", { name: "简历已发布" })).toBeVisible()
  const shareUrl = await page.getByLabel("分享链接").inputValue()
  expect(shareUrl).toMatch(/\/r\/[A-Za-z0-9_-]+$/)

  await page.keyboard.press("Escape")
  await expect(page.getByRole("heading", { name: "简历已发布" })).toHaveCount(0)
  await openEditorLinkedPage(page, "web")
  await expect(page.getByText("分享内容来自最近发布版本")).toBeVisible()
  await expect(page.locator(".web-resume-hero-visual")).toHaveCount(0)
  await expect(page.locator(".web-resume-hero img")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "公开演讲" })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "公开演讲" })).toHaveCount(0)
  await selectWebTemplateByName(page, "终端信号")
  await expect(page.locator(".resume-web-page")).toHaveAttribute(
    "data-web-template",
    "terminal-signal",
  )
  const shareCurrentEffect = page.getByRole("button", { name: "分享当前效果" })
  await expect(shareCurrentEffect).toBeEnabled()
  await shareCurrentEffect.click()
  await expect(page.getByText("分享链接已复制")).toBeVisible()
  const sharedWebUrl = await page.evaluate(() => navigator.clipboard.readText())
  expect(sharedWebUrl).toBe(`${shareUrl}/web?template=terminal-signal`)

  await page.context().clearCookies()
  await page.goto(shareUrl)
  await expect(page.getByRole("heading", { name: "E2E JSON 候选人" })).toBeVisible()
  const publicImages = page.locator(".public-a4-pages .resume-image-layer img")
  await expect(publicImages).toHaveCount(2)
  await expect
    .poll(() =>
      publicImages.evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
      ),
    )
    .toBe(true)
  const publicSlug = new URL(shareUrl).pathname.split("/").at(-1)
  const unreferencedResponse = await page.request.get(
    `/api/public-resumes/${publicSlug}/assets/${unreferencedAssetId}`,
  )
  expect(unreferencedResponse.status()).toBe(404)
  await expect(page.getByText("只读发布快照")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "互动版" })).toHaveCount(0)

  await page.goto(`${shareUrl}/web`)
  await expect(page).toHaveURL(`${shareUrl}/web`)
  await expect(page.getByRole("heading", { name: "E2E JSON 候选人" })).toBeVisible()
  await expect(page.locator(".resume-web-page")).toHaveAttribute(
    "data-web-template",
    "digital-archive",
  )

  await page.goto(sharedWebUrl)
  await expect(page.locator(".resume-web-page")).toHaveAttribute(
    "data-web-template",
    "terminal-signal",
  )
  const firstWebModule = page.locator(".web-resume-module").first()
  await expect(firstWebModule).toBeAttached()
  await expect(page.locator(".web-resume-progress")).toBeAttached()
  await firstWebModule.scrollIntoViewIfNeeded()
  await expect
    .poll(() =>
      page
        .locator(".resume-web-page")
        .evaluate((element) =>
          Number(getComputedStyle(element).getPropertyValue("--web-scroll-progress")),
        ),
    )
    .toBeGreaterThan(0)
  await expect(page.getByRole("link", { name: /个人信息/ })).toBeVisible()
  await expect(page.locator(".web-resume-hero-visual")).toHaveCount(0)
  await expect(page.locator(".web-resume-hero img")).toHaveCount(0)
  await page.goto(`${shareUrl}/web?template=unknown-template`)
  await expect(page.locator(".resume-web-page")).toHaveAttribute(
    "data-web-template",
    "digital-archive",
  )
  await expect(page.getByRole("link", { name: "A4 版" })).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})
