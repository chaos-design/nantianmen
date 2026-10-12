import { expect, test } from "./fixtures"

/**
 * Slogan（品牌标记）跳转的回归测试。
 * 这两个目标路径是产品约定：编辑器里点 slogan 回到工作台，工作台点 slogan 回到首页。
 * 一旦有人误改成其它地址（例如把编辑器的入口指回 /），这里立刻红灯。
 */
test("workspace slogan links back to the landing page", async ({ page }) => {
  await page.goto("/workspace")
  await page.locator(".brand-mark").waitFor({ timeout: 30_000 })
  await expect(page.locator(".brand-mark")).toHaveAttribute("href", "/")
})

test("editor slogan links back to the workspace", async ({ page }) => {
  await page.goto("/")
  const origin = new URL(page.url()).origin
  const created = await page.request.post(`${origin}/api/resumes`, {
    headers: { origin },
    data: {},
  })
  expect(created.ok()).toBe(true)
  const { data } = (await created.json()) as {
    data: { resume: { id: string } }
  }

  await page.goto(`/editor/${data.resume.id}`)
  await page.locator(".brand-mark").waitFor({ timeout: 30_000 })
  await expect(page.locator(".brand-mark")).toHaveAttribute("href", "/workspace")
})
