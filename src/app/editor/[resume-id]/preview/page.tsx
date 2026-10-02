import { ResumeDraftPreviewPage } from "../../../../features/resume-renderer/resume-draft-preview-page"
import { requireAuthContext } from "../../../../server/auth/auth-context"

interface EditorPreviewPageProps {
  params: Promise<{ "resume-id": string }>
}

export default async function EditorPreviewPage({ params }: EditorPreviewPageProps) {
  const routeParams = await params
  const actor = await requireAuthContext()
  return (
    <ResumeDraftPreviewPage
      resumeId={routeParams["resume-id"]}
      readOnly={actor.mode === "preview"}
    />
  )
}
