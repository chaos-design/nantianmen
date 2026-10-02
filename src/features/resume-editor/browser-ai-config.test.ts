import { describe, expect, it } from "vitest"
import {
  clearBrowserAiConfig,
  getBrowserAiConfigStorageKey,
  readBrowserAiConfig,
  saveBrowserAiConfig,
} from "./browser-ai-config"

const ownerId = "11111111-1111-4111-8111-111111111111"

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

describe("browser AI config", () => {
  it("saves, normalizes and reads a versioned config", () => {
    const storage = new MemoryStorage()
    const saved = saveBrowserAiConfig(
      ownerId,
      {
        modelName: "personal-model",
        baseUrl: "https://example.com/v1/",
        apiKey: "personal-key",
      },
      storage,
    )

    expect(saved.baseUrl).toBe("https://example.com/v1")
    expect(readBrowserAiConfig(ownerId, storage)).toEqual(saved)
  })

  it("ignores malformed and unsupported stored values", () => {
    const storage = new MemoryStorage()
    storage.setItem(getBrowserAiConfigStorageKey(ownerId), "not-json")
    expect(readBrowserAiConfig(ownerId, storage)).toBeNull()

    storage.setItem(
      getBrowserAiConfigStorageKey(ownerId),
      JSON.stringify({
        version: 2,
        modelName: "old-model",
        baseUrl: "https://example.com/v1",
        apiKey: "old-key",
      }),
    )
    expect(readBrowserAiConfig(ownerId, storage)).toBeNull()
  })

  it("clears the stored config", () => {
    const storage = new MemoryStorage()
    saveBrowserAiConfig(
      ownerId,
      {
        modelName: "personal-model",
        baseUrl: "https://example.com/v1",
        apiKey: "personal-key",
      },
      storage,
    )

    clearBrowserAiConfig(ownerId, storage)

    expect(readBrowserAiConfig(ownerId, storage)).toBeNull()
  })

  it("isolates configs between users in the same browser", () => {
    const storage = new MemoryStorage()
    saveBrowserAiConfig(
      ownerId,
      {
        modelName: "personal-model",
        baseUrl: "https://example.com/v1",
        apiKey: "personal-key",
      },
      storage,
    )

    expect(
      readBrowserAiConfig("22222222-2222-4222-8222-222222222222", storage),
    ).toBeNull()
  })

  it("treats unavailable browser storage as unconfigured", () => {
    const unavailableStorage = {
      getItem() {
        throw new Error("storage unavailable")
      },
      setItem() {
        throw new Error("storage unavailable")
      },
      removeItem() {
        throw new Error("storage unavailable")
      },
    }

    expect(readBrowserAiConfig(ownerId, unavailableStorage)).toBeNull()
  })
})
