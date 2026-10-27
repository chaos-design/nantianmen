import type { AssetBinary } from "../domain/resume-asset-service"

export function binaryAssetResponse(
  bytes: Uint8Array,
  mimeType: string,
  cacheControl: string,
): Response {
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Cache-Control": cacheControl,
      "Content-Length": String(bytes.byteLength),
      "Content-Type": mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export function assetResponse(asset: AssetBinary, cacheControl: string): Response {
  return binaryAssetResponse(asset.bytes, asset.mimeType, cacheControl)
}
