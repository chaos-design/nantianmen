import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

export interface LegalSection {
  id: string
  title: string
  paragraphs?: readonly string[]
  items?: readonly string[]
}

interface LegalDocumentPageProps {
  documentType: "terms" | "privacy"
  eyebrow: string
  title: string
  summary: string
  sections: readonly LegalSection[]
}

export function LegalDocumentPage({
  documentType,
  eyebrow,
  title,
  summary,
  sections,
}: LegalDocumentPageProps) {
  return (
    <div className="legal-shell">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link className="brand-mark brand-mark-compact" href="/">
            <span>R</span>
            <span>Résumé Lab</span>
          </Link>
          <nav className="legal-nav" aria-label="法律文档">
            <Link
              href="/terms"
              aria-current={documentType === "terms" ? "page" : undefined}
            >
              服务条款
            </Link>
            <Link
              href="/privacy"
              aria-current={documentType === "privacy" ? "page" : undefined}
            >
              隐私政策
            </Link>
          </nav>
        </div>
      </header>

      <main className="legal-main">
        <header className="legal-intro">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{summary}</p>
          <dl className="legal-meta">
            <div>
              <dt>生效日期</dt>
              <dd>2026 年</dd>
            </div>
            <div>
              <dt>适用产品</dt>
              <dd>Résumé Lab</dd>
            </div>
          </dl>
        </header>

        <article className="legal-content">
          {sections.map((section, index) => (
            <section id={section.id} key={section.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        <footer className="legal-footer">
          <p>
            本文档适用于 Résumé Lab
            的默认开源实现。第三方部署方应根据其主体、地区和实际处理活动补充必要信息。
          </p>
          <Link href="/login">
            <ArrowLeftIcon aria-hidden="true" />
            返回登录
          </Link>
        </footer>
      </main>
    </div>
  )
}
