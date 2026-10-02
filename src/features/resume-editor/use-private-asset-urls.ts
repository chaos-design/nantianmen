"use client"

import { useEffect, useRef, useState } from "react"
import type { ResumeImageAsset } from "../../shared/resume-schema/resume-schema"
import { loadPrivateAssetBlob } from "./editor-api"

export function usePrivateAssetUrls(
  resumeId: string,
  assets: ResumeImageAsset[],
): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const urlsRef = useRef<Record<string, string>>({})
  const controllersRef = useRef(new Map<string, AbortController>())
  const activeAssetIdsRef = useRef(new Set(assets.map((asset) => asset.id)))
  activeAssetIdsRef.current = new Set(assets.map((asset) => asset.id))
  const assetIdsKey = assets.map((asset) => asset.id).join("|")

  useEffect(() => {
    const activeAssetIds = new Set(assetIdsKey ? assetIdsKey.split("|") : [])
    let changed = false
    const nextUrls = { ...urlsRef.current }

    for (const [assetId, url] of Object.entries(nextUrls)) {
      if (!activeAssetIds.has(assetId)) {
        URL.revokeObjectURL(url)
        delete nextUrls[assetId]
        changed = true
      }
    }
    for (const [assetId, controller] of controllersRef.current) {
      if (!activeAssetIds.has(assetId)) {
        controller.abort()
        controllersRef.current.delete(assetId)
      }
    }
    if (changed) {
      urlsRef.current = nextUrls
      setUrls(nextUrls)
    }

    for (const assetId of activeAssetIds) {
      if (urlsRef.current[assetId] || controllersRef.current.has(assetId)) {
        continue
      }
      const controller = new AbortController()
      controllersRef.current.set(assetId, controller)
      void loadPrivateAssetBlob(resumeId, assetId, controller.signal)
        .then((blob) => {
          if (!activeAssetIdsRef.current.has(assetId)) {
            return
          }
          const objectUrl = URL.createObjectURL(blob)
          urlsRef.current = { ...urlsRef.current, [assetId]: objectUrl }
          setUrls(urlsRef.current)
        })
        .catch(() => undefined)
        .finally(() => {
          controllersRef.current.delete(assetId)
        })
    }
  }, [assetIdsKey, resumeId])

  useEffect(
    () => () => {
      for (const controller of controllersRef.current.values()) {
        controller.abort()
      }
      controllersRef.current.clear()
      for (const url of Object.values(urlsRef.current)) {
        URL.revokeObjectURL(url)
      }
      urlsRef.current = {}
    },
    [],
  )

  return urls
}
