import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"
import { COPY_FAILURE_MESSAGE, copyTextToClipboard } from "./clipboard"

function stubClipboard(writeText: (text: string) => Promise<void>) {
  const clipboard = { writeText: vi.fn(writeText) }
  vi.stubGlobal("navigator", { clipboard })
  return clipboard
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("copyTextToClipboard", () => {
  it("resolves true without toasting when the write succeeds", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => "")
    const clipboard = stubClipboard(() => Promise.resolve())

    await expect(copyTextToClipboard("https://example.com")).resolves.toBe(true)
    expect(clipboard.writeText).toHaveBeenCalledWith("https://example.com")
    expect(error).not.toHaveBeenCalled()
  })

  it("warns and resolves false when the write is rejected", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => "")
    stubClipboard(() => Promise.reject(new Error("denied")))

    await expect(copyTextToClipboard("https://example.com")).resolves.toBe(false)
    expect(error).toHaveBeenCalledWith(COPY_FAILURE_MESSAGE)
  })

  it("warns and resolves false when the clipboard API is unavailable", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => "")
    vi.stubGlobal("navigator", {})

    await expect(copyTextToClipboard("https://example.com")).resolves.toBe(false)
    expect(error).toHaveBeenCalledWith(COPY_FAILURE_MESSAGE)
  })
})
