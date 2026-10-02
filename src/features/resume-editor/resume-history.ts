export class ResumeHistory<T> {
  private readonly limit: number
  private past: T[] = []
  private future: T[] = []

  constructor(limit = 80) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("History limit must be a positive integer")
    }
    this.limit = limit
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  record(current: T): void {
    this.past = [...this.past.slice(1 - this.limit), current]
    this.future = []
  }

  undo(current: T): T | null {
    if (!this.past.length) {
      return null
    }
    const previous = this.past[this.past.length - 1]
    this.past = this.past.slice(0, -1)
    this.future = [current, ...this.future].slice(0, this.limit)
    return previous
  }

  redo(current: T): T | null {
    if (!this.future.length) {
      return null
    }
    const next = this.future[0]
    this.future = this.future.slice(1)
    this.past = [...this.past, current].slice(-this.limit)
    return next
  }

  reset(): void {
    this.past = []
    this.future = []
  }
}
