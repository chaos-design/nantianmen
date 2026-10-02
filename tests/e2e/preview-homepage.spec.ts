import { expect, test } from "./fixtures"

const baseOrigin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3000"}`
const previewConfigured = Boolean(
  process.env.PREVIEW_USER_ID &&
    process.env.PREVIEW_USER_EMAIL &&
    process.env.PREVIEW_RESUME_ID &&
    process.env.PREVIEW_SESSION_SECRET,
)

test.describe("Preview homepage", () => {
  test.skip(!previewConfigured, "Preview env is not configured")

  test("hides unavailable landing actions for Preview accounts", async ({ page }) => {
    const response = await page.request.post("/api/auth/preview", {
      headers: { origin: baseOrigin },
    })
    expect(response.ok()).toBe(true)

    await page.goto("/")

    await expect(page.getByText("Preview 只读体验")).toBeVisible()
    await expect(page.getByText("AI 简历陪练")).toHaveCount(0)
    await expect(page.getByText("发布分享")).toHaveCount(0)
    await expect(page.getByTestId("create-resume")).toHaveCount(0)
    await expect(page.getByTestId("create-resume-from-template")).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: /进入 Preview 工作台/ }).first(),
    ).toBeVisible()
    const templateCarousel = page.locator(".landing-template-grid")
    await expect(
      templateCarousel
        .locator('[data-carousel-source="true"]')
        .locator(".landing-template-sheet"),
    ).toHaveCount(24)
    await expect(
      templateCarousel
        .locator('[data-carousel-clone="true"]')
        .locator(".landing-template-sheet"),
    ).toHaveCount(24)
    await expect(page.locator(".landing-capability-grid > article")).toHaveCount(3)
    await expect(page.locator(".landing-workflow-track > article")).toHaveCount(2)
    await expect(
      page.getByRole("region", { name: "可生成的简历展示结果" }).getByRole("article"),
    ).toHaveCount(3)

    await page
      .getByRole("link", { name: /进入 Preview 工作台/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/workspace$/)
    await expect(page.getByRole("heading", { name: "Preview 简历" })).toBeVisible()
    await expect(page.getByTestId("workspace-template-library")).toHaveCount(0)
    await expect(page.getByTestId("workspace-template-dialog")).toHaveCount(0)
    await expect(page.getByTestId("workspace-template-option")).toHaveCount(0)
    await expect(page.getByTestId("create-resume")).toHaveCount(0)
    await expect(page.getByTestId("new-resume")).toHaveCount(0)
    await expect(page.locator(".workspace-footer")).toHaveCount(0)

    await page.goto(`/editor/${process.env.PREVIEW_RESUME_ID}`)
    await expect(page).toHaveURL(
      new RegExp(`/editor/${process.env.PREVIEW_RESUME_ID}/preview$`),
    )
    await expect(page.getByRole("button", { name: "AI 助手" })).toHaveCount(0)
  })
})
