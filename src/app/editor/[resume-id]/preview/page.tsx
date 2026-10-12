import { ResumeDraftPreviewPage } from "../../../../features/resume-renderer/resume-draft-preview-page"
import { requireAuthContext } from "../../../../server/auth/auth-context"
import { loadEditorInitialData } from "../../../../server/domain/editor-initial-data"

interface EditorPreviewPageProps {
  params: Promise<{ "resume-id": string }>
}

export default async function EditorPreviewPage({ params }: EditorPreviewPageProps) {
  const routeParams = await params
  const actor = await requireAuthContext()
  const initialData = await loadEditorInitialData(routeParams["resume-id"], actor)
  return (
    <ResumeDraftPreviewPage
      resumeId={routeParams["resume-id"]}
      readOnly={actor.mode === "preview"}
      initialResume={initialData.resume ?? undefined}
      initialError={initialData.error ?? undefined}
    />
  )
}
