import type { Locator, Page } from "@playwright/test"
import { webTemplateSchemes } from "../../src/shared/resume-template/web-template-schemes"
import { expect, test } from "./fixtures"

const webTemplateCases = webTemplateSchemes.map((scheme) => ({
  id: scheme.id,
  name: scheme.name,
}))

const viewportCases = [
  {
    name: "wide-builder",
    width: 1440,
    height: 960,
    minCardWidth: 250,
    maxCardAspectRatio: 4,
  },
  {
    name: "split-builder",
    width: 1024,
    height: 768,
    minCardWidth: 230,
    maxCardAspectRatio: 4,
  },
  {
    name: "phone-builder",
    width: 390,
    height: 844,
    minCardWidth: 300,
    maxCardAspectRatio: 4.8,
  },
] as const

async function openWebResumeBuilder(page: Page) {
  await page.goto("/")
  await page.getByRole("link", { name: "进入工作台选择模板" }).first().click()
  await expect(page).toHaveURL(/\/workspace$/)
  const newResumeButton = page.getByTestId("new-resume")
  if (await newResumeButton.isVisible()) {
    await newResumeButton.click()
    await expect(page.getByTestId("workspace-template-dialog")).toBeVisible()
  }
  const createButton = page.getByTestId("create-resume")
  await expect(createButton).toBeDisabled()
  await page.getByTestId("workspace-template-option").first().click()
  await expect(createButton).toBeEnabled()
  await createButton.click()
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+$/)
  const webHref = await page.locator('a[href$="/web"]').first().getAttribute("href")
  if (!webHref) {
    throw new Error("编辑器缺少 Web 页面链接")
  }
  await page.goto(new URL(webHref, page.url()).toString())
  await expect(page).toHaveURL(/\/editor\/[a-f0-9-]+\/web$/)
  await expect(page.locator(".resume-web-page")).toHaveAttribute(
    "data-template-ready",
    "true",
  )
}

async function selectWebTemplate(page: Page, templateId: string, templateName: string) {
  await page.getByLabel("Web 模板").getByText(templateName, { exact: true }).click()
  const preview = page.locator(".resume-web-page")
  await expect(preview).toHaveAttribute("data-web-template", templateId)
  await expect(preview).toHaveAttribute("data-template-ready", "true")
  await preview.locator(".web-resume-content").evaluate((element) => {
    element.scrollTop = 0
  })
}

async function expectHoverGeometryStable(card: Locator) {
  await card.scrollIntoViewIfNeeded()
  // 基线必须在入场动画结束之后采集：否则 before 采到的是动画中途的亚像素状态，
  // hover 后再测一次就必然对不上。web-item-enter 为 620ms，
  // nth-child 还叠加最多 210ms 的 stagger，因此这里等待两者的总和。
  await waitForEntryAnimations(card)
  const measure = () =>
    card.evaluate((element) => {
      const content = element.querySelector<HTMLElement>(
        ":scope > .web-resume-item-header, :scope > h3",
      )
      const cardRect = element.getBoundingClientRect()
      const contentRect = content?.getBoundingClientRect()
      const style = getComputedStyle(element)
      const round = (value: number) => Math.round(value * 100) / 100
      return {
        width: round(cardRect.width),
        height: round(cardRect.height),
        padding: [
          style.paddingTop,
          style.paddingRight,
          style.paddingBottom,
          style.paddingLeft,
        ],
        contentLeft: round((contentRect?.left ?? cardRect.left) - cardRect.left),
        contentTop: round((contentRect?.top ?? cardRect.top) - cardRect.top),
      }
    })

  const before = await measure()
  await card.hover()
  await waitForEntryAnimations(card)

  // 断言必须带容差。getBoundingClientRect 返回的是浮点布局值，
  // 在 CPU 争抢时同一元素两次采样会差 0.01px（实测 697.24 vs 697.23），
  // 按两位小数做全等比较会随机失败。
  //
  // 容差取 0.5px：真实的布局回归（hover 改内边距会移动 2px 以上）
  // 依然会被抓到，而亚像素噪声不会。
  const after = await measure()
  const tolerance = 0.5
  for (const key of ["width", "height", "contentLeft", "contentTop"] as const) {
    expect(Math.abs(after[key] - before[key])).toBeLessThanOrEqual(tolerance)
  }
  expect(after.padding).toEqual(before.padding)
}

