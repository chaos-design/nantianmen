import { describe, expect, it } from "vitest"
import {
  createResumeDocument,
  type ResumeDocument,
  type ResumeImageAsset,
} from "./resume-schema"
import { mergeStoredAssets } from "./stored-asset-merge"

function imageAsset(id: string, name = `${id}.png`): ResumeImageAsset {
  return {
    id,
    kind: "image",
    name,
    mimeType: "image/png",
    byteSize: 1024,
    width: 800,
    height: 600,
    alt: "",
  }
}

function documentWith(...assetIds: string[]): ResumeDocument {
  const document = createResumeDocument()
  document.resources.assets = assetIds.map((id) => imageAsset(id))
  return document
}

describe("mergeStoredAssets", () => {
  it("returns the same document when there is nothing extra to merge", () => {
    const document = documentWith("a")
    expect(mergeStoredAssets(document, [imageAsset("a")])).toBe(document)
    expect(mergeStoredAssets(document, [])).toBe(document)
  })

  it("appends stored assets that are missing from the document, keeping document order first", () => {
    const document = documentWith("a", "b")
    const merged = mergeStoredAssets(document, [
      imageAsset("a"),
      imageAsset("c"),
      imageAsset("b"),
    ])
    expect(merged.resources.assets.map((asset) => asset.id)).toEqual(["a", "b", "c"])
  })

  it("does not mutate the input document", () => {
    const document = documentWith("a")
    const before = [...document.resources.assets]
    mergeStoredAssets(document, [imageAsset("z")])
    expect(document.resources.assets).toEqual(before)
  })
})
