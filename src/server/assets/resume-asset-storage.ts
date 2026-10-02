export interface ResumeAssetStorage {
  put(path: string, bytes: Uint8Array, mimeType: string): Promise<void>
  get(path: string): Promise<Uint8Array>
  delete(path: string): Promise<void>
}
