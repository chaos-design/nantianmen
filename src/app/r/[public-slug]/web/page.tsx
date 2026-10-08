import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PublicResumeActions } from "../../../../features/resume-renderer/public-resume-actions"
import { PublicResumeAttribution } from "../../../../features/resume-renderer/public-resume-attribution"
import { ResumeWebPage } from "../../../../features/resume-renderer/resume-web-page"
import { ResumeService } from "../../../../server/domain/resume-service"
import { getResumeRepository } from "../../../../server/repositories/repository-factory"
import { resolveWebTemplateId } from "../../../../shared/resume-template/web-template-schemes"

export const dynamic = "force-dynamic"

interface PublicResumeWebPageProps {
  params: Promise<{ "public-slug": string }>
  searchParams: Promise<{ template?: string | string[] }>
}

async function getPublicResume(publicSlug: string) {
  try {
    const service = new ResumeService(getResumeRepository())
    return await service.getPublicResume(publicSlug)
  } catch {
    notFound()
  }
}

export async function generateMetadata({
  params,
}: PublicResumeWebPageProps): Promise<Metadata> {
  const routeParams = await params
  const result = await getPublicResume(routeParams["public-slug"])
  const document = result.publication.publishedDocument
  const name = document.profile.name || result.resume.title
  const role = document.metadata.targetRole || document.profile.headline
  return {
    title: role ? `${name} · ${role}` : name,
    description: document.profile.summary,
    robots: { index: false, follow: false },
  }
}

export default async function PublicResumeWebPage({
  params,
  searchParams,
}: PublicResumeWebPageProps) {
  const routeParams = await params
  const query = await searchParams
  const result = await getPublicResume(routeParams["public-slug"])
  const document = result.publication.publishedDocument
  const templateId = resolveWebTemplateId(query.template)

  return (
    <main className="public-web-resume-shell">
      <header className="public-web-resume-toolbar">
        <Link className="brand-mark brand-mark-compact" href="/">
          <span>R</span>
          <span>Résumé Lab</span>
        </Link>
        <div>
          <PublicResumeActions mode="web" publicSlug={result.resume.publicSlug} />
        </div>
      </header>
      <ResumeWebPage document={document} templateId={templateId} />
      <PublicResumeAttribution tone="dark" />
    </main>
  )
}
