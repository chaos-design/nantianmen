import type { ResumeAssetStorage } from "./resume-asset-storage"

export class InMemoryResumeAssetStorage implements ResumeAssetStorage {
  private readonly assets = new Map<string, Uint8Array>()

  async put(storagePath: string, bytes: Uint8Array, _mimeType: string): Promise<void> {
    if (this.assets.has(storagePath)) {
      throw new Error("ASSET_ALREADY_EXISTS")
    }
    this.assets.set(storagePath, new Uint8Array(bytes))
  }

  async get(storagePath: string): Promise<Uint8Array> {
    const bytes = this.assets.get(storagePath)
    if (!bytes) {
      throw new Error("ASSET_BINARY_NOT_FOUND")
    }
    return new Uint8Array(bytes)
  }

  async delete(storagePath: string): Promise<void> {
    this.assets.delete(storagePath)
  }
}
