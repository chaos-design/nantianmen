import type { Page } from "@playwright/test"
import { expect, test } from "./fixtures"

const runAsAdmin = process.env.PLAYWRIGHT_AS_ADMIN === "1"

/**
 * 打开公告配置面板并等到面板体可用。
 *
 * 触发按钮是客户端组件：SSR 阶段就渲染出来了，但 React 水合之前点击没有响应，
 * 这里以「点击后抽屉是否出现」作为条件重试的依据，不用固定延时。
 *
 * 抽屉出现后还要等面板体：面板体是动态 chunk（`next/dynamic`），挂载晚于抽屉本身。
 * 只等抽屉会在面板体到达之前就读列表，把「还没加载」误判成「列表为空」。
 * 抽屉一旦出现就不再点触发按钮，否则第二次点击会把抽屉关掉。
 */
async function openAnnouncementAdmin(page: Page) {
  const trigger = page.getByTestId("open-announcement-admin")
  const panel = page.getByTestId("announcement-admin-panel")
  const panelBody = page.getByTestId("announcement-admin-body")
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await trigger.click()
    const opened = await panel
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false)
    if (opened) {
      await panelBody.waitFor({ state: "visible", timeout: 20_000 })
      return
    }
  }
  throw new Error("公告配置面板未能打开")
}

/**
 * 清空管理员配置面板里的全部公告。
 *
 * 公告没有 cleanSlate 清理机制（简历有），用例失败时会把条目留给后续用例，
 * 导致后面的计数断言连锁失败。删除动作同样走 UI，保留真实权限校验。
 *
 * 同步点用条目数量而不是 toast 文案：sonner 的 toast 会停留数秒，
 * 拿它做同步会在上一次删除仍处于 pending 时就发起下一次点击。
 */
async function clearAllAnnouncements(page: Page) {
  await page.goto("/workspace")
  await openAnnouncementAdmin(page)

  const items = page.locator(".announcement-admin-item")
  let remaining = await items.count()
  while (remaining > 0) {
    await items
      .first()
      .getByRole("button", { name: /删除|放弃/ })
      .click()
    await expect(items).toHaveCount(remaining - 1)
    remaining -= 1
  }
  await page.keyboard.press("Escape")
}

