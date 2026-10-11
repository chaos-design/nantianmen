"use client"

import { AppWindowIcon, FileTextIcon, LinkIcon, PrinterIcon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import { copyTextToClipboard } from "../../lib/clipboard"

interface PublicResumeActionsProps {
  mode: "a4" | "web"
  publicSlug: string
}

export function PublicResumeActions({ mode, publicSlug }: PublicResumeActionsProps) {
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
        <Button asChild variant="outline" size="xs">
          <Link href={`/r/${encodeURIComponent(publicSlug)}/web`}>
            <AppWindowIcon data-icon="inline-start" />
            互动版
          </Link>
        </Button>
      ) : null}
      {mode === "a4" ? (
        <Button size="xs" onClick={() => window.print()}>
          <PrinterIcon data-icon="inline-start" />
          打印
        </Button>
      ) : null}
      {mode === "web" ? (
        <Button size="xs" variant="outline" asChild>
          <Link
            href={`/r/${encodeURIComponent(publicSlug)}`}
            aria-label="查看 A4 版简历"
          >
            <FileTextIcon data-icon="inline-start" />
            查看 A4 版
          </Link>
        </Button>
      ) : null}
    </>
  )
}
