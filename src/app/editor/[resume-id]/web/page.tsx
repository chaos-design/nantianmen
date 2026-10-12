import { ResumeWebBuilderPage } from "../../../../features/resume-renderer/resume-web-builder-page"
import { requireAuthContext } from "../../../../server/auth/auth-context"
import { loadEditorInitialData } from "../../../../server/domain/editor-initial-data"
import "../../../../styles/web-resume.css"

interface EditorWebPageProps {
  params: Promise<{ "resume-id": string }>
}

export default async function EditorWebPage({ params }: EditorWebPageProps) {
  const [routeParams, actor] = await Promise.all([params, requireAuthContext()])
  const initialData = await loadEditorInitialData(routeParams["resume-id"], actor)
  return (
    <ResumeWebBuilderPage
      resumeId={routeParams["resume-id"]}
      readOnly={actor.mode === "preview"}
      initialResume={initialData.resume ?? undefined}
      initialError={initialData.error ?? undefined}
    />
  )
}
