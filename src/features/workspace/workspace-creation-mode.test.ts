import { describe, expect, it } from "vitest"
import { resolveWorkspaceCreationMode } from "./workspace-creation-mode"

describe("resolveWorkspaceCreationMode", () => {
  it("hides creation for Preview accounts", () => {
    expect(resolveWorkspaceCreationMode(true, 0)).toBe("hidden")
    expect(resolveWorkspaceCreationMode(true, 1)).toBe("hidden")
  })

  it("shows the inline template library when no resumes exist", () => {
    expect(resolveWorkspaceCreationMode(false, 0)).toBe("inline")
  })

  it("moves template selection into a dialog when resumes exist", () => {
    expect(resolveWorkspaceCreationMode(false, 1)).toBe("dialog")
    expect(resolveWorkspaceCreationMode(false, 12)).toBe("dialog")
  })
})
