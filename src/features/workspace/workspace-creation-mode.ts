export type WorkspaceCreationMode = "hidden" | "inline" | "dialog"

export function resolveWorkspaceCreationMode(
  previewMode: boolean,
  resumeCount: number,
): WorkspaceCreationMode {
  if (previewMode) {
    return "hidden"
  }
  return resumeCount === 0 ? "inline" : "dialog"
}
