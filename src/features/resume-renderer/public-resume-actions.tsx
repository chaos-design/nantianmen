"use client"

import { LinkIcon, PrinterIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import { copyTextToClipboard } from "../../lib/clipboard"
import { landingRepository } from "../landing/landing-footer-links"
import { LandingGithubMark } from "../landing/landing-github-mark"

interface PublicResumeActionsProps {
  mode: "a4" | "web"
}

export function PublicResumeActions({ mode }: PublicResumeActionsProps) {
  return (
    <>
      <Button
        variant="outline"
        size="xs"
        onClick={() => {
          void copyTextToClipboard(window.location.href).then((copied) => {
            if (copied) {
              toast.success("链接已复制")
            }
          })
        }}
      >
        <LinkIcon data-icon="inline-start" />
        复制链接
      </Button>
      {mode === "a4" ? (
        <>
          <Button size="xs" onClick={() => window.print()}>
            <PrinterIcon data-icon="inline-start" />
            打印
          </Button>
          <Button asChild size="xs" variant="outline">
            <a href={landingRepository.href} rel="noreferrer" target="_blank">
              <LandingGithubMark />
              {landingRepository.label}
              <span className="sr-only">
                仓库：{landingRepository.path}（新窗口打开）
              </span>
            </a>
          </Button>
        </>
      ) : null}
    </>
  )
}
