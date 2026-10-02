import { redirect } from "next/navigation"
import { ResumeEditor } from "../../../features/resume-editor/resume-editor"
import { requireAuthContext } from "../../../server/auth/auth-context"

interface EditorPageProps {
  params: Promise<{ "resume-id": string }>
}

export default async function EditorPage({ params }: EditorPageProps) {
  const routeParams = await params
  const actor = await requireAuthContext()
  if (actor.mode === "preview") {
    redirect(`/editor/${routeParams["resume-id"]}/preview`)
  }
  return (
    <ResumeEditor resumeId={routeParams["resume-id"]} aiStorageOwnerId={actor.userId} />
  )
}
