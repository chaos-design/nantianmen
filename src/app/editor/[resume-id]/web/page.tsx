import { ResumeWebBuilderPage } from "../../../../features/resume-renderer/resume-web-builder-page"
import { requireAuthContext } from "../../../../server/auth/auth-context"

interface EditorWebPageProps {
  params: Promise<{ "resume-id": string }>
  searchParams: Promise<{ test?: string | string[] }>
}

export default async function EditorWebPage({
  params,
  searchParams,
}: EditorWebPageProps) {
  const [routeParams, query, actor] = await Promise.all([
    params,
    searchParams,
    requireAuthContext(),
  ])
  return (
    <ResumeWebBuilderPage
      resumeId={routeParams["resume-id"]}
      shareTestMode={query.test === "1"}
      readOnly={actor.mode === "preview"}
    />
  )
}
