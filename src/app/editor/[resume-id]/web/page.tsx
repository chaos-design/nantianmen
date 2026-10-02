import { ResumeWebBuilderPage } from "../../../../features/resume-renderer/resume-web-builder-page"
import { requireAuthContext } from "../../../../server/auth/auth-context"

interface EditorWebPageProps {
  params: Promise<{ "resume-id": string }>
}

export default async function EditorWebPage({ params }: EditorWebPageProps) {
  const [routeParams, actor] = await Promise.all([params, requireAuthContext()])
  return (
    <ResumeWebBuilderPage
      resumeId={routeParams["resume-id"]}
      readOnly={actor.mode === "preview"}
    />
  )
}