/**
 * 等待卡片上声明的入场动画结束。
 *
 * 只用 getAnimations 不够：仍处于 animation-delay 阶段、尚未开始播放的动画
 * 不会出现在返回列表里，所以同时读取计算样式里声明的时长与延迟。
 */
async function waitForEntryAnimations(card: Locator) {
  await card.evaluate(async (element) => {
    const style = window.getComputedStyle(element)
    const declared =
      (Number.parseFloat(style.animationDuration) || 0) +
      (Number.parseFloat(style.animationDelay) || 0)
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    )
    if (declared > 0) {
      await new Promise((resolve) => setTimeout(resolve, declared + 120))
    }
  })
}

async function expectLayerPinned(preview: Locator, layer: Locator) {
  const scrollContainer = preview.locator(".web-resume-content")
  await scrollContainer.evaluate((element) => {
    element.style.scrollBehavior = "auto"
    element.scrollTop = 0
  })
  const initialOffset = await layer.evaluate((element, rootSelector) => {
    const root = element.closest(rootSelector)
    if (!root) {
      return Number.NaN
    }
    return element.getBoundingClientRect().top - root.getBoundingClientRect().top
  }, ".resume-web-page")
  await scrollContainer.evaluate((element) => {
    element.scrollTop = element.scrollHeight * 0.6
  })
  await expect
    .poll(() => scrollContainer.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(500)
  const scrolledOffset = await layer.evaluate((element, rootSelector) => {
    const root = element.closest(rootSelector)
    if (!root) {
      return Number.NaN
    }
    return element.getBoundingClientRect().top - root.getBoundingClientRect().top
  }, ".resume-web-page")

  expect(Math.abs(scrolledOffset - initialOffset)).toBeLessThanOrEqual(1.5)
}

async function auditWebTemplateLayout(
  page: Page,
  input: {
    templateId: string
    viewportName: string
    minCardWidth: number
    maxCardAspectRatio: number
  },
) {
  return page.locator(".resume-web-page").evaluate((root, auditInput) => {
    const issues: Array<{
      template: string
      viewport: string
      code: string
      selector: string
      value: number
      limit: number
    }> = []
    const tolerance = 1.5
    const round = (value: number) => Math.round(value * 10) / 10
    const addIssue = (code: string, selector: string, value: number, limit: number) => {
      issues.push({
        template: auditInput.templateId,
        viewport: auditInput.viewportName,
        code,
        selector,
        value: round(value),
        limit: round(limit),
      })
    }

    for (const animation of root.getAnimations({ subtree: true })) {
      const timing = animation.effect?.getTiming()
      if (timing?.iterations === Number.POSITIVE_INFINITY) {
        animation.cancel()
      } else {
        animation.finish()
      }
    }
    root.dataset.enhanced = "false"
    for (const element of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
      element.dataset.visible = "true"
    }

    const rootOverflow = root.scrollWidth - root.clientWidth
    if (rootOverflow > tolerance) {
      addIssue("root-horizontal-overflow", ".resume-web-page", rootOverflow, tolerance)
    }

    const overflowSelectors = [
      ".web-resume-content",
      ".web-resume-hero",
      ".web-resume-hero h1",
      ".web-resume-module",
      ".web-resume-module-items",
      ".web-resume-skill-matrix",
      ".web-resume-item",
      ".web-resume-skill-matrix article",
      ".web-resume-contacts",
      ".web-resume-tags",
    ]
    for (const element of root.querySelectorAll<HTMLElement>(
      overflowSelectors.join(","),
    )) {
      const style = getComputedStyle(element)
      if (style.display === "none" || style.visibility === "hidden") {
        continue
      }
      const overflow = element.scrollWidth - element.clientWidth
      if (overflow > tolerance) {
        addIssue(
          "element-horizontal-overflow",
          element.className || element.tagName.toLowerCase(),
          overflow,
          tolerance,
        )
      }
    }

    const nameHeading = root.querySelector<HTMLElement>(".web-resume-hero h1")
    if (nameHeading) {
      const nameStyle = getComputedStyle(nameHeading)
      const fontSize = Number.parseFloat(nameStyle.fontSize)
      const paddingInlineEnd = Number.parseFloat(nameStyle.paddingInlineEnd)
      const minimumGlyphSafetySpace = fontSize * 0.1
      if (nameStyle.overflow !== "visible") {
        addIssue(
          "name-glyphs-can-be-clipped",
          ".web-resume-hero h1",
          nameStyle.overflow === "hidden" ? 1 : 0.5,
          0,
        )
      }
      if (paddingInlineEnd < minimumGlyphSafetySpace) {
        addIssue(
          "name-glyph-safety-space-too-small",
          ".web-resume-hero h1",
          paddingInlineEnd,
          minimumGlyphSafetySpace,
        )
      }
    }

    const motionScene = root.querySelector<HTMLElement>("[data-web-motion-scene]")
    if (!motionScene) {
      addIssue("theme-motion-scene-missing", "[data-web-motion-scene]", 0, 1)
    } else {
      if (!motionScene.querySelector("[data-web-motion-stage]")) {
        addIssue("theme-motion-stage-missing", "[data-web-motion-stage]", 0, 1)
      }
      const visibleMotionElements = Array.from(
        motionScene.querySelectorAll<SVGElement>("path, circle, rect"),
      ).filter((element) => Number.parseFloat(getComputedStyle(element).opacity) > 0)
      if (visibleMotionElements.length === 0) {
        addIssue("theme-motion-elements-hidden", "[data-web-motion-scene]", 0, 1)
      }
    }

    if (root.dataset.hasHeroAsset === "false") {
      const heroVisualCount = root.querySelectorAll(".web-resume-hero-visual").length
      if (heroVisualCount > 0) {
        addIssue(
          "empty-hero-visual-still-rendered",
          ".web-resume-hero-visual",
          heroVisualCount,
          0,
        )
      }
    }

    const composition = root.dataset.composition ?? ""
    const usesSideNavigation = ["archive", "grid", "studio", "mosaic"].includes(
      composition,
    )
    const navigation = root.querySelector<HTMLElement>(".web-resume-navigation")
    const navigationVisible =
      navigation !== null && getComputedStyle(navigation).display !== "none"
    if (usesSideNavigation && navigationVisible) {
      const activeLabel = navigation.querySelector<HTMLElement>(
        'a[aria-current="location"] .web-resume-navigation-label',
      )
      if (
        !activeLabel ||
        getComputedStyle(activeLabel).display === "none" ||
        activeLabel.getBoundingClientRect().width <= tolerance
      ) {
        addIssue(
          "active-navigation-title-hidden",
          ".web-resume-navigation-label",
          activeLabel?.getBoundingClientRect().width ?? 0,
          tolerance,
        )
      }
    }

    for (const module of root.querySelectorAll<HTMLElement>(".web-resume-module")) {
      const heading = module.querySelector<HTMLElement>(
        ":scope > .web-resume-module-heading",
      )
      const content = module.querySelector<HTMLElement>(
        ":scope > .web-resume-module-items, :scope > .web-resume-skill-matrix",
      )
      if (!heading || !content) {
        continue
      }
      const headingStyle = getComputedStyle(heading)
      const headingRect = heading.getBoundingClientRect()
      const headingVisuallyHidden =
        headingRect.width <= tolerance && headingRect.height <= tolerance
      if (usesSideNavigation && navigationVisible && !headingVisuallyHidden) {
        addIssue(
          "duplicate-module-heading",
          ".web-resume-module-heading",
          headingRect.width,
          tolerance,
        )
      }
      if (!navigationVisible && headingVisuallyHidden) {
        addIssue(
          "mobile-module-heading-hidden",
          ".web-resume-module-heading",
          headingRect.width,
          tolerance,
        )
      }
      if (!usesSideNavigation && navigationVisible) {
        if (headingStyle.position === "sticky") {
          addIssue("module-heading-still-sticky", ".web-resume-module-heading", 1, 0)
        }
        const navigationHeight = navigation?.getBoundingClientRect().height ?? 0
        const scrollMarginTop = Number.parseFloat(
          getComputedStyle(module).scrollMarginTop,
        )
        if (scrollMarginTop + tolerance < navigationHeight) {
          addIssue(
            "module-anchor-covered-by-navigation",
            ".web-resume-module",
            scrollMarginTop,
            navigationHeight,
          )
        }
      }
      if (getComputedStyle(module).display !== "grid") {
        continue
      }
      const headingWidth = heading.getBoundingClientRect().width
      const contentWidth = content.getBoundingClientRect().width
      const columnWidth = headingWidth + contentWidth
      const headingShare = columnWidth > 0 ? headingWidth / columnWidth : 0
      if (headingShare > 0.28) {
        addIssue(
          "module-heading-too-wide",
          ".web-resume-module-heading",
          headingShare,
          0.28,
        )
      }
    }

    const modules = Array.from(root.querySelectorAll<HTMLElement>(".web-resume-module"))
    const lastModule = modules.at(-1)
    const lastModuleContent = lastModule?.querySelector<HTMLElement>(
      ":scope > .web-resume-module-items, :scope > .web-resume-skill-matrix",
    )
    if (lastModule && lastModuleContent) {
      const lastModuleMinHeight = Number.parseFloat(
        getComputedStyle(lastModule).minHeight,
      )
      if (lastModuleMinHeight > tolerance) {
        addIssue(
          "last-module-min-height-not-reset",
          ".web-resume-module:last-child",
          lastModuleMinHeight,
          0,
        )
      }

      const scrollContainer =
        root.querySelector<HTMLElement>(".web-resume-content") ?? root
      const rootRect = scrollContainer.getBoundingClientRect()
      const contentRect = lastModuleContent.getBoundingClientRect()
      const contentBottom =
        contentRect.bottom - rootRect.top + scrollContainer.scrollTop
      const pageBottomGap = scrollContainer.scrollHeight - contentBottom
      const maximumBottomGap = auditInput.viewportName === "phone-builder" ? 64 : 80
      if (pageBottomGap > maximumBottomGap + tolerance) {
        addIssue(
          "page-bottom-gap-too-large",
          ".web-resume-module:last-child",
          pageBottomGap,
          maximumBottomGap,
        )
      }
      if (pageBottomGap < 40 - tolerance) {
        addIssue(
          "page-bottom-gap-too-small",
          ".web-resume-module:last-child",
          pageBottomGap,
          40,
        )
      }
    }

    const minReadableWidth = Math.min(
      auditInput.minCardWidth,
      Math.max(180, root.clientWidth - 48),
    )
    for (const article of root.querySelectorAll<HTMLElement>(".web-resume-item")) {
      const style = getComputedStyle(article)
      if (style.display === "none" || style.visibility === "hidden") {
        continue
      }
      const paddingLeft = Number.parseFloat(style.paddingLeft)
      const paddingRight = Number.parseFloat(style.paddingRight)
      if (Math.abs(paddingLeft - 12) > tolerance) {
        addIssue("article-left-padding-not-12px", ".web-resume-item", paddingLeft, 12)
      }
      if (Math.abs(paddingRight - 12) > tolerance) {
        addIssue("article-right-padding-not-12px", ".web-resume-item", paddingRight, 12)
      }
      if (getComputedStyle(article, "::before").display !== "none") {
        addIssue("article-index-visible", ".web-resume-item::before", 1, 0)
      }
      const container = article.parentElement
      const articleRect = article.getBoundingClientRect()
      const containerStyle = container ? getComputedStyle(container) : null
      const containerWidth = container
        ? container.getBoundingClientRect().width -
          Number.parseFloat(containerStyle?.paddingLeft ?? "0") -
          Number.parseFloat(containerStyle?.paddingRight ?? "0")
        : 0
      const widthShare = containerWidth > 0 ? articleRect.width / containerWidth : 0
      if (widthShare < 0.92) {
        addIssue("article-too-narrow-for-content", ".web-resume-item", widthShare, 0.92)
      }
      const aspectRatio = articleRect.height / Math.max(1, articleRect.width)
      if (aspectRatio > auditInput.maxCardAspectRatio) {
        addIssue(
          "article-too-tall-for-width",
          ".web-resume-item",
          aspectRatio,
          auditInput.maxCardAspectRatio,
        )
      }
    }

    for (const card of root.querySelectorAll<HTMLElement>(
      ".web-resume-skill-matrix article",
    )) {
      const style = getComputedStyle(card)
      if (style.display === "none" || style.visibility === "hidden") {
        continue
      }
      const rect = card.getBoundingClientRect()
      if (rect.width < minReadableWidth) {
        addIssue(
          "card-too-narrow",
          card.className || card.tagName,
          rect.width,
          minReadableWidth,
        )
      }
      const aspectRatio = rect.height / Math.max(1, rect.width)
      if (aspectRatio > auditInput.maxCardAspectRatio) {
        addIssue(
          "card-too-tall-for-width",
          card.className || card.tagName,
          aspectRatio,
          auditInput.maxCardAspectRatio,
        )
      }
    }

    return issues
  }, input)
}

test("audits every web resume template layout across widths", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text())
    }
  })

  await page.setViewportSize(viewportCases[0])
  await openWebResumeBuilder(page)

  const layoutIssues: Awaited<ReturnType<typeof auditWebTemplateLayout>> = []
  for (const viewport of viewportCases) {
    await page.setViewportSize(viewport)
    await expect(page.locator(".resume-web-page")).toBeVisible()
    for (const template of webTemplateCases) {
      await test.step(`${viewport.name} / ${template.name}`, async () => {
        await selectWebTemplate(page, template.id, template.name)
        layoutIssues.push(
          ...(await auditWebTemplateLayout(page, {
            templateId: template.id,
            viewportName: viewport.name,
            minCardWidth: viewport.minCardWidth,
            maxCardAspectRatio: viewport.maxCardAspectRatio,
          })),
        )
      })
    }
  }

  expect({
    count: layoutIssues.length,
    issues: layoutIssues.slice(0, 80),
  }).toEqual({ count: 0, issues: [] })

  await page.emulateMedia({ reducedMotion: "reduce" })
  await selectWebTemplate(page, "terminal-signal", "终端信号")
  await expect(page.locator(".web-resume-motion-layer-flow")).toHaveCSS(
    "animation-name",
    "none",
  )
  await expect(page.locator(".web-motion-flow").first()).toHaveCSS(
    "animation-name",
    "none",
  )
  await page.emulateMedia({ reducedMotion: "no-preference" })

  expect(consoleErrors).toEqual([])
})

