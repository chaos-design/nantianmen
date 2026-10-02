import type { AssetBinary } from "../domain/resume-asset-service"

export function assetResponse(asset: AssetBinary, cacheControl: string): Response {
  return new Response(Buffer.from(asset.bytes), {
    status: 200,
    headers: {
      "Cache-Control": cacheControl,
      "Content-Length": String(asset.bytes.byteLength),
      "Content-Type": asset.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  })
}
