import type { Metadata } from "next"
import Link from "next/link"
import { LoginForm } from "../../features/auth/login-form"
import { sanitizeRedirectPath } from "../../server/auth/redirect-path"

export const metadata: Metadata = {
  title: "登录",
  description: "登录 Résumé Lab 工作台。",
}

interface LoginPageProps {
  searchParams: Promise<{
    next?: string | string[]
    error?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams
  const rawNext = Array.isArray(query.next) ? query.next[0] : query.next
  const nextPath = sanitizeRedirectPath(rawNext)
  const callbackFailed =
    (Array.isArray(query.error) ? query.error[0] : query.error) === "callback"

  return (
    <main className="auth-shell auth-login-shell">
      <div className="auth-login-grid" aria-hidden="true" />
      <div className="auth-login-orb auth-login-orb-one" aria-hidden="true" />
      <div className="auth-login-orb auth-login-orb-two" aria-hidden="true" />

      <Link className="brand-mark auth-login-brand" href="/">
        <span>R</span>
        <span>Résumé Lab</span>
      </Link>

      <section className="auth-login-layout">
        <div className="auth-login-story">
          <div className="auth-story-copy">
            <span>SECURE CAREER WORKSPACE</span>
            <h1>
              继续打磨，
              <em>下一份更清晰的表达。</em>
            </h1>
            <p>你的内容、模板和发布版本都在这里，登录后继续上次的编辑。</p>
          </div>

          <div className="auth-kinetic-scene" aria-hidden="true">
            <div className="auth-orbit auth-orbit-outer" />
            <div className="auth-orbit auth-orbit-inner" />
            <div className="auth-paper auth-paper-back">
              <i />
              <i />
              <i />
            </div>
            <div className="auth-paper auth-paper-front">
              <span>R</span>
              <i />
              <i />
              <i />
              <i />
              <b>READY TO EDIT</b>
            </div>
            <div className="auth-scan-line" />
          </div>

          <div className="auth-story-facts">
            <span>A4 + WEB</span>
            <span>24 TEMPLATES</span>
            <span>PRIVATE DRAFT</span>
          </div>
        </div>

        <section className="auth-entry" aria-labelledby="auth-entry-title">
          <span className="auth-entry-index">ACCESS / 01</span>
          <header>
            <h2 id="auth-entry-title">欢迎回来</h2>
            <p>选择一种方式进入你的简历工作台。</p>
          </header>
          <LoginForm
            nextPath={nextPath}
            initialError={
              callbackFailed ? "验证链接无效或已过期，请重新登录。" : undefined
            }
          />
        </section>
      </section>

      <Link className="auth-login-back" href="/">
        返回首页
      </Link>
    </main>
  )
}
