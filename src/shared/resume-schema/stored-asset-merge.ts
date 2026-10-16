import type { ResumeDocument, ResumeImageAsset } from "./resume-schema"

/**
 * 把仓储层保存的图片资源合并进简历文档。
 * 文档内已存在的资源不重复追加，保持文档顺序在前。
 */
export function mergeStoredAssets(
  document: ResumeDocument,
  storedAssets: ResumeImageAsset[],
): ResumeDocument {
  const existingAssetIds = new Set(document.resources.assets.map((asset) => asset.id))
  const extraAssets = storedAssets.filter((asset) => !existingAssetIds.has(asset.id))
  if (extraAssets.length === 0) {
    return document
  }
  return {
    ...document,
    resources: {
      ...document.resources,
      assets: [...document.resources.assets, ...extraAssets],
    },
  }
}