test.describe("platform announcement carousel", () => {
  test("shows no carousel when no announcement is published", async ({ page }) => {
    if (runAsAdmin) {
      await clearAllAnnouncements(page)
    }
    await page.goto("/workspace")

    await expect(page.getByTestId("announcement-carousel")).toHaveCount(0)
  })

  test("refuses to configure announcements for a regular member", async ({
    page,
    request,
    baseURL,
  }) => {
    // 这个用例断言写操作被拒绝，只有在普通成员身份下才成立。
    test.skip(runAsAdmin, "需要普通成员身份")
    await page.goto("/workspace")

    // 管理员入口对普通成员完全不渲染。
    await expect(page.getByTestId("open-announcement-admin")).toHaveCount(0)

    const origin = new URL(baseURL ?? "http://127.0.0.1:3000").origin
    const payload = {
      level: "info",
      title: "越权公告",
      body: "普通成员不应该能创建这条公告。",
      linkLabel: "",
      linkHref: "",
      enabled: true,
      sortOrder: 0,
      startsAt: null,
      endsAt: null,
    }

    // 读取生效公告是所有登录用户的共同能力，必须成功。
    const readResponse = await request.get("/api/announcements")
    // 三个写入口都必须被服务端拒绝，不能依赖前端隐藏按钮。
    const createResponse = await request.post("/api/announcements", {
      headers: { origin },
      data: payload,
    })
    const updateResponse = await request.patch("/api/announcements/any-id", {
      headers: { origin },
      data: payload,
    })
    const deleteResponse = await request.delete("/api/announcements/any-id", {
      headers: { origin },
    })

    expect(readResponse.status()).toBe(200)
    expect(createResponse.status()).toBe(403)
    expect(updateResponse.status()).toBe(403)
    expect(deleteResponse.status()).toBe(403)
    await expect(createResponse.json()).resolves.toMatchObject({
      error: { code: "ADMIN_REQUIRED" },
    })
  })

  test("creates a visible announcement and closes it as the current user", async ({
    page,
  }) => {
    test.skip(!runAsAdmin, "需要 PLAYWRIGHT_AS_ADMIN=1 才能创建公告")
    await clearAllAnnouncements(page)
    const carousel = page.getByTestId("announcement-carousel")

    await page.goto("/workspace")
    await openAnnouncementAdmin(page)
    await page.getByTestId("announcement-create").click()

    // 新建只插入本地草稿并打开表单，尚未落库，因此表单里的保存按钮可用。
    const form = page.getByTestId("announcement-form")
    await expect(form).toBeVisible()
    await expect(page.locator(".announcement-admin-item")).toHaveCount(0)

    // 标题和正文为空时不能保存：服务端 Schema 要求非空。
    await expect(form.getByTestId("announcement-save")).toBeDisabled()

    await form.getByLabel("标题").fill("E2E 平台公告")
    await form.getByLabel("正文").fill("这条公告由端到端测试创建，用于验证轮播与关闭。")
    await form.getByTestId("announcement-save").click()

    // 保存后回到列表，条目出现即代表落库完成，不依赖 toast 停留时间。
    const createdItem = page.locator(".announcement-admin-item").last()
    await expect(createdItem).toContainText("E2E 平台公告")

    await page.keyboard.press("Escape")
    await expect(carousel).toBeVisible()
    await expect(carousel).toContainText("E2E 平台公告")

    await carousel.getByTestId("announcement-dismiss").click()
    await expect(carousel).toHaveCount(0)

    // 关闭只影响当前浏览器，重新加载后不再展示这条公告。
    await page.reload()
    await expect(carousel).toHaveCount(0)

    // 清理：删除刚创建的公告，避免影响后续用例。
    await clearAllAnnouncements(page)
    await expect(carousel).toHaveCount(0)
  })

  test("keeps a paused carousel when the user stops the rotation", async ({ page }) => {
    test.skip(!runAsAdmin, "需要 PLAYWRIGHT_AS_ADMIN=1 才能创建公告")
    await clearAllAnnouncements(page)
    const carousel = page.getByTestId("announcement-carousel")

    // 轮播暂停只在存在两条以上公告时才有意义：
    // 单条公告没有可切换的下一条，因此组件不渲染暂停控件。
    for (const title of ["E2E 轮播暂停甲", "E2E 轮播暂停乙"]) {
      await page.goto("/workspace")
      await openAnnouncementAdmin(page)
      await page.getByTestId("announcement-create").click()
      const form = page.getByTestId("announcement-form")
      await form.getByLabel("标题").fill(title)
      await form.getByLabel("正文").fill("暂停后当前公告不会自动切换。")
      await form.getByTestId("announcement-save").click()
      await expect(page.locator(".announcement-admin-item").last()).toContainText(title)
      await page.keyboard.press("Escape")
    }

    await expect(carousel).toBeVisible()
    await expect(
      carousel.getByRole("button", { name: "查看第 2 条公告" }),
    ).toBeVisible()

    const toggle = carousel.getByTestId("announcement-rotation-toggle")
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-pressed", "true")

    await clearAllAnnouncements(page)
    await expect(carousel).toHaveCount(0)
  })

  test("discards an unsaved draft when the panel closes", async ({ page }) => {
    test.skip(!runAsAdmin, "需要 PLAYWRIGHT_AS_ADMIN=1 才能打开配置面板")
    const panelItems = page.locator(".announcement-admin-item")
    const form = page.getByTestId("announcement-form")

    await clearAllAnnouncements(page)
    await page.goto("/workspace")
    await openAnnouncementAdmin(page)
    await expect(panelItems).toHaveCount(0)

    await page.getByTestId("announcement-create").click()
    await form.getByLabel("标题").fill("未保存的草稿")
    await form.getByLabel("正文").fill("关闭面板后不应该留下任何数据。")

    await page.keyboard.press("Escape")
    await expect(panelItems).toHaveCount(0)

    // 草稿从未落库，重新打开面板和刷新页面都不会看到它。
    await openAnnouncementAdmin(page)
    await expect(panelItems).toHaveCount(0)
    await page.keyboard.press("Escape")

    await page.reload()
    await expect(page.getByTestId("announcement-carousel")).toHaveCount(0)
  })

  test("shows the list first and only opens the form on demand", async ({ page }) => {
    test.skip(!runAsAdmin, "需要 PLAYWRIGHT_AS_ADMIN=1 才能创建公告")
    const panelItems = page.locator(".announcement-admin-item")
    const form = page.getByTestId("announcement-form")

    await clearAllAnnouncements(page)
    await page.goto("/workspace")
    await openAnnouncementAdmin(page)

    // 打开面板停在列表：没有条目时也不该直接铺开一张表单。
    await expect(page.getByTestId("announcement-create")).toBeVisible()
    await expect(form).toHaveCount(0)

    await page.getByTestId("announcement-create").click()
    await form.getByLabel("标题").fill("E2E 按需编辑")
    await form.getByLabel("正文").fill("列表与表单不应该同时出现。")
    await form.getByTestId("announcement-save").click()

    const createdItem = panelItems.last()
    await expect(createdItem).toContainText("E2E 按需编辑")
    await expect(form).toHaveCount(0)

    // 编辑已有公告：条目摘要就位，表单带出已保存内容。
    await createdItem.getByTestId("announcement-edit").click()
    await expect(form.getByLabel("标题")).toHaveValue("E2E 按需编辑")
    // 没改动时保存按钮必须禁用，避免无意义的写请求。
    await expect(form.getByTestId("announcement-save")).toBeDisabled()

    await form.getByLabel("标题").fill("E2E 按需编辑（已改）")
    await expect(form.getByTestId("announcement-save")).toBeEnabled()
    await form.getByTestId("announcement-save").click()
    await expect(panelItems.last()).toContainText("E2E 按需编辑（已改）")

    await clearAllAnnouncements(page)
  })

  test("drops a new draft when the admin leaves the form", async ({ page }) => {
    test.skip(!runAsAdmin, "需要 PLAYWRIGHT_AS_ADMIN=1 才能创建公告")
    const panelItems = page.locator(".announcement-admin-item")
    const form = page.getByTestId("announcement-form")

    await clearAllAnnouncements(page)
    await page.goto("/workspace")
    await openAnnouncementAdmin(page)

    await page.getByTestId("announcement-create").click()
    await form.getByLabel("标题").fill("会被放弃的草稿")
    await form.getByLabel("正文").fill("放弃草稿后不应该留下任何数据。")
    await form.getByTestId("announcement-cancel").click()

    // 放弃草稿等于删掉这一行，列表回到空态。
    await expect(form).toHaveCount(0)
    await expect(panelItems).toHaveCount(0)
    await expect(page.getByTestId("announcement-admin-body")).toContainText(
      "还没有公告",
    )

    await page.keyboard.press("Escape")
    await expect(page.getByTestId("announcement-carousel")).toHaveCount(0)
  })

  test("caps the announcement time picker inside a scrollable calendar", async ({
    page,
  }) => {
    test.skip(!runAsAdmin, "需要 PLAYWRIGHT_AS_ADMIN=1 才能打开配置面板")

    await clearAllAnnouncements(page)
    await page.goto("/workspace")
    await openAnnouncementAdmin(page)
    await page.getByTestId("announcement-create").click()

    const trigger = page.getByTestId("announcement-form-starts-at-trigger")
    await expect(trigger).toBeVisible()
    await trigger.click()

    // 日历必须限高并在自身内部滚动，否则会连时段选择一起顶出抽屉。
    const calendar = page.locator(".announcement-time-calendar")
    await expect(calendar).toBeVisible()
    const metrics = await calendar.evaluate((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      overflowY: getComputedStyle(node).overflowY,
    }))
    expect(metrics.overflowY).toBe("auto")
    // 限高按 15rem 生效，日历本身仍然高于可视高度，因此确实需要滚动。
    expect(metrics.clientHeight).toBeLessThanOrEqual(15 * 16)
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)

    // 收起日历后时段选择仍在同一个弹层里，没被顶出可视范围。
    await page.keyboard.press("Escape")
    await expect(calendar).toHaveCount(0)
    await expect(trigger).toBeVisible()

    await page.keyboard.press("Escape")
  })

  test("caps the hour and minute dropdowns inside a scrollable list", async ({
    page,
  }) => {
    test.skip(!runAsAdmin, "需要 PLAYWRIGHT_AS_ADMIN=1 才能打开配置面板")

    await clearAllAnnouncements(page)
    await page.goto("/workspace")
    await openAnnouncementAdmin(page)
    await page.getByTestId("announcement-create").click()

    await page.getByTestId("announcement-form-starts-at-trigger").click()

    // 小时下拉有 24 项、每项 32px，自然高度 776px。
    // SelectContent 自带的 available-height 只挡视口，弹层靠上时挡不住。
    await page.getByLabel("开始时间的小时").click()
    const hourList = page.getByRole("listbox")
    await expect(hourList).toBeVisible()
    const hourMetrics = await hourList.evaluate((node) => ({
      maxHeight: getComputedStyle(node).maxHeight,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
    }))
    expect(parseFloat(hourMetrics.maxHeight)).toBeLessThanOrEqual(12 * 16)
    expect(hourMetrics.scrollHeight).toBeGreaterThan(hourMetrics.clientHeight)
    await page.keyboard.press("Escape")

    // 分钟下拉 12 项，同样超过上限，行为必须一致。
    await page.getByLabel("开始时间的分钟").click()
    const minuteMetrics = await page.getByRole("listbox").evaluate((node) => ({
      maxHeight: getComputedStyle(node).maxHeight,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
    }))
    expect(parseFloat(minuteMetrics.maxHeight)).toBeLessThanOrEqual(12 * 16)
    expect(minuteMetrics.scrollHeight).toBeGreaterThan(minuteMetrics.clientHeight)

    // 选一个值确认限高没有破坏交互：下拉仍然能选到 30 分。
    await page.getByRole("option", { name: "30 分" }).click()
    await expect(page.getByTestId("announcement-form-starts-at-trigger")).toContainText(
      "09:30",
    )

    await page.keyboard.press("Escape")
  })
})