test("keeps the theme background pinned and card contents stable on hover", async ({
  page,
}) => {
  await page.setViewportSize(viewportCases[0])
  await openWebResumeBuilder(page)

  const preview = page.locator(".resume-web-page")
  const backgroundContainer = preview.locator(".web-resume-background")
  const background = preview.locator(".web-resume-grid")
  const motionScene = preview.locator("[data-web-motion-scene]")
  const progress = preview.locator(".web-resume-progress")
  await expect(backgroundContainer).toHaveCSS("position", "sticky")
  await expect(background).toHaveCSS("position", "absolute")
  const initialProgress = await progress.evaluate((element) => {
    const trackStyle = getComputedStyle(element)
    const fillStyle = getComputedStyle(element, "::after")
    return {
      fillContent: fillStyle.content,
      fillTransform: fillStyle.transform,
      trackBackground: trackStyle.backgroundColor,
      trackTransform: trackStyle.transform,
    }
  })
  expect(initialProgress.fillContent).not.toBe("none")
  expect(initialProgress.trackBackground).not.toBe("rgba(0, 0, 0, 0)")
  expect(initialProgress.trackBackground).not.toBe("transparent")
  expect(initialProgress.trackTransform).toBe("none")
  await expectLayerPinned(preview, motionScene)
  await expect
    .poll(() =>
      progress.evaluate((element) => getComputedStyle(element, "::after").transform),
    )
    .not.toBe(initialProgress.fillTransform)

  for (const template of webTemplateCases) {
    await test.step(`hover / ${template.name}`, async () => {
      await selectWebTemplate(page, template.id, template.name)
      await expectLayerPinned(preview, background)
      await expectHoverGeometryStable(preview.locator(".web-resume-item").first())
    })
  }

  await selectWebTemplate(page, "digital-archive", "数字档案")
  await expectHoverGeometryStable(
    preview.locator(".web-resume-skill-matrix article").first(),
  )
})

