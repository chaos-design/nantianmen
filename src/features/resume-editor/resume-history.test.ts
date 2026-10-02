import { describe, expect, it } from "vitest"
import { ResumeHistory } from "./resume-history"

describe("resume history", () => {
  it("limits retained snapshots while preserving undo order", () => {
    const history = new ResumeHistory<string>(3)
    history.record("A")
    history.record("B")
    history.record("C")
    history.record("D")

    expect(history.undo("E")).toBe("D")
    expect(history.undo("D")).toBe("C")
    expect(history.undo("C")).toBe("B")
    expect(history.undo("B")).toBeNull()
  })

  it("moves snapshots between undo and redo stacks", () => {
    const history = new ResumeHistory<string>()
    history.record("A")
    history.record("B")

    expect(history.undo("C")).toBe("B")
    expect(history.canRedo).toBe(true)
    expect(history.redo("B")).toBe("C")
    expect(history.canRedo).toBe(false)
  })

  it("clears redo snapshots after a branched edit", () => {
    const history = new ResumeHistory<string>()
    history.record("A")
    history.record("B")
    expect(history.undo("C")).toBe("B")

    history.record("B")

    expect(history.canRedo).toBe(false)
    expect(history.undo("D")).toBe("B")
  })

  it("resets both history directions", () => {
    const history = new ResumeHistory<string>()
    history.record("A")
    expect(history.undo("B")).toBe("A")

    history.reset()

    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it("rejects invalid history limits", () => {
    expect(() => new ResumeHistory(0)).toThrow(
      "History limit must be a positive integer",
    )
  })
})
