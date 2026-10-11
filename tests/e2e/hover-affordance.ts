import type { Locator } from "@playwright/test"

export interface HoverAffordanceProbe {
  /** 从产品样式表里取到、去掉媒体条件后重挂的 `:hover` 规则条数。 */
  clonedRules: number
  /** 悬停状态下解析完成的 `box-shadow`。 */
  boxShadow: string
}

/**
 * 读取元素悬停时的 `box-shadow`，并顺带报告前置条件。
 *
 * CI 的 Linux headless Chromium 把 `(hover: hover)` 报成不匹配，包在
 * `@media (hover: hover)` 里的悬停样式整体不生效；而 macOS 上即使 headless
 * 也报 `(hover: hover)`，所以同一个断言本地永远绿、CI 永远红，没法靠本地复现。
 * Playwright 没有 emulateMedia 的 hover 选项（1.55 只支持 colorScheme、
 * contrast、forcedColors、media、reducedMotion），CDP 的
 * `Emulation.setEmulatedMedia` 实测也改不动 hover / pointer 这两个特性。
 *
 * 这里不去伪造浏览器能力，而是把页面样式表里**匹配当前元素**的那几条
 * `:hover` 规则去掉媒体条件重挂一次：声明文本仍然是产品 CSS 本身，选择器、
 * :hover 触发、自定义属性求解、级联顺序全都照常，唯一被绕过的就是
 * 「宿主有没有悬停指针」这一条宿主能力。宿主本来就支持悬停时结果完全相同，
 * 因此本地和 CI 走的是同一条代码路径。
 *
 * 调用前必须先把指针停在元素上（`locator.hover()`），否则 `clonedRules` 为 0，
 * 取到的是未悬停的样式。不要用 `element.matches(":hover")` 判断指针状态：
 * 实测过 Chromium 在样式已按 `:hover` 生效时仍可能返回 false。
 */
export async function readHoverAffordance(
  locator: Locator,
): Promise<HoverAffordanceProbe> {
  return locator.evaluate((element) => {
    for (const previous of Array.from(
      document.querySelectorAll("style[data-e2e-hover-clone]"),
    )) {
      previous.remove()
    }

    const cloned: string[] = []
    const visit = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) {
          visit(rule.cssRules)
          continue
        }
        if (!(rule instanceof CSSStyleRule)) continue
        if (!rule.selectorText.includes(":hover")) continue
        let hits = false
        try {
          hits = element.matches(rule.selectorText)
        } catch {
          hits = false
        }
        if (hits) cloned.push(rule.cssText)
      }
    }
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        visit(sheet.cssRules)
      } catch {
        // 跨域样式表的 cssRules 不可读；页面自己的样式表不受影响。
      }
    }

    if (cloned.length > 0) {
      const style = document.createElement("style")
      style.dataset.e2eHoverClone = ""
      style.textContent = cloned.join("\n")
      document.head.append(style)
    }

    return {
      clonedRules: cloned.length,
      boxShadow: getComputedStyle(element).boxShadow,
    }
  })
}
