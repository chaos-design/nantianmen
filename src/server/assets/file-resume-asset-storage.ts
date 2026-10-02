import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ResumeAssetStorage } from "./resume-asset-storage"

export class FileResumeAssetStorage implements ResumeAssetStorage {
  private readonly rootDirectory: string

  constructor(rootDirectory = path.join(process.cwd(), ".data", "assets")) {
    this.rootDirectory = path.resolve(rootDirectory)
  }

  private resolveStoragePath(storagePath: string): string {
    const resolvedPath = path.resolve(this.rootDirectory, storagePath)
    if (
      resolvedPath === this.rootDirectory ||
      !resolvedPath.startsWith(`${this.rootDirectory}${path.sep}`)
    ) {
      throw new Error("INVALID_ASSET_STORAGE_PATH")
    }
    return resolvedPath
  }

  async put(storagePath: string, bytes: Uint8Array, _mimeType: string): Promise<void> {
    const resolvedPath = this.resolveStoragePath(storagePath)
    await mkdir(path.dirname(resolvedPath), { recursive: true })
    await writeFile(resolvedPath, bytes, { flag: "wx" })
  }

  async get(storagePath: string): Promise<Uint8Array> {
    const bytes = await readFile(this.resolveStoragePath(storagePath))
    return new Uint8Array(bytes)
  }

  async delete(storagePath: string): Promise<void> {
    await rm(this.resolveStoragePath(storagePath), { force: true })
  }
}