test("keeps merged titles aligned with navigation targets", async ({ page }) => {
  await page.setViewportSize(viewportCases[0])
  await openWebResumeBuilder(page)

  await selectWebTemplate(page, "kinetic-grid", "动态网格")
  const preview = page.locator(".resume-web-page")
  const scrollContainer = preview.locator(".web-resume-content")
  await scrollContainer.evaluate((element) => {
    element.style.scrollBehavior = "auto"
  })
  await preview.locator('a[href="#web-resume-section-3"]').click()
  await expect
    .poll(() => preview.locator('a[aria-current="location"]').getAttribute("href"))
    .toBe("#web-resume-section-3")
  await expect(
    preview.locator('a[aria-current="location"] .web-resume-navigation-label'),
  ).toHaveText("项目经历")

  await selectWebTemplate(page, "bauhaus-poster", "包豪斯海报")
  await scrollContainer.evaluate((element) => {
    element.style.scrollBehavior = "smooth"
  })
  const topNavigation = preview.locator(".web-resume-navigation nav")
  await expect(topNavigation).toHaveAttribute("data-indicator-ready", "true")
  await expect
    .poll(() => preview.locator('a[aria-current="location"]').getAttribute("href"))
    .toBe("#web-resume-profile")
  await preview.evaluate((root) => {
    const navigation = root.querySelector<HTMLElement>(".web-resume-navigation nav")
    const readActiveHref = () =>
      navigation
        ?.querySelector<HTMLElement>('a[aria-current="location"]')
        ?.getAttribute("href") ?? ""
    root.dataset.navigationHistory = readActiveHref()
    const observer = new MutationObserver(() => {
      const activeHref = readActiveHref()
      const history = root.dataset.navigationHistory?.split(",").filter(Boolean) ?? []
      if (activeHref && history.at(-1) !== activeHref) {
        root.dataset.navigationHistory = [...history, activeHref].join(",")
      }
    })
    if (navigation) {
      observer.observe(navigation, {
        attributes: true,
        attributeFilter: ["aria-current"],
        subtree: true,
      })
    }
  })
  const initialIndicatorTransform = await topNavigation.evaluate(
    (element) => getComputedStyle(element, "::after").transform,
  )
  await preview.locator('a[href="#web-resume-section-3"]').click()
  await expect(preview).toHaveAttribute(
    "data-navigation-target",
    "web-resume-section-3",
  )
  await expect
    .poll(() =>
      preview.evaluate((root) => {
        const navigation = root.querySelector<HTMLElement>(".web-resume-navigation")
        const target = root.querySelector<HTMLElement>("#web-resume-section-3")
        if (!navigation || !target) {
          return Number.NEGATIVE_INFINITY
        }
        return (
          target.getBoundingClientRect().top - navigation.getBoundingClientRect().bottom
        )
      }),
    )
    .toBeGreaterThanOrEqual(-2)
  await expect(preview).not.toHaveAttribute("data-navigation-target")
  expect(
    await preview.evaluate((root) =>
      root.dataset.navigationHistory?.split(",").filter(Boolean),
    ),
  ).toEqual(["#web-resume-profile", "#web-resume-section-3"])
  await expect
    .poll(() =>
      topNavigation.evaluate(
        (element) => getComputedStyle(element, "::after").transform,
      ),
    )
    .not.toBe(initialIndicatorTransform)
  const indicatorAudit = await topNavigation.evaluate((element) => {
    const activeLink = element.querySelector<HTMLElement>('a[aria-current="location"]')
    const indicatorStyle = getComputedStyle(element, "::after")
    return {
      activeLinkTransform: activeLink ? getComputedStyle(activeLink).transform : null,
      indicatorContent: indicatorStyle.content,
      indicatorHeight: indicatorStyle.height,
      indicatorTransitionDuration: indicatorStyle.transitionDuration,
      legacyIndicatorDisplay: activeLink
        ? getComputedStyle(activeLink, "::before").display
        : null,
    }
  })
  expect(indicatorAudit).toEqual({
    activeLinkTransform: "none",
    indicatorContent: '""',
    indicatorHeight: "3px",
    indicatorTransitionDuration: "0.28s, 0.16s, 0.32s",
    legacyIndicatorDisplay: "none",
  })
})
