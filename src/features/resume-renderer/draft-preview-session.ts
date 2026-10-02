import {
  parseResumeDocument,
  type ResumeDocument,
} from "../../shared/resume-schema/resume-schema"

interface DraftPreviewSnapshot {
  resumeId: string
  document: ResumeDocument
  createdAt: number
}

function getDraftPreviewSnapshotKey(resumeId: string): string {
  return `resume-draft-preview:${resumeId}`
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function writeDraftPreviewSnapshot(
  resumeId: string,
  document: ResumeDocument,
): void {
  const storage = getSessionStorage()
  if (!storage) {
    return
  }
  const snapshot: DraftPreviewSnapshot = {
    resumeId,
    document,
    createdAt: Date.now(),
  }
  storage.setItem(getDraftPreviewSnapshotKey(resumeId), JSON.stringify(snapshot))
}

export function consumeDraftPreviewSnapshot(resumeId: string): ResumeDocument | null {
  const storage = getSessionStorage()
  if (!storage) {
    return null
  }
  const key = getDraftPreviewSnapshotKey(resumeId)
  const rawSnapshot = storage.getItem(key)
  storage.removeItem(key)
  if (!rawSnapshot) {
    return null
  }
  try {
    const snapshot = JSON.parse(rawSnapshot) as Partial<DraftPreviewSnapshot>
    if (snapshot.resumeId !== resumeId) {
      return null
    }
    return parseResumeDocument(snapshot.document)
  } catch {
    return null
  }
}
