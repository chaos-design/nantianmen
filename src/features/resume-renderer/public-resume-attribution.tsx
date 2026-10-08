import {
  formatLandingFooterCopyright,
  landingRepository,
} from "../landing/landing-footer-links"
import { LandingGithubMark } from "../landing/landing-github-mark"

interface PublicResumeAttributionProps {
  /** Web 分享页是深色底，A4 分享页跟随浅色主题。 */
  tone?: "light" | "dark"
}

/** 分享页底部的来源署名：平台归属、开源许可和仓库入口。
 * 打印与导出 PDF 由 `@media print` 整体隐藏，PDF 只输出简历本身。 */
export function PublicResumeAttribution({
  tone = "light",
}: PublicResumeAttributionProps) {
  return (
    <footer className="public-resume-attribution" data-tone={tone}>
      <p className="public-resume-attribution-note">
        本页面由 Résumé Lab 生成 · 内容以结构化 JSON 为唯一事实来源
      </p>
      <div className="public-resume-attribution-meta">
        <p className="public-resume-attribution-license">
          {formatLandingFooterCopyright(new Date().getFullYear())}
        </p>
        <a
          className="public-resume-attribution-repo"
          href={landingRepository.href}
          rel="noreferrer"
          target="_blank"
        >
          <LandingGithubMark />
          {landingRepository.label}
          <span className="sr-only">仓库：{landingRepository.path}（新窗口打开）</span>
        </a>
      </div>
    </footer>
  )
}
